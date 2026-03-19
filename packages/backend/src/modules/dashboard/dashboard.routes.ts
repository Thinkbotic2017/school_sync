import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { dashboardController } from './dashboard.controller';
import { requireRoles } from '../../middleware/rbac';

const router: Router = Router();

// authenticate + resolveTenant + setRLSContext are applied at app level in index.ts

router.get(
  '/overview',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.TEACHER,
    UserRole.ACCOUNTANT,
  ),
  dashboardController.getOverview,
);

router.get(
  '/attendance-chart',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.TEACHER,
    UserRole.ACCOUNTANT,
  ),
  dashboardController.getAttendanceChart,
);

router.get(
  '/fee-chart',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.ACCOUNTANT,
  ),
  dashboardController.getFeeChart,
);

router.get(
  '/class-performance',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.TEACHER,
    UserRole.ACCOUNTANT,
  ),
  dashboardController.getClassPerformance,
);

export default router;
export { router as dashboardRouter };
