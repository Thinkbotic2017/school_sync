import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { mkdirSync } from 'fs';

import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, redis } from './config/redis';
import { initSocket } from './config/socket';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { resolveTenant } from './middleware/tenant';
import { setRLSContext } from './middleware/rls';
import { authRouter } from './modules/auth/auth.routes';
import { studentRouter } from './modules/student/student.routes';
import { academicYearRouter } from './modules/academic-year/academic-year.routes';
import { classRouter } from './modules/class/class.routes';
import { sectionRouter } from './modules/section/section.routes';
import { subjectRouter } from './modules/subject/subject.routes';
import { classSubjectRouter } from './modules/class-subject/class-subject.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { feeRouter } from './modules/fee/fee.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { logger } from './utils/logger';

// Ensure upload subdirectories exist (multer does not auto-create nested dirs)
mkdirSync('uploads/photos', { recursive: true });
mkdirSync('uploads/documents', { recursive: true });
mkdirSync('uploads/imports', { recursive: true });

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://schoolsync.app', /\.schoolsync\.app$/]
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: env.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiBase = `/v${env.API_VERSION.replace('v', '')}`;

// Auth routes — no tenant middleware required (login/refresh have no token yet)
app.use(`${apiBase}/auth`, authRouter);

// All other routes: authenticate → resolveTenant → setRLSContext
// These three middleware must run in this exact order on every protected route.
// authenticate: verifies JWT, sets req.auth
// resolveTenant: looks up tenant by header/subdomain, validates license, sets req.tenant
// setRLSContext: calls set_config('app.current_tenant_id', ...) so PostgreSQL RLS filters by tenant
const tenantMiddleware = [authenticate, resolveTenant, setRLSContext];
app.use(`${apiBase}/students`, ...tenantMiddleware, studentRouter);
app.use(`${apiBase}/academic-years`, ...tenantMiddleware, academicYearRouter);
app.use(`${apiBase}/classes`, ...tenantMiddleware, classRouter);
app.use(`${apiBase}/sections`, ...tenantMiddleware, sectionRouter);
app.use(`${apiBase}/subjects`, ...tenantMiddleware, subjectRouter);
app.use(`${apiBase}/class-subjects`, ...tenantMiddleware, classSubjectRouter);

// Attendance router manages its own auth:
// - /rfid-event uses X-Reader-Secret header auth (RFID agent process)
// - all other routes use the standard JWT tenantMiddleware chain
app.use(`${apiBase}/attendance`, attendanceRouter);

// Fee module — all fee routes use the standard tenant middleware chain.
// The feeRouter contains full paths (/fee-structures, /fee-records, /fee-discounts, /fee-reports)
// so we mount it at the apiBase level.
app.use(apiBase, ...tenantMiddleware, feeRouter);
app.use(`${apiBase}/dashboard`, ...tenantMiddleware, dashboardRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Global error handler
app.use(errorHandler);

// Startup
async function start() {
  try {
    await connectDatabase();
    await connectRedis();

    httpServer.listen(env.PORT, () => {
      logger.info(`SchoolSync API running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`API base: /v1`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await disconnectDatabase();
  await redis.quit();
  process.exit(0);
});

start();
