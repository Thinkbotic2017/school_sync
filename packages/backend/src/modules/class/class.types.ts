export interface CreateClassDto {
  name: string;
  numericOrder: number;
  academicYearId: string;
}

export interface UpdateClassDto extends Partial<CreateClassDto> {}

export interface ClassFilters {
  academicYearId?: string;
  page?: number;
  limit?: number;
}
