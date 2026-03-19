import { apiClient } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';
export type AttendanceSource = 'RFID' | 'MANUAL' | 'APP';

export interface Attendance {
  id: string;
  tenantId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource;
  remarks: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    photo: string | null;
    class?: { id: string; name: string };
    section?: { id: string; name: string };
  };
}

export interface TodaySummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  notMarkedCount: number;
  attendancePercentage: number;
}

export interface AttendanceReport {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class?: { name: string };
    section?: { name: string };
  };
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
}

export interface PaginatedAttendanceResponse {
  data: Attendance[];
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

// ─── API ──────────────────────────────────────────────────────────────────────

export const attendanceApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiClient.get<ApiResponse<PaginatedAttendanceResponse>>('/attendance', { params }),

  todaySummary: () =>
    apiClient.get<ApiResponse<TodaySummary>>('/attendance/today-summary'),

  recentCheckIns: () =>
    apiClient.get<ApiResponse<Attendance[]>>('/attendance/recent-checkins'),

  report: (params: Record<string, string | undefined>) =>
    apiClient.get<ApiResponse<AttendanceReport[]>>('/attendance/report', { params }),

  markManual: (data: {
    studentId: string;
    date: string;
    status: AttendanceStatus;
    remarks?: string;
  }) => apiClient.post<ApiResponse<Attendance>>('/attendance/manual', data),

  markBulk: (data: {
    date: string;
    classId: string;
    sectionId: string;
    records: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
  }) => apiClient.post<ApiResponse<{ saved: number }>>('/attendance/bulk', data),
};
