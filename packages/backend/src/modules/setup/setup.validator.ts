import { z } from 'zod';

// ── School Profile ────────────────────────────────────────────────────────────

const schoolProfileSchema = z.object({
  name: z.string().min(1, 'School name is required').max(200),
  country: z.string().min(2).max(2, 'Country must be a 2-letter ISO code'),
  schoolType: z.enum(['PRIMARY', 'SECONDARY', 'K12', 'KG', 'CUSTOM']),
  calendarType: z.enum(['GREGORIAN', 'ETHIOPIAN', 'HIJRI', 'CUSTOM']),
  timezone: z.string().min(1, 'Timezone is required'),
  locale: z.string().min(2, 'Locale is required'),
});

// ── Academic Year ─────────────────────────────────────────────────────────────

const termSchema = z.object({
  name: z.string().min(1, 'Term name is required'),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

const academicYearSchema = z.object({
  name: z.string().min(1, 'Academic year name is required'),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  terms: z.array(termSchema),
});

// ── Grades & Sections ─────────────────────────────────────────────────────────

const sectionInputSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(50),
  capacity: z.number().int().min(1).max(200),
});

const gradeInputSchema = z.object({
  name: z.string().min(1, 'Grade name is required').max(100),
  displayOrder: z.number().int().min(1),
  sections: z.array(sectionInputSchema).min(1, 'At least one section is required'),
});

// ── Subjects ──────────────────────────────────────────────────────────────────

const subjectInputSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(200),
  code: z.string().min(1, 'Subject code is required').max(20),
  type: z.enum(['CORE', 'ELECTIVE', 'EXTRACURRICULAR']),
  gradesApplicable: z.array(z.string().min(1)).min(1, 'At least one grade must be specified'),
  periodsPerWeek: z.number().int().min(1).max(20),
});

// ── Assessment Weights ────────────────────────────────────────────────────────

const assessmentCategorySchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
});

const assessmentWeightSchema = z
  .object({
    gradeGroup: z.string().min(1),
    grades: z.array(z.string().min(1)).min(1),
    caWeight: z.number().min(0).max(100),
    examWeight: z.number().min(0).max(100),
    categories: z.array(assessmentCategorySchema).min(1),
  })
  .refine((data) => data.caWeight + data.examWeight === 100, {
    message: 'CA weight and Exam weight must sum to 100',
    path: ['caWeight'],
  });

// ── Fee Structures ────────────────────────────────────────────────────────────

const feeStructureInputSchema = z.object({
  name: z.string().min(1, 'Fee name is required').max(200),
  amount: z.number().min(0, 'Amount must be non-negative'),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'ANNUAL']),
  applicableGrades: z.array(z.string().min(1)),
});

// ── Promotion Rules ───────────────────────────────────────────────────────────

const promotionRulesSchema = z.object({
  minAverage: z.number().min(0).max(100),
  maxFailed: z.number().int().min(0),
  autoPromoteGrades: z.array(z.string()),
  reExamAllowed: z.boolean(),
});

// ── Operations ────────────────────────────────────────────────────────────────

const operationsSchema = z.object({
  workingDays: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .min(1, 'At least one working day is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
  graceMinutes: z.number().int().min(0),
  periodsPerDay: z.number().int().min(1).max(20),
});

// ── Full Wizard Schema ────────────────────────────────────────────────────────

export const setupWizardSchema = z.object({
  schoolProfile: schoolProfileSchema,
  academicYear: academicYearSchema,
  grades: z.array(gradeInputSchema).min(1, 'At least one grade is required'),
  subjects: z.array(subjectInputSchema).min(1, 'At least one subject is required'),
  gradingPreset: z.enum(['ethiopian', 'igcse', 'ib', 'american', 'custom']),
  customGrading: z.object({}).passthrough().optional(),
  assessmentWeights: z.array(assessmentWeightSchema).min(1, 'Assessment weights are required'),
  feeStructures: z.array(feeStructureInputSchema),
  promotionRules: promotionRulesSchema,
  operations: operationsSchema,
});

export type SetupWizardBody = z.infer<typeof setupWizardSchema>;
