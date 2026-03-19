import { z } from 'zod';

export const createFeeStructureSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  currency: z.string().default('ETB'),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'ANNUAL']),
  classId: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
});

export const updateFeeStructureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'ANNUAL']).optional(),
  classId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const feeStructureFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'ANNUAL']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER']),
  receiptNumber: z.string().optional(),
  remarks: z.string().optional(),
});

export const waiveFeeSchema = z.object({
  reason: z.string().min(1),
  approvedById: z.string().uuid(),
});

export const feeRecordFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  feeStructureId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED']).optional(),
  classId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createDiscountSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive(),
  reason: z.string().min(1),
  approvedById: z.string().uuid(),
});

export const feeReportFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
