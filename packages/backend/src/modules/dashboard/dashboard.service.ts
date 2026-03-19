import { AttendanceStatus, FeeStatus, StudentStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import type {
  DashboardOverview,
  AttendanceChartData,
  FeeChartData,
  ClassPerformanceData,
} from './dashboard.types';

// ── Date utilities (native JS — no date-fns in this project) ─────────────────

/** Returns midnight local time for a given day offset (0 = today, -1 = yesterday) */
function dayStart(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** Returns start of next day (exclusive upper bound) */
function dayEnd(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  return d;
}

/** ISO date string YYYY-MM-DD using local time (not UTC) to match Ethiopian timezone */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Short weekday label: Mon, Tue, Wed, Thu, Fri, Sat, Sun */
function shortWeekday(d: Date): string {
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[d.getDay()] ?? 'Sun';
}

/** Month label "Jan 2026" */
function monthLabel(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
  return `${months[d.getMonth()] ?? 'Jan'} ${d.getFullYear()}`;
}

/** Human-readable relative time */
function relativeTime(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// ── Trend builder ─────────────────────────────────────────────────────────────

interface AttendanceRow {
  date: Date;
  status: AttendanceStatus;
}

type TrendEntry = { date: string; day: string; percentage: number; present: number; total: number };

function buildDailyTrend(rows: AttendanceRow[], days: number): TrendEntry[] {
  const map = new Map<string, { present: number; total: number }>();

  for (const row of rows) {
    const key = isoDate(row.date);
    const entry = map.get(key) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (row.status === AttendanceStatus.PRESENT || row.status === AttendanceStatus.LATE) {
      entry.present += 1;
    }
    map.set(key, entry);
  }

  const trend: TrendEntry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayStart(-i);
    const key = isoDate(d);
    const entry = map.get(key) ?? { present: 0, total: 0 };
    const pct = entry.total > 0
      ? Math.round((entry.present / entry.total) * 1000) / 10
      : 0;
    trend.push({ date: key, day: shortWeekday(d), percentage: pct, present: entry.present, total: entry.total });
  }
  return trend;
}

function calcAveragePercentage(trend: TrendEntry[]): number {
  const activeDays = trend.filter((t) => t.total > 0);
  if (activeDays.length === 0) return 0;
  const sum = activeDays.reduce((acc, t) => acc + t.percentage, 0);
  return Math.round((sum / activeDays.length) * 10) / 10;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const dashboardService = {

  async getOverview(tenantId: string): Promise<DashboardOverview> {
    const cacheKey = `dashboard:overview:${tenantId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as DashboardOverview;
    } catch {
      // Redis unavailable — proceed without cache
    }

    // ── 1. Student counts ─────────────────────────────────────────────────────
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalStudents, activeStudents, inactiveStudents, newThisMonth] =
      await prisma.$transaction([
        prisma.student.count({ where: { tenantId } }),
        prisma.student.count({ where: { tenantId, status: StudentStatus.ACTIVE } }),
        prisma.student.count({ where: { tenantId, status: { not: StudentStatus.ACTIVE } } }),
        prisma.student.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      ]);

    // Fetch active students with classId + gender for in-memory grouping
    const [activeStudentDetails] = await prisma.$transaction([
      prisma.student.findMany({
        where: { tenantId, status: StudentStatus.ACTIVE },
        select: { classId: true, gender: true },
      }),
    ]);

    // Resolve class names for all unique classIds
    const classIdSet = new Set(activeStudentDetails.map((s) => s.classId));
    const classes = classIdSet.size > 0
      ? await prisma.class.findMany({
          where: { tenantId, id: { in: Array.from(classIdSet) } },
          select: { id: true, name: true },
          orderBy: { numericOrder: 'asc' },
        })
      : [];

    const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

    // Group students by class
    const classCountMap = new Map<string, number>();
    let maleCount = 0, femaleCount = 0;
    for (const s of activeStudentDetails) {
      classCountMap.set(s.classId, (classCountMap.get(s.classId) ?? 0) + 1);
      if (s.gender === 'MALE') maleCount++;
      else if (s.gender === 'FEMALE') femaleCount++;
    }

    const byClass = Array.from(classCountMap.entries()).map(([classId, count]) => ({
      classId,
      className: classNameMap.get(classId) ?? 'Unknown',
      count,
    }));

    const byGender = { MALE: maleCount, FEMALE: femaleCount };

    // ── 2. Today's attendance ──────────────────────────────────────────────────
    const todayStart = dayStart(0);
    const todayEnd = dayEnd(todayStart);

    // Count each attendance status for today individually (avoids groupBy type issues)
    const [todayPresent, todayAbsent, todayLate, todayHalfDay, todayExcused] =
      await prisma.$transaction([
        prisma.attendance.count({ where: { tenantId, date: { gte: todayStart, lt: todayEnd }, status: AttendanceStatus.PRESENT } }),
        prisma.attendance.count({ where: { tenantId, date: { gte: todayStart, lt: todayEnd }, status: AttendanceStatus.ABSENT } }),
        prisma.attendance.count({ where: { tenantId, date: { gte: todayStart, lt: todayEnd }, status: AttendanceStatus.LATE } }),
        prisma.attendance.count({ where: { tenantId, date: { gte: todayStart, lt: todayEnd }, status: AttendanceStatus.HALF_DAY } }),
        prisma.attendance.count({ where: { tenantId, date: { gte: todayStart, lt: todayEnd }, status: AttendanceStatus.EXCUSED } }),
      ]);
    const todayMarked   = todayPresent + todayAbsent + todayLate + todayHalfDay + todayExcused;
    const todayNotMarked = Math.max(0, activeStudents - todayMarked);
    const todayPct = activeStudents > 0
      ? Math.round(((todayPresent + todayLate) / activeStudents) * 1000) / 10
      : 0;

    // ── 3. Weekly & monthly trends ────────────────────────────────────────────
    const weekStart  = dayStart(-6);
    const monthStart = dayStart(-29);

    const [weeklyRows, monthlyRows] = await prisma.$transaction([
      prisma.attendance.findMany({
        where: { tenantId, date: { gte: weekStart, lt: todayEnd } },
        select: { date: true, status: true },
      }),
      prisma.attendance.findMany({
        where: { tenantId, date: { gte: monthStart, lt: todayEnd } },
        select: { date: true, status: true },
      }),
    ]);

    const weeklyTrend  = buildDailyTrend(weeklyRows, 7);
    const monthlyTrend = buildDailyTrend(monthlyRows, 30);

    // ── 4. Fee totals ──────────────────────────────────────────────────────────
    const [feeRows] = await prisma.$transaction([
      prisma.feeRecord.findMany({
        where: { tenantId },
        select: { amount: true, paidAmount: true, status: true },
      }),
    ]);

    let totalGenerated = 0, totalCollected = 0, totalOutstanding = 0,
        totalOverdue = 0, totalWaived = 0;
    const byStatusCount: Record<string, number> = {};

    for (const rec of feeRows) {
      const amount = Number(rec.amount);
      const paid   = Number(rec.paidAmount);
      totalGenerated += amount;
      totalCollected += paid;
      byStatusCount[rec.status] = (byStatusCount[rec.status] ?? 0) + 1;
      if (rec.status === FeeStatus.WAIVED) {
        totalWaived += amount;
      } else if (
        rec.status === FeeStatus.PENDING ||
        rec.status === FeeStatus.PARTIAL ||
        rec.status === FeeStatus.OVERDUE
      ) {
        totalOutstanding += amount - paid;
      }
      if (rec.status === FeeStatus.OVERDUE) {
        totalOverdue += amount - paid;
      }
    }

    const collectionPct = totalGenerated > 0
      ? Math.round((totalCollected / totalGenerated) * 1000) / 10
      : 0;

    // ── 5. Recent activity ─────────────────────────────────────────────────────
    const [recentCheckIns, recentPayments, recentEnrollments] = await prisma.$transaction([
      prisma.attendance.findMany({
        where: { tenantId, checkInTime: { not: null } },
        orderBy: { checkInTime: 'desc' },
        take: 5,
        include: { student: { select: { firstName: true, lastName: true } } },
      }),
      prisma.feeRecord.findMany({
        where: { tenantId, status: { in: [FeeStatus.PAID, FeeStatus.PARTIAL] }, paidDate: { not: null } },
        orderBy: { paidDate: 'desc' },
        take: 5,
        include: { student: { select: { firstName: true, lastName: true } } },
      }),
      prisma.student.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { firstName: true, lastName: true, createdAt: true },
      }),
    ]);

    // Activity items carry a structured `params` field so the frontend can
    // build the display message via i18n rather than consuming a hardcoded
    // English string from the API.
    type ActivityRaw = { type: string; message: string; time: string; icon: string; params: Record<string, string>; _sort: Date };
    const raw: ActivityRaw[] = [];

    for (const a of recentCheckIns) {
      if (a.checkInTime) {
        raw.push({
          type: 'ATTENDANCE_CHECKIN',
          message: '',
          params: { name: `${a.student.firstName} ${a.student.lastName}` },
          time: relativeTime(a.checkInTime),
          icon: 'user-check',
          _sort: a.checkInTime,
        });
      }
    }
    for (const f of recentPayments) {
      if (f.paidDate) {
        raw.push({
          type: 'FEE_PAYMENT',
          message: '',
          params: { name: `${f.student.firstName} ${f.student.lastName}` },
          time: relativeTime(f.paidDate),
          icon: 'credit-card',
          _sort: f.paidDate,
        });
      }
    }
    for (const s of recentEnrollments) {
      raw.push({
        type: 'NEW_STUDENT',
        message: '',
        params: { name: `${s.firstName} ${s.lastName}` },
        time: relativeTime(s.createdAt),
        icon: 'user-plus',
        _sort: s.createdAt,
      });
    }

    raw.sort((a, b) => b._sort.getTime() - a._sort.getTime());
    const recentActivity = raw.slice(0, 10).map(({ _sort: _d, ...rest }) => rest);

    // ── Assemble ───────────────────────────────────────────────────────────────
    const result: DashboardOverview = {
      students: { total: totalStudents, active: activeStudents, inactive: inactiveStudents, newThisMonth, byGender, byClass },
      attendance: {
        today: { total: activeStudents, present: todayPresent, absent: todayAbsent, late: todayLate, notMarked: todayNotMarked, percentage: todayPct },
        thisWeek: {
          averagePercentage: calcAveragePercentage(weeklyTrend),
          dailyTrend: weeklyTrend.map(({ present: _p, total: _t, ...r }) => r),
        },
        thisMonth: {
          averagePercentage: calcAveragePercentage(monthlyTrend),
          dailyTrend: monthlyTrend.map(({ present: _p, total: _t, ...r }) => r),
        },
      },
      fees: {
        totalGenerated: Math.round(totalGenerated * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        totalWaived: Math.round(totalWaived * 100) / 100,
        collectionPercentage: collectionPct,
        byStatus: byStatusCount,
      },
      recentActivity,
    };

    try {
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch {
      // Redis unavailable
    }

    return result;
  },

  // ── Attendance chart ─────────────────────────────────────────────────────────

  async getAttendanceChart(
    tenantId: string,
    period: 'week' | 'month' | 'term',
  ): Promise<AttendanceChartData> {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const periodStart = dayStart(-(days - 1));
    const periodEnd   = dayEnd(dayStart(0));

    const [rows] = await prisma.$transaction([
      prisma.attendance.findMany({
        where: { tenantId, date: { gte: periodStart, lt: periodEnd } },
        select: { date: true, status: true },
      }),
    ]);

    const trend = buildDailyTrend(rows, days);
    return { period, dailyTrend: trend, averagePercentage: calcAveragePercentage(trend) };
  },

  // ── Fee chart ────────────────────────────────────────────────────────────────

  async getFeeChart(
    tenantId: string,
    period: 'month' | 'quarter' | 'year',
  ): Promise<FeeChartData> {
    const days = period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const periodStart = dayStart(-(days - 1));

    const [feeRows] = await prisma.$transaction([
      prisma.feeRecord.findMany({
        where: { tenantId, dueDate: { gte: periodStart } },
        select: { amount: true, paidAmount: true, status: true, dueDate: true, paidDate: true },
      }),
    ]);

    const collected   = new Map<string, number>();
    const outstanding = new Map<string, number>();
    const overdue     = new Map<string, number>();

    for (const rec of feeRows) {
      const amount = Number(rec.amount);
      const paid   = Number(rec.paidAmount);
      const dueLabel = monthLabel(rec.dueDate);

      if (rec.paidDate && (rec.status === FeeStatus.PAID || rec.status === FeeStatus.PARTIAL)) {
        const pl = monthLabel(rec.paidDate);
        collected.set(pl, (collected.get(pl) ?? 0) + paid);
      }
      if (rec.status === FeeStatus.PENDING || rec.status === FeeStatus.PARTIAL || rec.status === FeeStatus.OVERDUE) {
        outstanding.set(dueLabel, (outstanding.get(dueLabel) ?? 0) + (amount - paid));
      }
      if (rec.status === FeeStatus.OVERDUE) {
        overdue.set(dueLabel, (overdue.get(dueLabel) ?? 0) + (amount - paid));
      }
    }

    // Deduplicate months in date order
    const allMonthsOrdered: string[] = [];
    const seen = new Set<string>();
    for (let i = days - 1; i >= 0; i--) {
      const label = monthLabel(dayStart(-i));
      if (!seen.has(label)) { seen.add(label); allMonthsOrdered.push(label); }
    }

    const monthlyData = allMonthsOrdered.map((month) => ({
      month,
      collected:   Math.round((collected.get(month)   ?? 0) * 100) / 100,
      outstanding: Math.round((outstanding.get(month) ?? 0) * 100) / 100,
      overdue:     Math.round((overdue.get(month)     ?? 0) * 100) / 100,
    }));

    return { period, monthlyData };
  },

  // ── Class performance ────────────────────────────────────────────────────────

  async getClassPerformance(tenantId: string): Promise<ClassPerformanceData[]> {
    const thirtyDaysAgo = dayStart(-29);
    const tomorrow      = dayEnd(dayStart(0));

    const [classes] = await prisma.$transaction([
      prisma.class.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { numericOrder: 'asc' },
      }),
    ]);

    if (classes.length === 0) return [];

    const classIds = classes.map((c) => c.id);

    const [students, attendanceRows, feeRows] = await prisma.$transaction([
      prisma.student.findMany({
        where: { tenantId, classId: { in: classIds }, status: StudentStatus.ACTIVE },
        select: { id: true, classId: true },
      }),
      prisma.attendance.findMany({
        where: {
          tenantId,
          date: { gte: thirtyDaysAgo, lt: tomorrow },
          student: { classId: { in: classIds } },
        },
        select: { status: true, student: { select: { classId: true } } },
      }),
      prisma.feeRecord.findMany({
        where: { tenantId, student: { classId: { in: classIds } } },
        select: { amount: true, paidAmount: true, student: { select: { classId: true } } },
      }),
    ]);

    const studentsByClass = new Map<string, number>();
    for (const s of students) {
      studentsByClass.set(s.classId, (studentsByClass.get(s.classId) ?? 0) + 1);
    }

    const attByClass = new Map<string, { present: number; total: number }>();
    for (const a of attendanceRows) {
      const cid = a.student.classId;
      const e = attByClass.get(cid) ?? { present: 0, total: 0 };
      e.total += 1;
      if (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE) e.present += 1;
      attByClass.set(cid, e);
    }

    const feeByClass = new Map<string, { generated: number; collected: number }>();
    for (const f of feeRows) {
      const cid = f.student.classId;
      const e = feeByClass.get(cid) ?? { generated: 0, collected: 0 };
      e.generated += Number(f.amount);
      e.collected += Number(f.paidAmount);
      feeByClass.set(cid, e);
    }

    return classes.map((c) => {
      const att = attByClass.get(c.id) ?? { present: 0, total: 0 };
      const fee = feeByClass.get(c.id) ?? { generated: 0, collected: 0 };
      return {
        classId: c.id,
        className: c.name,
        studentCount: studentsByClass.get(c.id) ?? 0,
        attendancePercentage: att.total > 0
          ? Math.round((att.present / att.total) * 1000) / 10 : 0,
        feeCollectionPercentage: fee.generated > 0
          ? Math.round((fee.collected / fee.generated) * 1000) / 10 : 0,
      };
    });
  },
};
