// ── Config category enum ──────────────────────────────────────────────────────

export const CONFIG_CATEGORIES = [
  'general',
  'grading',
  'assessment',
  'promotion',
  'operations',
  'fees',
  'attendance',
  'reportCard',
] as const;

export type ConfigCategory = (typeof CONFIG_CATEGORIES)[number];

// ── General ───────────────────────────────────────────────────────────────────

export interface GeneralConfig {
  country: string;
  currency: string;
  calendarType: 'ETHIOPIAN' | 'GREGORIAN';
  timezone: string;
  locale: string;
  secondaryLocale: string;
}

// ── Grading ───────────────────────────────────────────────────────────────────

export interface GradeScaleEntry {
  letter: string;
  min: number;
  max: number;
  gpa: number;
  description: string;
}

export interface GradingConfig {
  scale: GradeScaleEntry[];
  passingGrade: string;
  minimumPassPercentage: number;
}

// ── Assessment ────────────────────────────────────────────────────────────────

export interface AssessmentCategory {
  name: string;
  weight: number;
}

export interface AssessmentGradeGroup {
  name: string;
  grades: string[];
  caWeight: number;
  examWeight: number;
  categories: AssessmentCategory[];
}

export interface AssessmentConfig {
  gradeGroups: AssessmentGradeGroup[];
}

// ── Promotion ─────────────────────────────────────────────────────────────────

export interface PromotionConfig {
  minimumOverallAverage: number;
  maximumFailedSubjects: number;
  autoPromoteGrades: string[];
  reExamAllowed: boolean;
  reExamMaxAttempts: number;
  rankingEnabledFromGrade: string;
}

// ── Operations ────────────────────────────────────────────────────────────────

export type WeekDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type AttendanceMode = 'DAILY' | 'PER_PERIOD' | 'BOTH';

export interface BreakConfig {
  name: string;
  afterPeriod: number;
  duration: number;
}

export interface OperationsConfig {
  workingDays: WeekDay[];
  schoolStartTime: string;
  schoolEndTime: string;
  graceMinutes: number;
  periodsPerDay: number;
  periodDurationMinutes: number;
  attendanceMode: AttendanceMode;
  breaks: BreakConfig[];
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export interface LatePenaltyConfig {
  graceDays: number;
  penaltyPercent: number;
  maxPenaltyPercent: number;
}

export interface SiblingDiscountConfig {
  [position: string]: number;
}

export interface DiscountsConfig {
  sibling: SiblingDiscountConfig;
  fullPaymentAnnual: number;
}

export interface FeesConfig {
  currency: string;
  latePenalty: LatePenaltyConfig;
  clearanceRequired: string[];
  paymentMethods: string[];
  discounts: DiscountsConfig;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceConfig {
  mode: AttendanceMode;
  graceMinutes: number;
  notifyOnAbsence: boolean;
  notificationChannels: string[];
}

// ── Report Card ───────────────────────────────────────────────────────────────

export interface ReportCardConfig {
  showRank: boolean;
  showAttendance: boolean;
  showConduct: boolean;
  showTeacherRemarks: boolean;
  showPrincipalRemarks: boolean;
  showPhoto: boolean;
  languages: string[];
  primaryLanguage: string;
}

// ── Union for typed access ────────────────────────────────────────────────────

export type AnyConfigValue =
  | GeneralConfig
  | GradingConfig
  | AssessmentConfig
  | PromotionConfig
  | OperationsConfig
  | FeesConfig
  | AttendanceConfig
  | ReportCardConfig;

export interface CategoryConfigMap {
  general: GeneralConfig;
  grading: GradingConfig;
  assessment: AssessmentConfig;
  promotion: PromotionConfig;
  operations: OperationsConfig;
  fees: FeesConfig;
  attendance: AttendanceConfig;
  reportCard: ReportCardConfig;
}

// ── API response shape ────────────────────────────────────────────────────────

export interface TenantConfigEntry {
  id: string;
  tenantId: string;
  category: string;
  config: AnyConfigValue;
  updatedAt: Date;
  updatedBy: string | null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface UpdateConfigDto {
  config: AnyConfigValue;
}

export interface InitializeDefaultsDto {
  country: string;
}
