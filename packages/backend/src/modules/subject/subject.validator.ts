import { z } from 'zod';

const subjectTypeEnum = z.enum(['CORE', 'ELECTIVE', 'EXTRACURRICULAR']);

export const createSubjectSchema = z.object({
  academicYearId: z.string().uuid('academicYearId must be a valid UUID'),
  name: z.string().min(1, 'Name is required').max(150),
  nameAmharic: z.string().max(150).optional(),
  code: z.string().min(1, 'Code is required').max(20),
  type: subjectTypeEnum.optional().default('CORE'),
});

export const updateSubjectSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  name: z.string().min(1).max(150).optional(),
  nameAmharic: z.string().max(150).optional().nullable(),
  code: z.string().min(1).max(20).optional(),
  type: subjectTypeEnum.optional(),
});

export const subjectFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  type: subjectTypeEnum.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
