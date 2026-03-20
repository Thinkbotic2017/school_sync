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

export interface AssessmentCategory {
  name: string;
  weight: number;
}

export interface GradeGroup {
  name: string;
  grades: string[];
  caWeight: number;
  examWeight: number;
  categories: AssessmentCategory[];
}

export interface AssessmentConfig {
  gradeGroups: GradeGroup[];
}

export interface PromotionConfig {
  minimumOverallAverage: number;
  maximumFailedSubjects: number;
  autoPromoteGrades: string[];
  reExamAllowed: boolean;
  reExamMaxAttempts: number;
  rankingEnabledFromGrade: string;
}

export interface BreakConfig {
  name: string;
  afterPeriod: number;
  duration: number;
}

export interface OperationsConfig {
  workingDays: string[];
  schoolStartTime: string;
  schoolEndTime: string;
  graceMinutes: number;
  periodsPerDay: number;
  periodDurationMinutes: number;
  attendanceMode: 'DAILY' | 'PER_PERIOD' | 'BOTH';
  breaks: BreakConfig[];
}

export interface LatePenaltyConfig {
  graceDays: number;
  penaltyPercent: number;
  maxPenaltyPercent: number;
}

export interface SiblingDiscountConfig {
  '2nd': number;
  '3rd': number;
  '4th': number;
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

export interface AttendanceConfig {
  mode: 'DAILY' | 'PER_PERIOD' | 'BOTH';
  graceMinutes: number;
  notifyOnAbsence: boolean;
  notificationChannels: string[];
}

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

export interface GeneralConfig {
  country: string;
  currency: string;
  calendarType: 'ETHIOPIAN' | 'GREGORIAN';
  timezone: string;
  locale: string;
  secondaryLocale: string;
}

export type ConfigCategory =
  | 'general'
  | 'grading'
  | 'assessment'
  | 'promotion'
  | 'operations'
  | 'fees'
  | 'attendance'
  | 'reportCard';

export interface TenantConfigEntry {
  id: string;
  tenantId: string;
  category: ConfigCategory;
  config: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string;
}

export type TenantConfigMap = {
  general?: GeneralConfig;
  grading?: GradingConfig;
  assessment?: AssessmentConfig;
  promotion?: PromotionConfig;
  operations?: OperationsConfig;
  fees?: FeesConfig;
  attendance?: AttendanceConfig;
  reportCard?: ReportCardConfig;
};
