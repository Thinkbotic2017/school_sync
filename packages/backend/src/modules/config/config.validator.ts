import { z } from 'zod';
import { CONFIG_CATEGORIES } from './config.types';

// ── Category param ────────────────────────────────────────────────────────────

export const categoryParamSchema = z.object({
  category: z.enum(CONFIG_CATEGORIES as unknown as [string, ...string[]]),
});

// ── General ───────────────────────────────────────────────────────────────────

export const generalConfigSchema = z.object({
  country: z.string().min(2).max(2),
  currency: z.string().min(3).max(3),
  calendarType: z.enum(['ETHIOPIAN', 'GREGORIAN']),
  timezone: z.string().min(1),
  locale: z.string().min(2),
  secondaryLocale: z.string().min(2),
});

// ── Grading ───────────────────────────────────────────────────────────────────

const gradeScaleEntrySchema = z.object({
  letter: z.string().min(1).max(3),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  gpa: z.number().min(0).max(4),
  description: z.string().min(1),
});

export const gradingConfigSchema = z.object({
  scale: z.array(gradeScaleEntrySchema).min(1),
  passingGrade: z.string().min(1),
  minimumPassPercentage: z.number().min(0).max(100),
});

// ── Assessment ────────────────────────────────────────────────────────────────

const assessmentCategorySchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
});

const assessmentGradeGroupSchema = z.object({
  name: z.string().min(1),
  grades: z.array(z.string().min(1)).min(1),
  caWeight: z.number().min(0).max(100),
  examWeight: z.number().min(0).max(100),
  categories: z.array(assessmentCategorySchema).min(1),
});

export const assessmentConfigSchema = z.object({
  gradeGroups: z.array(assessmentGradeGroupSchema).min(1),
});

// ── Promotion ─────────────────────────────────────────────────────────────────

export const promotionConfigSchema = z.object({
  minimumOverallAverage: z.number().min(0).max(100),
  maximumFailedSubjects: z.number().min(0),
  autoPromoteGrades: z.array(z.string()),
  reExamAllowed: z.boolean(),
  reExamMaxAttempts: z.number().min(0),
  rankingEnabledFromGrade: z.string().min(1),
});

// ── Operations ────────────────────────────────────────────────────────────────

const weekDaySchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const breakConfigSchema = z.object({
  name: z.string().min(1),
  afterPeriod: z.number().min(1),
  duration: z.number().min(1),
});

export const operationsConfigSchema = z.object({
  workingDays: z.array(weekDaySchema).min(1),
  schoolStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  schoolEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  graceMinutes: z.number().min(0),
  periodsPerDay: z.number().min(1),
  periodDurationMinutes: z.number().min(10),
  attendanceMode: z.enum(['DAILY', 'PER_PERIOD', 'BOTH']),
  breaks: z.array(breakConfigSchema),
});

// ── Fees ──────────────────────────────────────────────────────────────────────

const latePenaltySchema = z.object({
  graceDays: z.number().min(0),
  penaltyPercent: z.number().min(0),
  maxPenaltyPercent: z.number().min(0),
});

const discountsSchema = z.object({
  sibling: z.record(z.string(), z.number().min(0)),
  fullPaymentAnnual: z.number().min(0),
});

export const feesConfigSchema = z.object({
  currency: z.string().min(3).max(3),
  latePenalty: latePenaltySchema,
  clearanceRequired: z.array(z.string()),
  paymentMethods: z.array(z.string().min(1)).min(1),
  discounts: discountsSchema,
});

// ── Attendance ────────────────────────────────────────────────────────────────

export const attendanceConfigSchema = z.object({
  mode: z.enum(['DAILY', 'PER_PERIOD', 'BOTH']),
  graceMinutes: z.number().min(0),
  notifyOnAbsence: z.boolean(),
  notificationChannels: z.array(z.string().min(1)),
});

// ── Report Card ───────────────────────────────────────────────────────────────

export const reportCardConfigSchema = z.object({
  showRank: z.boolean(),
  showAttendance: z.boolean(),
  showConduct: z.boolean(),
  showTeacherRemarks: z.boolean(),
  showPrincipalRemarks: z.boolean(),
  showPhoto: z.boolean(),
  languages: z.array(z.string().min(2)).min(1),
  primaryLanguage: z.string().min(2),
});

// ── Initialize defaults ───────────────────────────────────────────────────────

export const initializeDefaultsSchema = z.object({
  country: z.string().min(2).max(2),
});

// ── Schema map for category-based validation ──────────────────────────────────

export const configSchemaMap = {
  general: generalConfigSchema,
  grading: gradingConfigSchema,
  assessment: assessmentConfigSchema,
  promotion: promotionConfigSchema,
  operations: operationsConfigSchema,
  fees: feesConfigSchema,
  attendance: attendanceConfigSchema,
  reportCard: reportCardConfigSchema,
} as const;

export type ConfigSchemaMap = typeof configSchemaMap;
