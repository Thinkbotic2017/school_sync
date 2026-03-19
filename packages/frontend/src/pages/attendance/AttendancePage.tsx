import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, Save, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/custom/PageHeader';
import { attendanceApi, AttendanceStatus } from '@/services/attendance.service';
import { classApi, sectionApi } from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
import type { Class, Section } from '@/services/academic.service';
import type { Attendance } from '@/services/attendance.service';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'EXCUSED'];

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  HALF_DAY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  EXCUSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

interface AttendanceRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  currentStatus: AttendanceStatus | null;
  checkInTime: string | null;
  existingRecordId: string | null;
}

export function AttendancePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [date, setDate] = React.useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [selectedSectionId, setSelectedSectionId] = React.useState('');
  // Map of studentId -> pending status
  const [changes, setChanges] = React.useState<Map<string, AttendanceStatus>>(new Map());

  // Fetch classes
  const { data: classesRes } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const classes = unwrapList<Class>(classesRes).data;

  // Fetch sections when class changes
  const { data: sectionsRes } = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionApi.list({ classId: selectedClassId, limit: 100 }),
    enabled: !!selectedClassId,
  });
  const sections = unwrapList<Section>(sectionsRes).data;

  // Reset section when class changes
  React.useEffect(() => {
    setSelectedSectionId('');
    setChanges(new Map());
  }, [selectedClassId]);

  // Reset changes when section/date changes
  React.useEffect(() => {
    setChanges(new Map());
  }, [selectedSectionId, date]);

  // Fetch attendance for selected date/class/section
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: attendanceRes, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', 'daily', dateStr, selectedClassId, selectedSectionId],
    queryFn: () =>
      attendanceApi.list({
        date: dateStr,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
        withStudents: 'true',
        limit: 200,
      }),
    enabled: !!selectedClassId,
  });

  // Build rows from attendance response
  const rows: AttendanceRow[] = React.useMemo(() => {
    const items: Attendance[] =
      (attendanceRes as any)?.data?.data?.data ?? [];
    return items.map((a) => ({
      studentId: a.studentId,
      admissionNumber: a.student?.admissionNumber ?? '',
      firstName: a.student?.firstName ?? '',
      lastName: a.student?.lastName ?? '',
      currentStatus: a.status,
      checkInTime: a.checkInTime,
      existingRecordId: a.id,
    }));
  }, [attendanceRes]);

  const getEffectiveStatus = (row: AttendanceRow): AttendanceStatus | null =>
    changes.has(row.studentId) ? changes.get(row.studentId)! : row.currentStatus;

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setChanges((prev) => {
      const next = new Map(prev);
      next.set(studentId, status);
      return next;
    });
  };

  const handleMarkAllPresent = () => {
    const next = new Map<string, AttendanceStatus>();
    rows.forEach((r) => next.set(r.studentId, 'PRESENT'));
    setChanges(next);
  };

  const { mutate: saveAttendance, isPending: saving } = useMutation({
    mutationFn: () => {
      const records = Array.from(changes.entries()).map(([studentId, status]) => ({
        studentId,
        status,
      }));
      return attendanceApi.markBulk({
        date: dateStr,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        records,
      });
    },
    onSuccess: () => {
      toast.success(t('attendance.daily.saved'));
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setChanges(new Map());
    },
    onError: () => {
      toast.error(t('common.errors.server_error'));
    },
  });

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      id: 'student',
      header: t('students.first_name') + ' / ' + t('students.last_name'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="text-xs text-muted-foreground">#{row.original.admissionNumber}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('students.status'),
      cell: ({ row }) => {
        const effective = getEffectiveStatus(row.original);
        const isDirty = changes.has(row.original.studentId);
        return (
          <Select
            value={effective ?? ''}
            onValueChange={(v) =>
              handleStatusChange(row.original.studentId, v as AttendanceStatus)
            }
          >
            <SelectTrigger
              className={`w-36 h-8 text-xs ${isDirty ? 'ring-2 ring-amber-400' : ''}`}
            >
              <SelectValue placeholder={t('attendance.daily.select_status')} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[s]}`}>
                    {t(`attendance.status.${s}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: 'checkin',
      header: t('attendance.daily.checkin_time'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.checkInTime
            ? format(new Date(row.original.checkInTime), 'HH:mm')
            : '—'}
        </span>
      ),
    },
  ];

  const hasChanges = changes.size > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.daily.title')}
        description={t('attendance.daily.description')}
        actions={
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllPresent}
                className="gap-1.5"
              >
                <CheckSquare className="h-4 w-4" />
                {t('attendance.daily.mark_all_present')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveAttendance()}
              disabled={!hasChanges || saving}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saving ? t('common.actions.loading') : t('attendance.daily.save_changes')}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Date picker */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t('attendance.daily.select_date')}
          </Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-start gap-2 font-normal">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {format(date, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d: Date | undefined) => {
                  if (d) {
                    setDate(d);
                    setCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Class */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t('attendance.daily.select_class')}
          </Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder={t('attendance.daily.select_class')} />
            </SelectTrigger>
            <SelectContent>
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
          <Label className="text-xs font-medium text-muted-foreground">
            {t('attendance.daily.select_section')}
          </Label>
          <Select
            value={selectedSectionId}
            onValueChange={setSelectedSectionId}
            disabled={!selectedClassId || sections.length === 0}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder={t('attendance.daily.select_section')} />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasChanges && (
          <div className="self-end">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {changes.size} {t('attendance.daily.unsaved_changes')}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      {!selectedClassId ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">
          {t('attendance.daily.no_class_selected')}
        </div>
      ) : (
        <DataTable<AttendanceRow>
          columns={columns}
          data={rows}
          isLoading={attendanceLoading}
          emptyMessage={t('attendance.daily.no_students')}
        />
      )}
    </div>
  );
}
