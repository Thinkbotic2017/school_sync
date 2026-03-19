import { z } from 'zod';

export const createSectionSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
  name: z.string().min(1, 'Name is required').max(50),
  capacity: z.number().int().positive('Capacity must be a positive integer').optional().default(40),
});

export const updateSectionSchema = z.object({
  classId: z.string().uuid().optional(),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().optional(),
});

export const sectionFiltersSchema = z.object({
  classId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
