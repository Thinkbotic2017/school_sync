import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import {
  Users,
  UserCheck,
  TrendingUp,
  Wallet,
  Plus,
  ClipboardList,
  Bell,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAttendanceSocket, type AttendanceEvent } from '@/hooks/useAttendanceSocket';
import { dashboardApi } from '@/services/dashboard.service';
import { formatETB } from '@/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function KPICardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: 'blue' | 'green' | 'red' | 'amber';
  icon: React.ReactNode;
}

const ACCENT_BORDER: Record<KPICardProps['accent'], string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-emerald-500',
  red: 'border-l-rose-500',
  amber: 'border-l-amber-500',
};
const ACCENT_ICON_BG: Record<KPICardProps['accent'], string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

function KPICard({ label, value, sub, accent, icon }: KPICardProps) {
  return (
    <div
      className={`rounded-xl border-l-4 bg-card px-5 py-4 shadow-sm flex items-start gap-4 ${ACCENT_BORDER[accent]}`}
    >
      <div className={`p-2 rounded-lg shrink-0 ${ACCENT_ICON_BG[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Charts palette ──────────────────────────────────────────────────────────

const AREA_COLOR = '#3b82f6';
const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#64748b'];
const BAR_HIGH = '#10b981';
const BAR_MID = '#f59e0b';
const BAR_LOW = '#ef4444';

function barColor(pct: number) {
  if (pct >= 75) return BAR_HIGH;
  if (pct >= 50) return BAR_MID;
  return BAR_LOW;
}

// ─── Activity icon lookup ────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  ATTENDANCE_CHECKIN: <UserCheck className="h-4 w-4" />,
  ATTENDANCE_CHECKOUT: <UserCheck className="h-4 w-4" />,
  FEE_PAYMENT: <Wallet className="h-4 w-4" />,
  NEW_STUDENT: <Users className="h-4 w-4" />,
};

function activityIcon(type: string) {
  return (
    ICON_MAP[type] ?? <Bell className="h-4 w-4" />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const name = user ? `${user.firstName} ${user.lastName}` : '';

  // Socket for live activity feed
  const { events: socketEvents } = useAttendanceSocket();
  const processedCountRef = useRef(0);

  // REST queries
  const { data: overviewRes, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview(),
    refetchInterval: 60_000,
  });
  const overview = overviewRes?.data?.data;

  const { data: attendanceChartRes, isLoading: attendanceChartLoading } = useQuery({
    queryKey: ['dashboard', 'attendance-chart', 'week'],
    queryFn: () => dashboardApi.attendanceChart('week'),
  });
  const attendanceChart = attendanceChartRes?.data?.data;

  // TEACHER role does not have access to /fee-chart (403). Skip the query.
  const canSeeFees = user?.role !== 'TEACHER';
  const { data: feeChartRes, isLoading: feeChartLoading } = useQuery({
    queryKey: ['dashboard', 'fee-chart', 'month'],
    queryFn: () => dashboardApi.feeChart('month'),
    enabled: canSeeFees,
  });
  const feeChart = feeChartRes?.data?.data;

  const { data: classPerformanceRes, isLoading: classPerformanceLoading } = useQuery({
    queryKey: ['dashboard', 'class-performance'],
    queryFn: () => dashboardApi.classPerformance(),
  });
  const classPerformance = classPerformanceRes?.data?.data ?? [];

  // Merge socket events into activity feed.
  // useAttendanceSocket prepends new events at index 0, so new items are at
  // [0 .. length - processedCountRef.current). Slice from the front to get
  // only unprocessed events; advance the ref by that count.
  const newSocketEvents = socketEvents.slice(0, socketEvents.length - processedCountRef.current);
  if (newSocketEvents.length > 0) processedCountRef.current = socketEvents.length;

  const liveActivity: Array<{ type: string; message: string; time: string; params: Record<string, string> }> =
    newSocketEvents.map((e: AttendanceEvent) => ({
      type: e.action === 'CHECK_IN' ? 'ATTENDANCE_CHECKIN' : 'ATTENDANCE_CHECKOUT',
      message: '',
      params: { name: e.studentName, class: `${e.className}${e.sectionName ? `/${e.sectionName}` : ''}` },
      time: e.checkInTime
        ? new Date(e.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '',
    }));

  const restActivity = (overview?.recentActivity ?? []).map((a) => ({
    type: a.type,
    message: a.message,
    time: a.time,
    params: a.params,
  }));
  const activityFeed = [...liveActivity, ...restActivity].slice(0, 20);

  // Empty state
  const isEmpty = !overviewLoading && overview && overview.students.total === 0;

  // Fee donut data
  const feeDonutData = overview
    ? Object.entries(overview.fees.byStatus).map(([name, value]) => ({ name, value: value as number }))
    : [];

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('dashboard.welcome', { name })}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.overview')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t('dashboard.action_add_student')}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            {t('dashboard.action_attendance')}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {t('dashboard.action_announcement')}
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="rounded-xl border border-dashed bg-muted/30 py-16 text-center space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t('dashboard.empty_title')}</p>
          <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
            {t('dashboard.empty_desc')}
          </p>
          <Button size="sm" className="mt-2">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('dashboard.action_add_student')}
          </Button>
        </div>
      )}

      {/* ── KPI Row ── */}
      {!isEmpty && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          ) : (
            <>
              <KPICard
                label={t('dashboard.kpi_total_students')}
                value={overview?.students.total ?? '—'}
                sub={
                  overview
                    ? `+${overview.students.newThisMonth} ${t('dashboard.new_this_month')}`
                    : undefined
                }
                accent="blue"
                icon={<Users className="h-4 w-4" />}
              />
              <KPICard
                label={t('dashboard.kpi_attendance')}
                value={
                  overview ? `${overview.attendance.today.percentage.toFixed(1)}%` : '—'
                }
                sub={t('dashboard.present_today', {
                  count: overview?.attendance.today.present ?? 0,
                  total: overview?.attendance.today.total ?? 0,
                })}
                accent="green"
                icon={<UserCheck className="h-4 w-4" />}
              />
              <KPICard
                label={t('dashboard.absent_today')}
                value={overview?.attendance.today.absent ?? '—'}
                sub={
                  overview
                    ? `${overview.attendance.today.late} ${t('dashboard.late_today')}`
                    : undefined
                }
                accent="red"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <KPICard
                label={t('dashboard.kpi_fee_collection')}
                value={
                  overview
                    ? `${overview.fees.collectionPercentage.toFixed(1)}%`
                    : '—'
                }
                sub={
                  overview
                    ? `${t('dashboard.collected')} ${formatETB(overview.fees.totalCollected)}`
                    : undefined
                }
                accent="amber"
                icon={<Wallet className="h-4 w-4" />}
              />
            </>
          )}
        </div>
      )}

      {/* ── Charts Row ── */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attendance Trend — spans 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('dashboard.attendance_trend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceChartLoading ? (
                <ChartSkeleton height={220} />
              ) : attendanceChart && attendanceChart.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={attendanceChart.dailyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={AREA_COLOR} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={AREA_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, t('dashboard.kpi_attendance')]}
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="percentage"
                      stroke={AREA_COLOR}
                      strokeWidth={2}
                      fill="url(#attendanceGrad)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  {t('dashboard.no_data_yet')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fee Donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('dashboard.fee_distribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <ChartSkeleton height={220} />
              ) : feeDonutData.length > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={feeDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {feeDonutData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} records`, t(`finance.status.${name}`, { defaultValue: name })]}
                        contentStyle={{
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border)',
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full">
                    {feeDonutData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">
                          {t(`finance.status.${entry.name}`, { defaultValue: entry.name })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  {t('dashboard.no_data_yet')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Bottom Row ── */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Class Performance */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('dashboard.class_performance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classPerformanceLoading ? (
                <ChartSkeleton height={220} />
              ) : classPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(180, classPerformance.length * 36)}>
                  <BarChart
                    layout="vertical"
                    data={classPerformance}
                    margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="className"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}%`, t('dashboard.kpi_attendance')]}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="attendancePercentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {classPerformance.map((entry, index) => (
                        <Cell key={index} fill={barColor(entry.attendancePercentage)} />
                      ))}
                      <LabelList
                        dataKey="attendancePercentage"
                        position="right"
                        formatter={(v: number) => `${v.toFixed(0)}%`}
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                  {t('dashboard.no_data_yet')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('dashboard.recent_activity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                {overviewLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <ActivityRowSkeleton key={i} />)
                ) : activityFeed.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {t('attendance.live.no_events')}
                  </div>
                ) : (
                  activityFeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {activityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug">
                          {t(`dashboard.activity_${item.type}`, {
                            defaultValue: item.params?.name ?? item.message,
                            ...item.params,
                          })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Fee Collection Trend (month) ── */}
      {!isEmpty && canSeeFees && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {t('dashboard.fee_collection_trend')}
              </CardTitle>
              <Badge variant="secondary" className="text-[11px]">
                {t('dashboard.period_month')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {feeChartLoading ? (
              <ChartSkeleton height={200} />
            ) : !feeChart || feeChart.monthlyData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                {t('dashboard.no_data_yet')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={feeChart.monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="overdueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(v) => formatETB(v).replace('ETB ', '')}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatETB(v), name]}
                    contentStyle={{
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name={t('dashboard.collected')}
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#collectedGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="overdue"
                    name={t('finance.status.OVERDUE')}
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#overdueGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
