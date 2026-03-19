export interface CreateSectionDto {
  classId: string;
  name: string;
  capacity?: number;
}

export interface UpdateSectionDto extends Partial<CreateSectionDto> {}

export interface SectionFilters {
  classId?: string;
  page?: number;
  limit?: number;
}
