import { apiClient } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  calendarType: 'ETHIOPIAN' | 'GREGORIAN';
}

export interface Class {
  id: string;
  tenantId: string;
  name: string;
  numericOrder: number;
  academicYearId: string;
  academicYear?: AcademicYear;
  sections?: Section[];
  _count?: { sections: number };
}

export interface Section {
  id: string;
  tenantId: string;
  classId: string;
  class?: Class;
  name: string;
  capacity: number;
}

export interface Subject {
  id: string;
  tenantId: string;
  academicYearId?: string;
  name: string;
  nameAmharic?: string;
  code: string;
  type: 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ─── Academic Year API ────────────────────────────────────────────────────────

export const academicYearApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<PaginatedResponse<AcademicYear>>>(
      '/academic-years',
      { params },
    ),

  getById: (id: string) =>
    apiClient.get<ApiResponse<AcademicYear>>(`/academic-years/${id}`),

  create: (dto: Omit<AcademicYear, 'id' | 'tenantId'>) =>
    apiClient.post<ApiResponse<AcademicYear>>('/academic-years', dto),

  update: (id: string, dto: Partial<Omit<AcademicYear, 'id' | 'tenantId'>>) =>
    apiClient.put<ApiResponse<AcademicYear>>(`/academic-years/${id}`, dto),

  delete: (id: string) => apiClient.delete(`/academic-years/${id}`),

  setCurrent: (id: string) =>
    apiClient.put(`/academic-years/${id}/set-current`),
};

// ─── Class API ────────────────────────────────────────────────────────────────

export const classApi = {
  list: (params?: {
    academicYearId?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Class>>>('/classes', {
      params,
    }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Class>>(`/classes/${id}`),

  create: (dto: Omit<Class, 'id' | 'tenantId' | 'sections' | '_count' | 'academicYear'>) =>
    apiClient.post<ApiResponse<Class>>('/classes', dto),

  update: (
    id: string,
    dto: Partial<Omit<Class, 'id' | 'tenantId' | 'sections' | '_count' | 'academicYear'>>,
  ) => apiClient.put<ApiResponse<Class>>(`/classes/${id}`, dto),

  delete: (id: string) => apiClient.delete(`/classes/${id}`),
};

// ─── Section API ──────────────────────────────────────────────────────────────

export const sectionApi = {
  list: (params?: { classId?: string; page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Section>>>('/sections', {
      params,
    }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Section>>(`/sections/${id}`),

  create: (dto: Omit<Section, 'id' | 'tenantId' | 'class'>) =>
    apiClient.post<ApiResponse<Section>>('/sections', dto),

  update: (id: string, dto: Partial<Omit<Section, 'id' | 'tenantId' | 'class'>>) =>
    apiClient.put<ApiResponse<Section>>(`/sections/${id}`, dto),

  delete: (id: string) => apiClient.delete(`/sections/${id}`),
};

// ─── Subject API ──────────────────────────────────────────────────────────────

export const subjectApi = {
  list: (params?: {
    academicYearId?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Subject>>>('/subjects', {
      params,
    }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Subject>>(`/subjects/${id}`),

  create: (dto: Omit<Subject, 'id' | 'tenantId'>) =>
    apiClient.post<ApiResponse<Subject>>('/subjects', dto),

  update: (id: string, dto: Partial<Omit<Subject, 'id' | 'tenantId'>>) =>
    apiClient.put<ApiResponse<Subject>>(`/subjects/${id}`, dto),

  delete: (id: string) => apiClient.delete(`/subjects/${id}`),
};
