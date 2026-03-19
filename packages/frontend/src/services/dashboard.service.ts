import { apiClient } from './api';

export interface DashboardOverview {
  students: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
    byGender: { MALE: number; FEMALE: number };
    byClass: Array<{ classId: string; className: string; count: number }>;
  };
  attendance: {
    today: {
      total: number;
      present: number;
      absent: number;
      late: number;
      notMarked: number;
      percentage: number;
    };
    thisWeek: {
      averagePercentage: number;
      dailyTrend: Array<{ date: string; day: string; percentage: number }>;
    };
    thisMonth: {
      averagePercentage: number;
      dailyTrend: Array<{ date: string; day: string; percentage: number }>;
    };
  };
  fees: {
    totalGenerated: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    totalWaived: number;
    collectionPercentage: number;
    byStatus: Record<string, number>;
  };
  recentActivity: Array<{
    type: string;
    message: string;
    time: string;
    icon: string;
    params: Record<string, string>;
  }>;
}

export interface AttendanceChartData {
  period: string;
  dailyTrend: Array<{
    date: string;
    day: string;
    percentage: number;
    present: number;
    total: number;
  }>;
  averagePercentage: number;
}

export interface FeeChartData {
  period: string;
  monthlyData: Array<{
    month: string;
    collected: number;
    outstanding: number;
    overdue: number;
  }>;
}

export interface ClassPerformanceData {
  classId: string;
  className: string;
  studentCount: number;
  attendancePercentage: number;
  feeCollectionPercentage: number;
}

export const dashboardApi = {
  overview: () =>
    apiClient.get<{ success: boolean; data: DashboardOverview }>('/dashboard/overview'),

  attendanceChart: (period: 'week' | 'month' | 'term' = 'week') =>
    apiClient.get<{ success: boolean; data: AttendanceChartData }>(
      `/dashboard/attendance-chart?period=${period}`,
    ),

  feeChart: (period: 'month' | 'quarter' | 'year' = 'month') =>
    apiClient.get<{ success: boolean; data: FeeChartData }>(
      `/dashboard/fee-chart?period=${period}`,
    ),

  classPerformance: () =>
    apiClient.get<{ success: boolean; data: ClassPerformanceData[] }>(
      '/dashboard/class-performance',
    ),
};
