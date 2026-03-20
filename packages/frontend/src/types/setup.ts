import type {
  WizardSchoolProfile,
  WizardAcademicYear,
  WizardGrade,
  WizardSubject,
  WizardGradeGroup,
  WizardFeeStructure,
  WizardPromotionRules,
  WizardOperations,
} from '@/store/wizard.store';

export interface SetupWizardInput {
  schoolProfile: WizardSchoolProfile;
  academicYear: WizardAcademicYear;
  grades: WizardGrade[];
  subjects: WizardSubject[];
  gradingPreset: string;
  assessmentWeights: WizardGradeGroup[];
  feeStructures: WizardFeeStructure[];
  promotionRules: WizardPromotionRules;
  operations: WizardOperations;
}

export interface SetupStatusResponse {
  setupComplete: boolean;
}

export interface SetupInitializeResponse {
  academicYearId: string;
  classCount: number;
  sectionCount: number;
  subjectCount: number;
}
