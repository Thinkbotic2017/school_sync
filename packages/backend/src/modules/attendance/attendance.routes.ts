import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { attendanceController } from './attendance.controller';
import { authenticate } from '../../middleware/auth';
import { resolveTenant } from '../../middleware/tenant';
import { setRLSContext } from '../../middleware/rls';
import { validate } from '../../middleware/validator';
import { requireRoles } from '../../middleware/rbac';
import {
  rfidEventSchema,
  manualAttendanceSchema,
  bulkAttendanceSchema,
  attendanceFiltersSchema,
} from './attendance.validator';
import { UserRole } from '@prisma/client';

const router: Router = Router();

// ── RFID event endpoint ──────────────────────────────────────────────────────
// Authenticated by X-Reader-Secret header (not JWT) — called by the RFID agent
// process, not the web frontend. Tenant is resolved from X-Tenant-ID header.
// This route must be registered BEFORE the router.use(authenticate) block
// so that requests to /rfid-event do not hit JWT auth.
router.post(
  '/rfid-event',
  rfidAuthMiddleware,
  rfidRlsMiddleware,
  validate(rfidEventSchema, 'body'),
  attendanceController.rfidEvent,
);

// ── All other routes: JWT auth + tenant resolution + RLS context ─────────────
router.use(authenticate, resolveTenant, setRLSContext);

router.get(
  '/today-summary',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.RECEPTIONIST),
  attendanceController.todaySummary,
);
router.get(
  '/recent-checkins',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.RECEPTIONIST),
  attendanceController.recentCheckIns,
);
router.get('/report', attendanceController.report);
router.get('/', validate(attendanceFiltersSchema, 'query'), attendanceController.list);

router.post(
  '/manual',
  requireRoles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL),
  validate(manualAttendanceSchema, 'body'),
  attendanceController.manual,
);

router.post(
  '/bulk',
  requireRoles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL),
  validate(bulkAttendanceSchema, 'body'),
  attendanceController.bulk,
);

// ── RFID RLS context middleware ───────────────────────────────────────────────
// Must run after rfidAuthMiddleware (which sets req.auth.tenantId).
// The RfidEventLog, Student, Attendance tables all have FORCE RLS so we need
// to set the tenant context before any Prisma queries in processRfidEvent.
async function rfidRlsMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.auth?.tenantId;
    if (tenantId) {
      const { prisma } = await import('../../config/database');
      await prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        tenantId,
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

// ── RFID reader authentication middleware ────────────────────────────────────
// Validates X-Reader-Secret and resolves X-Tenant-ID slug → tenant UUID.
async function rfidAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const secret = req.headers['x-reader-secret'];
    const expectedSecret = process.env['RFID_READER_SECRET'];

    if (!expectedSecret || secret !== expectedSecret) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid reader secret' },
      });
      return;
    }

    // For RFID events, tenant is identified via X-Tenant-ID header (slug or UUID)
    const tenantSlug = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantSlug) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'X-Tenant-ID header required' },
      });
      return;
    }

    // Resolve slug → tenant UUID (same as resolveTenant middleware)
    const { prisma } = await import('../../config/database');
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant not found' },
      });
      return;
    }

    // Set req.auth with resolved UUID (not slug)
    req.auth = { tenantId: tenant.id, userId: 'rfid-reader', role: 'RFID_READER' };
    next();
  } catch (err) {
    next(err);
  }
}

export default router;
export { router as attendanceRouter };
