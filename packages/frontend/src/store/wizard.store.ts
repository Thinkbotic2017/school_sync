import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardSchoolProfile {
  name: string;
  country: string;
  schoolType: string;
  calendarType: string;
  timezone: string;
  locale: string;
}

export interface WizardTerm {
  name: string;
  startDate: string;
  endDate: string;
}

export interface WizardAcademicYear {
  name: string;
  startDate: string;
  endDate: string;
  terms: WizardTerm[];
}

export interface WizardSection {
  name: string;
  capacity: number;
}

export interface WizardGrade {
  name: string;
  displayOrder: number;
  sections: WizardSection[];
}

export interface WizardSubject {
  name: string;
  code: string;
  type: 'CORE' | 'ELECTIVE';
  gradesApplicable: string[];
  periodsPerWeek: number;
}

export interface WizardAssessmentCategory {
  name: string;
  weight: number;
}

export interface WizardGradeGroup {
  gradeGroup: string;
  grades: string[];
  caWeight: number;
  examWeight: number;
  categories: WizardAssessmentCategory[];
}

export interface WizardFeeStructure {
  name: string;
  amount: number;
  frequency: string;
  applicableGrades: string[];
}

export interface WizardPromotionRules {
  minAverage: number;
  maxFailed: number;
  autoPromoteGrades: string[];
  reExamAllowed: boolean;
  reExamMaxAttempts: number;
}

export interface WizardOperations {
  workingDays: string[];
  startTime: string;
  endTime: string;
  graceMinutes: number;
  periodsPerDay: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface WizardState {
  currentStep: number;
  schoolProfile: WizardSchoolProfile | null;
  academicYear: WizardAcademicYear | null;
  grades: WizardGrade[];
  subjects: WizardSubject[];
  gradingPreset: string;
  customGrading: object | null;
  assessmentWeights: WizardGradeGroup[];
  feeStructures: WizardFeeStructure[];
  promotionRules: WizardPromotionRules | null;
  operations: WizardOperations | null;

  setStep: (step: number) => void;
  setSchoolProfile: (data: WizardSchoolProfile) => void;
  setAcademicYear: (data: WizardAcademicYear) => void;
  setGrades: (data: WizardGrade[]) => void;
  setSubjects: (data: WizardSubject[]) => void;
  setGradingPreset: (preset: string) => void;
  setCustomGrading: (data: object) => void;
  setAssessmentWeights: (data: WizardGradeGroup[]) => void;
  setFeeStructures: (data: WizardFeeStructure[]) => void;
  setPromotionRules: (data: WizardPromotionRules) => void;
  setOperations: (data: WizardOperations) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1,
  schoolProfile: null,
  academicYear: null,
  grades: [],
  subjects: [],
  gradingPreset: 'Ethiopian',
  customGrading: null,
  assessmentWeights: [],
  feeStructures: [],
  promotionRules: null,
  operations: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      setSchoolProfile: (data) => set({ schoolProfile: data }),
      setAcademicYear: (data) => set({ academicYear: data }),
      setGrades: (data) => set({ grades: data }),
      setSubjects: (data) => set({ subjects: data }),
      setGradingPreset: (preset) => set({ gradingPreset: preset }),
      setCustomGrading: (data) => set({ customGrading: data }),
      setAssessmentWeights: (data) => set({ assessmentWeights: data }),
      setFeeStructures: (data) => set({ feeStructures: data }),
      setPromotionRules: (data) => set({ promotionRules: data }),
      setOperations: (data) => set({ operations: data }),
      reset: () => set(initialState),
    }),
    {
      name: 'schoolsync-wizard',
    },
  ),
);
