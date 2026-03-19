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
  validate(rfidEventSchema, 'body'),
  attendanceController.rfidEvent,
);

// ── All other routes: JWT auth + tenant resolution + RLS context ─────────────
router.use(authenticate, resolveTenant, setRLSContext);

router.get('/today-summary', attendanceController.todaySummary);
router.get('/recent-checkins', attendanceController.recentCheckIns);
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

// ── RFID reader authentication middleware ────────────────────────────────────
function rfidAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-reader-secret'];
  const expectedSecret = process.env['RFID_READER_SECRET'];

  if (!expectedSecret || secret !== expectedSecret) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid reader secret' },
    });
    return;
  }

  // For RFID events, tenant is identified via X-Tenant-ID header
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'X-Tenant-ID header required' },
    });
    return;
  }

  // Set req.auth so service layer gets tenantId (userId not applicable for reader agent)
  req.auth = { tenantId, userId: 'rfid-reader', role: 'RFID_READER' };
  next();
}

export default router;
export { router as attendanceRouter };
