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

export type PlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type CalendarType = 'ETHIOPIAN' | 'GREGORIAN';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'TRIAL';
