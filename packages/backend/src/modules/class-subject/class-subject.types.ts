export interface AssignSubjectDto {
  classId: string;
  subjectId: string;
  teacherId?: string;
  periodsPerWeek?: number;
}

export interface ClassSubjectFilters {
  classId: string;
}
