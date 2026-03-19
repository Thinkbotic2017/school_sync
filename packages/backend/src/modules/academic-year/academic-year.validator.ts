import { z } from 'zod';

const isoDateString = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Must be a valid date string (ISO 8601)' });

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  startDate: isoDateString,
  endDate: isoDateString,
  calendarType: z.enum(['ETHIOPIAN', 'GREGORIAN']),
  isCurrent: z.boolean().optional(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'endDate must be after startDate', path: ['endDate'] },
);

export const updateAcademicYearSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
  calendarType: z.enum(['ETHIOPIAN', 'GREGORIAN']).optional(),
  isCurrent: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
