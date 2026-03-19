import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { feeController } from './fee.controller';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validator';
import {
  createFeeStructureSchema,
  updateFeeStructureSchema,
  feeStructureFiltersSchema,
  recordPaymentSchema,
  waiveFeeSchema,
  feeRecordFiltersSchema,
  createDiscountSchema,
  feeReportFiltersSchema,
} from './fee.validator';

const router: Router = Router();

// ── Fee Structures ────────────────────────────────────────────────────────────
router.get(
  '/fee-structures',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  validate(feeStructureFiltersSchema, 'query'),
  feeController.listStructures,
);
router.get(
  '/fee-structures/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  feeController.getStructure,
);
router.post(
  '/fee-structures',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  validate(createFeeStructureSchema, 'body'),
  feeController.createStructure,
);
router.put(
  '/fee-structures/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  validate(updateFeeStructureSchema, 'body'),
  feeController.updateStructure,
);
router.delete(
  '/fee-structures/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  feeController.deleteStructure,
);
router.post(
  '/fee-structures/:id/generate-records',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  feeController.generateRecords,
);

// ── Fee Records ───────────────────────────────────────────────────────────────
router.get(
  '/fee-records',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.ACCOUNTANT,
    UserRole.TEACHER,
  ),
  validate(feeRecordFiltersSchema, 'query'),
  feeController.listRecords,
);
router.get(
  '/fee-records/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  feeController.getRecord,
);
router.post(
  '/fee-records/:id/pay',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  validate(recordPaymentSchema, 'body'),
  feeController.recordPayment,
);
router.post(
  '/fee-records/:id/waive',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  validate(waiveFeeSchema, 'body'),
  feeController.waiveFee,
);
router.put(
  '/fee-records/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  feeController.updateRecord,
);

// ── Fee Discounts ─────────────────────────────────────────────────────────────
router.get(
  '/fee-discounts',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  feeController.listDiscounts,
);
router.post(
  '/fee-discounts',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  validate(createDiscountSchema, 'body'),
  feeController.createDiscount,
);
router.delete(
  '/fee-discounts/:id',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT),
  feeController.deleteDiscount,
);

// ── Fee Reports ───────────────────────────────────────────────────────────────
router.get(
  '/fee-reports/collection-summary',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  validate(feeReportFiltersSchema, 'query'),
  feeController.collectionSummary,
);
router.get(
  '/fee-reports/student-ledger/:studentId',
  requireRoles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.ACCOUNTANT,
    UserRole.PARENT,
  ),
  feeController.studentLedger,
);
router.get(
  '/fee-reports/overdue',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  feeController.overdueReport,
);
router.get(
  '/fee-reports/class-summary',
  requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.ACCOUNTANT),
  validate(feeReportFiltersSchema, 'query'),
  feeController.classSummary,
);

export default router;
export { router as feeRouter };
