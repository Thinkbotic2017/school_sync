export interface CreateAcademicYearDto {
  name: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  calendarType: 'ETHIOPIAN' | 'GREGORIAN';
  isCurrent?: boolean;
}

export interface UpdateAcademicYearDto extends Partial<CreateAcademicYearDto> {}

export interface AcademicYearFilters {
  page?: number;
  limit?: number;
}
