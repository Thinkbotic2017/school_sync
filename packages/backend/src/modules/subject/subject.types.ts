export interface CreateSubjectDto {
  academicYearId: string;
  name: string;
  nameAmharic?: string;
  code: string;
  type?: 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR';
}

export interface UpdateSubjectDto extends Partial<CreateSubjectDto> {}

export interface SubjectFilters {
  academicYearId?: string;
  type?: 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR';
  page?: number;
  limit?: number;
}
