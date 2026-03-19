import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { attendanceApi } from '@/services/attendance.service';
import { useAttendanceSocket, AttendanceEvent } from '@/hooks/useAttendanceSocket';
import type { Attendance } from '@/services/attendance.service';

type DisplayEvent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  photo: string | null;
  status: Attendance['status'];
  checkInTime: string | null;
  checkOutTime: string | null;
  source: Attendance['source'];
};

const STATUS_CLASS: Record<Attendance['status'], string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  HALF_DAY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  EXCUSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

function toDisplayEvent(a: Attendance): DisplayEvent {
  return {
    studentId: a.student?.id ?? a.studentId,
    studentName: a.student ? `${a.student.firstName} ${a.student.lastName}` : '',
    admissionNumber: a.student?.admissionNumber ?? '',
    className: a.student?.class?.name ?? '',
    sectionName: a.student?.section?.name ?? '',
    photo: a.student?.photo ?? null,
    status: a.status,
    checkInTime: a.checkInTime,
    checkOutTime: a.checkOutTime,
    source: a.source,
  };
}

function fromSocketEvent(e: AttendanceEvent): DisplayEvent {
  return {
    studentId: e.studentId,
    studentName: e.studentName,
    admissionNumber: e.admissionNumber,
    className: e.className,
    sectionName: e.sectionName,
    photo: e.photo,
    status: e.status,
    checkInTime: e.checkInTime,
    checkOutTime: e.checkOutTime,
    source: e.source,
  };
}

export function LiveMonitorPage() {
  const { t } = useTranslation();
  const { events: socketEvents, connected } = useAttendanceSocket();
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance', 'today-summary'],
    queryFn: () => attendanceApi.todaySummary(),
    refetchInterval: 30_000,
  });
  const summary = (summaryRes as any)?.data?.data;

  const { data: recentRes } = useQuery({
    queryKey: ['attendance', 'recent-checkins'],
    queryFn: () => attendanceApi.recentCheckIns(),
  });

  // Seed initial events from REST response
  useEffect(() => {
    if (initialLoaded) return;
    const items: Attendance[] = (recentRes as any)?.data?.data ?? [];
    if (items.length > 0) {
      setDisplayEvents(items.map(toDisplayEvent));
      setInitialLoaded(true);
    }
  }, [recentRes, initialLoaded]);

  // Prepend new socket events
  useEffect(() => {
    if (socketEvents.length === 0) return;
    setDisplayEvents((prev) => [fromSocketEvent(socketEvents[0]), ...prev].slice(0, 50));
  }, [socketEvents]);

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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('attendance.live.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('attendance.live.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm shrink-0 mt-1">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">
                {t('attendance.live.connected')}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400 font-medium">
                {t('attendance.live.disconnected')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {summaryLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mx-auto mb-2" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{summary?.totalStudents ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('attendance.live.total')}</div>
              </CardContent>
            </Card>
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {summary?.presentCount ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('attendance.live.present')}</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {summary?.absentCount ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('attendance.live.absent')}</div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 dark:border-yellow-800">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {summary?.lateCount ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('attendance.live.late')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-muted-foreground">
                  {summary?.notMarkedCount ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('attendance.live.not_marked')}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Live Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('attendance.live.feed_title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
            {displayEvents.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {t('attendance.live.no_events')}
              </div>
            ) : (
              displayEvents.map((event, i) => (
                <div
                  key={`${event.studentId}-${event.checkInTime ?? event.checkOutTime ?? i}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={event.photo ?? undefined} />
                    <AvatarFallback className="text-xs font-semibold">
                      {event.studentName.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.className}
                      {event.sectionName ? ` — ${event.sectionName}` : ''}
                      {event.admissionNumber ? ` · #${event.admissionNumber}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[event.status]}`}
                    >
                      {t(`attendance.status.${event.status}`)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {event.checkInTime
                        ? `In: ${formatTime(event.checkInTime)}`
                        : event.checkOutTime
                        ? `Out: ${formatTime(event.checkOutTime)}`
                        : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
