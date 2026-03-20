import { apiClient } from './api';

export interface Student {
  id: string;
  tenantId: string;
  admissionNumber: string;
  rfidCardNumber?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  bloodGroup?: string;
  nationality: string;
  photo?: string;
  classId: string;
  sectionId: string;
  rollNumber?: string;
  admissionDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'SUSPENDED';
  class?: { id: string; name: string; academicYearId: string };
  section?: { id: string; name: string };
  parentLinks?: ParentLink[];
  documents?: StudentDocument[];
  createdAt: string;
}

export interface ParentLink {
  id: string;
  parentId: string;
  relationship: string;
  isPrimary: boolean;
  parent?: { id: string; firstName: string; lastName: string; email: string; phone?: string };
}

export interface StudentDocument {
  id: string;
  studentId: string;
  name: string;
  filePath: string;
  fileType: string;
  uploadedAt: string;
}

export interface StudentFilters {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const studentApi = {
  list: (params?: StudentFilters) =>
    apiClient.get<ApiResponse<PaginatedResponse<Student>>>('/students', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Student>>(`/students/${id}`),

  create: (dto: Partial<Student>) =>
    apiClient.post<ApiResponse<Student>>('/students', dto),

  update: (id: string, dto: Partial<Student>) =>
    apiClient.put<ApiResponse<Student>>(`/students/${id}`, dto),

  delete: (id: string) =>
    apiClient.delete(`/students/${id}`),

  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return apiClient.post<ApiResponse<Student>>(`/students/${id}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listDocuments: (id: string) =>
    apiClient.get<ApiResponse<StudentDocument[]>>(`/students/${id}/documents`),

  uploadDocument: (id: string, name: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    return apiClient.post<ApiResponse<StudentDocument>>(`/students/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocument: (studentId: string, docId: string) =>
    apiClient.delete(`/students/${studentId}/documents/${docId}`),

  assignParent: (
    studentId: string,
    dto: { parentId: string; relationship: string; isPrimary?: boolean },
  ) => apiClient.post(`/students/${studentId}/parents`, dto),

  removeParent: (studentId: string, parentId: string) =>
    apiClient.delete(`/students/${studentId}/parents/${parentId}`),

  bulkImport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<
      ApiResponse<{ created: number; errors: Array<{ row: number; error: string }> }>
    >('/students/bulk-import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
