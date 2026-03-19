import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { attendanceApi } from '@/services/attendance.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Attendance } from '@/services/attendance.service';

const STATUS_CLASS: Record<Attendance['status'], string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  HALF_DAY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  EXCUSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const name = user ? `${user.firstName} ${user.lastName}` : '';

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance', 'today-summary'],
    queryFn: () => attendanceApi.todaySummary(),
    refetchInterval: 60_000,
  });
  const summary = (summaryRes as any)?.data?.data;

  const { data: recentRes, isLoading: recentLoading } = useQuery({
    queryKey: ['attendance', 'recent-checkins'],
    queryFn: () => attendanceApi.recentCheckIns(),
  });
  const recentCheckIns: Attendance[] = (recentRes as any)?.data?.data ?? [];

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return format(new Date(iso), 'HH:mm');
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.welcome', { name })}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('dashboard.overview')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">
            {t('dashboard.kpi_total_students')}
          </p>
          {summaryLoading ? (
            <Skeleton className="h-8 w-16 mt-2" />
          ) : (
            <p className="text-3xl font-bold mt-2 text-foreground">
              {summary?.totalStudents ?? '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.today')}</p>
        </div>

        {/* Total Staff — placeholder */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">
            {t('dashboard.kpi_total_staff')}
          </p>
          <p className="text-3xl font-bold mt-2 text-foreground">—</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.no_data_yet')}</p>
        </div>

        {/* Attendance % */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">
            {t('dashboard.kpi_attendance')}
          </p>
          {summaryLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <p className="text-3xl font-bold mt-2 text-foreground">
              {summary
                ? `${summary.attendancePercentage.toFixed(1)}%`
                : '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.today')}</p>
        </div>

        {/* Fee Collection — placeholder */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">
            {t('dashboard.kpi_fee_collection')}
          </p>
          <p className="text-3xl font-bold mt-2 text-foreground">—</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.no_data_yet')}</p>
        </div>
      </div>

      {/* Today's Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('dashboard.todays_activity')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))
            ) : recentCheckIns.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('attendance.live.no_events')}
              </div>
            ) : (
              recentCheckIns.slice(0, 20).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={a.student?.photo ?? undefined} />
                    <AvatarFallback className="text-xs font-semibold">
                      {a.student?.firstName?.charAt(0).toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.student
                        ? `${a.student.firstName} ${a.student.lastName}`
                        : a.studentId}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.student?.class?.name ?? ''}
                      {a.student?.section?.name ? ` / ${a.student.section.name}` : ''}
                      {a.checkInTime ? ` · ${formatTime(a.checkInTime)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[a.status]}`}
                  >
                    {t(`attendance.status.${a.status}`)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
