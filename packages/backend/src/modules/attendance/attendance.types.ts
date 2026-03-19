export interface RfidEventDto {
  cardNumber: string;
  readerId?: string;
  timestamp?: string; // ISO string, defaults to now
}

export interface ManualAttendanceDto {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';
  remarks?: string;
}

export interface BulkAttendanceDto {
  date: string; // YYYY-MM-DD
  classId: string;
  sectionId: string;
  records: Array<{
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';
    remarks?: string;
  }>;
}

export interface AttendanceFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}
