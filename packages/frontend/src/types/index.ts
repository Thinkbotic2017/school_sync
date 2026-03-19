export interface User {
  id: string;
  tenantId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  tenant: TenantInfo;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PARTNER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'PRINCIPAL'
  | 'TEACHER'
  | 'ACCOUNTANT'
  | 'PARENT'
  | 'STUDENT'
  | 'TRANSPORT_MANAGER'
  | 'BUS_DRIVER'
  | 'RECEPTIONIST';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  locale: string;
  calendarType: 'ETHIOPIAN' | 'GREGORIAN';
  timezone: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
