export interface CreateFeeStructureDto {
  name: string;
  amount: number;
  currency?: string;
  frequency: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'ANNUAL';
  classId?: string;
  academicYearId: string;
}

export interface UpdateFeeStructureDto {
  name?: string;
  amount?: number;
  currency?: string;
  frequency?: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'ANNUAL';
  classId?: string | null;
  isActive?: boolean;
}

export interface FeeStructureFilters {
  academicYearId?: string;
  classId?: string;
  frequency?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export interface RecordPaymentDto {
  amount: number;
  paymentMethod: string; // CASH | BANK_TRANSFER | MOBILE_MONEY | CHEQUE | OTHER
  receiptNumber?: string;
  remarks?: string;
}

export interface WaiveFeeDto {
  reason: string;
  approvedById: string;
}

export interface FeeRecordFilters {
  studentId?: string;
  feeStructureId?: string;
  status?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDiscountDto {
  studentId: string;
  feeStructureId: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  reason: string;
  approvedById: string;
}

export interface FeeReportFilters {
  academicYearId?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
}
