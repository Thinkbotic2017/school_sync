import { apiClient } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'ANNUAL';
export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE' | 'OTHER';
export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface FeeStructure {
  id: string;
  tenantId: string;
  name: string;
  amount: number;
  currency: string;
  frequency: FeeFrequency;
  classId: string | null;
  academicYearId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  class?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string };
  _count?: { feeRecords: number };
}

export interface FeeRecord {
  id: string;
  tenantId: string;
  studentId: string;
  feeStructureId: string;
  amount: string;  // Decimal serialized as string by Prisma JSON
  dueDate: string;
  paidAmount: string;  // Decimal serialized as string by Prisma JSON
  paidDate: string | null;
  status: FeeStatus;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class?: { id: string; name: string };
    section?: { id: string; name: string };
  };
  feeStructure?: { id: string; name: string; frequency: FeeFrequency; currency: string };
}

export interface FeeDiscount {
  id: string;
  tenantId: string;
  studentId: string;
  feeStructureId: string;
  discountType: DiscountType;
  discountValue: number;
  reason: string;
  approvedById: string;
  createdAt: string;
  student?: { id: string; firstName: string; lastName: string };
  feeStructure?: { id: string; name: string };
}

export interface CollectionSummary {
  totalGenerated: number;
  totalCollected: number;
  totalOutstanding: number;
  totalWaived: number;
  collectionPercentage: number;
  totalRecords: number;
  statusBreakdown: Record<FeeStatus, number>;
}

export interface StudentLedger {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  records: Array<FeeRecord & { balance: number; runningBalance: number }>;
  summary: { totalFees: number; totalPaid: number; outstanding: number };
}

export interface ClassFeeSummary {
  classId: string;
  className: string;
  totalStudents: number;
  totalFees: number;
  collected: number;
  outstanding: number;
  collectionPercentage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const feeStructureApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<ApiResponse<PaginatedResponse<FeeStructure>>>('/fee-structures', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<FeeStructure>>(`/fee-structures/${id}`),

  create: (data: {
    name: string;
    amount: number;
    currency?: string;
    frequency: FeeFrequency;
    classId?: string;
    academicYearId: string;
  }) => apiClient.post<ApiResponse<FeeStructure>>('/fee-structures', data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      amount: number;
      frequency: FeeFrequency;
      classId: string | null;
      isActive: boolean;
    }>,
  ) => apiClient.put<ApiResponse<FeeStructure>>(`/fee-structures/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/fee-structures/${id}`),

  generateRecords: (id: string) =>
    apiClient.post<ApiResponse<{ created: number; skipped: number }>>(
      `/fee-structures/${id}/generate-records`,
    ),
};

export const feeRecordApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<ApiResponse<PaginatedResponse<FeeRecord>>>('/fee-records', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<FeeRecord>>(`/fee-records/${id}`),

  pay: (
    id: string,
    data: {
      amount: number;
      paymentMethod: PaymentMethod;
      receiptNumber?: string;
      remarks?: string;
    },
  ) =>
    apiClient.post<ApiResponse<{ record: FeeRecord; invoiceNumber: string }>>(
      `/fee-records/${id}/pay`,
      data,
    ),

  waive: (id: string, data: { reason: string; approvedById: string }) =>
    apiClient.post<ApiResponse<FeeRecord>>(`/fee-records/${id}/waive`, data),
};

export const feeReportApi = {
  collectionSummary: (params?: Record<string, string | undefined>) =>
    apiClient.get<ApiResponse<CollectionSummary>>('/fee-reports/collection-summary', { params }),

  studentLedger: (studentId: string) =>
    apiClient.get<ApiResponse<StudentLedger>>(`/fee-reports/student-ledger/${studentId}`),

  overdueReport: (params?: Record<string, string | undefined>) =>
    apiClient.get<ApiResponse<Array<FeeRecord & { daysOverdue: number; balance: number }>>>(
      '/fee-reports/overdue',
      { params },
    ),

  classSummary: (params?: Record<string, string | undefined>) =>
    apiClient.get<ApiResponse<ClassFeeSummary[]>>('/fee-reports/class-summary', { params }),
};
