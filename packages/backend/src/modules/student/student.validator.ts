import { z } from 'zod';

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  gender: z.enum(['MALE', 'FEMALE']),
  bloodGroup: z.string().max(10).optional(),
  nationality: z.string().max(100).optional(),
  classId: z.string().uuid('classId must be a valid UUID'),
  sectionId: z.string().uuid('sectionId must be a valid UUID'),
  rollNumber: z.string().max(50).optional(),
  rfidCardNumber: z.string().max(100).optional(),
  admissionDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid admission date format' })
    .optional(),
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'])
    .optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const studentFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'])
    .optional(),
  // includeInactive=true surfaces soft-deleted students (SCHOOL_ADMIN only — enforce in controller/RBAC)
  includeInactive: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
});

export const assignParentSchema = z.object({
  parentId: z.string().uuid('parentId must be a valid UUID'),
  relationship: z.string().min(1, 'Relationship is required').max(50),
  isPrimary: z.boolean().optional().default(false),
});
