import { z } from 'zod';

export const assignSubjectSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
  teacherId: z.string().uuid('teacherId must be a valid UUID').optional(),
  periodsPerWeek: z.number().int().positive().max(40).optional().default(5),
});

export const classSubjectFiltersSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
});

export const classSubjectParamsSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
});
