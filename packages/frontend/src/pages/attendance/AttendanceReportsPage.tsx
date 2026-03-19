import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarIcon, Download } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/custom/PageHeader';
import { attendanceApi, AttendanceReport } from '@/services/attendance.service';
import { classApi, sectionApi } from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
import type { Class, Section } from '@/services/academic.service';

function exportToCsv(rows: AttendanceReport[], t: (key: string) => string) {
  const headers = [
    t('students.first_name'),
    t('students.last_name'),
    t('students.admission_number'),
    t('students.class'),
    t('students.section'),
    t('attendance.reports.total_days'),
    t('attendance.reports.present_days'),
    t('attendance.reports.absent_days'),
    t('attendance.reports.late_days'),
    t('attendance.reports.attendance_pct'),
  ];
  const lines = rows.map((r) =>
    [
      r.student.firstName,
      r.student.lastName,
      r.student.admissionNumber,
      r.student.class?.name ?? '',
      r.student.section?.name ?? '',
      r.totalDays,
      r.presentDays,
      r.absentDays,
      r.lateDays,
      `${r.attendancePercentage.toFixed(1)}%`,
    ].join(','),
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AttendanceReportsPage() {
  const { t } = useTranslation();

  const [startDate, setStartDate] = React.useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [startOpen, setStartOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [selectedSectionId, setSelectedSectionId] = React.useState('');

  // Fetch classes
  const { data: classesRes } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const classes = unwrapList<Class>(classesRes).data;

  // Fetch sections
  const { data: sectionsRes } = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionApi.list({ classId: selectedClassId, limit: 100 }),
    enabled: !!selectedClassId,
  });
  const sections = unwrapList<Section>(sectionsRes).data;

  React.useEffect(() => {
    setSelectedSectionId('');
  }, [selectedClassId]);

  const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  const { data: reportRes, isLoading } = useQuery({
    queryKey: ['attendance', 'report', startStr, endStr, selectedClassId, selectedSectionId],
    queryFn: () =>
      attendanceApi.report({
        startDate: startStr,
        endDate: endStr,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
      }),
    enabled: !!startStr && !!endStr,
  });

  const reportData: AttendanceReport[] = (reportRes as any)?.data?.data ?? [];

  // Top 10 for chart
  const chartData = [...reportData]
    .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
    .slice(0, 10)
    .map((r) => ({
      name: `${r.student.firstName} ${r.student.lastName}`.slice(0, 14),
      attendance: parseFloat(r.attendancePercentage.toFixed(1)),
    }));

  const columns: ColumnDef<AttendanceReport>[] = [
    {
      id: 'student',
      header: t('students.first_name') + ' / ' + t('students.last_name'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">
            {row.original.student.firstName} {row.original.student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">#{row.original.student.admissionNumber}</p>
        </div>
      ),
    },
    {
      id: 'class',
      header: t('students.class'),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.student.class?.name ?? '—'}
          {row.original.student.section?.name ? ` / ${row.original.student.section.name}` : ''}
        </span>
      ),
    },
    {
      id: 'totalDays',
      header: t('attendance.reports.total_days'),
      cell: ({ row }) => <span className="text-sm">{row.original.totalDays}</span>,
    },
    {
      id: 'presentDays',
      header: t('attendance.reports.present_days'),
      cell: ({ row }) => (
        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
          {row.original.presentDays}
        </span>
      ),
    },
    {
      id: 'absentDays',
      header: t('attendance.reports.absent_days'),
      cell: ({ row }) => (
        <span className="text-sm text-red-600 dark:text-red-400 font-medium">
          {row.original.absentDays}
        </span>
      ),
    },
    {
      id: 'lateDays',
      header: t('attendance.reports.late_days'),
      cell: ({ row }) => (
        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
          {row.original.lateDays}
        </span>
      ),
    },
    {
      id: 'pct',
      header: t('attendance.reports.attendance_pct'),
      cell: ({ row }) => {
        const pct = row.original.attendancePercentage;
        const color =
          pct >= 90
            ? 'text-green-600 dark:text-green-400'
            : pct >= 75
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400';
        return <span className={`text-sm font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.reports.title')}
        description={t('attendance.reports.description')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(reportData, t)}
            disabled={reportData.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            {t('attendance.reports.export_csv')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Start date */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t('attendance.reports.start_date')}
          </label>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-start gap-2 font-normal">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {startDate ? format(startDate, 'MMM d, yyyy') : t('attendance.reports.start_date')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => {
                  setStartDate(d);
                  setStartOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End date */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t('attendance.reports.end_date')}
          </label>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-start gap-2 font-normal">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {endDate ? format(endDate, 'MMM d, yyyy') : t('attendance.reports.end_date')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => {
                  setEndDate(d);
                  setEndOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Class */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t('attendance.daily.select_class')}
          </label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder={t('attendance.daily.select_class')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('students.filter_class')}</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t('attendance.daily.select_section')}
          </label>
          <Select
            value={selectedSectionId}
            onValueChange={setSelectedSectionId}
            disabled={!selectedClassId || selectedClassId === 'all' || sections.length === 0}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder={t('attendance.daily.select_section')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('students.filter_section')}</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : chartData.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('attendance.reports.chart_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, t('attendance.reports.attendance_pct')]}
                  contentStyle={{
                    fontSize: '12px',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="attendance" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Table */}
      <DataTable<AttendanceReport>
        columns={columns}
        data={reportData}
        isLoading={isLoading}
        emptyMessage={t('attendance.reports.no_data')}
      />
    </div>
  );
}
