export interface SetupWizardInput {
  schoolProfile: {
    name: string;
    country: string;
    schoolType: 'PRIMARY' | 'SECONDARY' | 'K12' | 'KG' | 'CUSTOM';
    calendarType: 'GREGORIAN' | 'ETHIOPIAN' | 'HIJRI' | 'CUSTOM';
    timezone: string;
    locale: string;
  };
  academicYear: {
    name: string;
    startDate: string; // ISO date
    endDate: string;
    terms: Array<{ name: string; startDate: string; endDate: string }>;
  };
  grades: Array<{
    name: string;
    displayOrder: number;
    sections: Array<{ name: string; capacity: number }>;
  }>;
  subjects: Array<{
    name: string;
    code: string;
    type: 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR';
    gradesApplicable: string[]; // grade names
    periodsPerWeek: number;
  }>;
  gradingPreset: 'ethiopian' | 'igcse' | 'ib' | 'american' | 'custom';
  customGrading?: object;
  assessmentWeights: Array<{
    gradeGroup: string;
    grades: string[];
    caWeight: number;
    examWeight: number;
    categories: Array<{ name: string; weight: number }>;
  }>;
  feeStructures: Array<{
    name: string;
    amount: number;
    frequency: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'ANNUAL';
    applicableGrades: string[];
  }>;
  promotionRules: {
    minAverage: number;
    maxFailed: number;
    autoPromoteGrades: string[];
    reExamAllowed: boolean;
  };
  operations: {
    workingDays: string[];
    startTime: string;
    endTime: string;
    graceMinutes: number;
    periodsPerDay: number;
  };
}

export interface SetupResult {
  academicYearId: string;
  classCount: number;
  sectionCount: number;
  subjectCount: number;
}

export interface SetupStatusResult {
  setupComplete: boolean;
}
