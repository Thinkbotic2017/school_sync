import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  numericOrder: z.number().int().positive('numericOrder must be a positive integer'),
  academicYearId: z.string().uuid('academicYearId must be a valid UUID'),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  numericOrder: z.number().int().positive().optional(),
  academicYearId: z.string().uuid().optional(),
});

export const classFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
