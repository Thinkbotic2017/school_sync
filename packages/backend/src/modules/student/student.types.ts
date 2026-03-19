export interface CreateStudentDto {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: 'MALE' | 'FEMALE';
  bloodGroup?: string;
  nationality?: string;
  classId: string;
  sectionId: string;
  rollNumber?: string;
  rfidCardNumber?: string;
  admissionDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'SUSPENDED';
}

export interface UpdateStudentDto extends Partial<CreateStudentDto> {}

export interface StudentFilters {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  /** When true, includes soft-deleted (INACTIVE) students in the list response. */
  includeInactive?: boolean;
}

export interface AssignParentDto {
  parentId: string;
  relationship: string;
  isPrimary?: boolean;
}

export interface AddDocumentDto {
  name: string;
  filePath: string;
  fileType: string;
}

export interface BulkImportResult {
  created: number;
  errors: Array<{ row: number; error: string }>;
}
