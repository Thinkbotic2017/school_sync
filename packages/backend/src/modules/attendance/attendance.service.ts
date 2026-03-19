import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { getIo } from '../../config/socket';
import { notificationQueue } from '../../config/queue';
import type {
  RfidEventDto,
  ManualAttendanceDto,
  BulkAttendanceDto,
  AttendanceFilters,
} from './attendance.types';

const DEBOUNCE_MINUTES = 5;

export const attendanceService = {
  async processRfidEvent(tenantId: string, dto: RfidEventDto) {
    const eventTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const today = new Date(eventTime);
    today.setHours(0, 0, 0, 0);

    // 1. Look up student by RFID card number (outside transaction — read-only)
    // NOTE: When RFID encryption is live, decrypt cardNumber before lookup
    const student = await prisma.student.findFirst({
      where: { tenantId, rfidCardNumber: dto.cardNumber },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    // Log the raw event regardless of outcome (outside transaction — best-effort)
    const eventLog = await prisma.rfidEventLog.create({
      data: {
        tenantId,
        cardNumber: dto.cardNumber,
        readerId: dto.readerId,
        timestamp: eventTime,
        processed: false,
        studentId: student?.id ?? null,
        action: student ? null : 'UNKNOWN_CARD',
      },
    });

    if (!student) {
      return { ignored: true, reason: 'unknown_card' };
    }

    // 2. Get school config for late detection
    const config = await prisma.schoolConfig.findUnique({ where: { tenantId } });
    const startTime = config?.schoolStartTime ?? '08:00';
    const graceMinutes = config?.graceMinutes ?? 15;

    // Use UTC offset for Africa/Addis_Ababa (UTC+3) until date-fns-tz is added (Phase 6)
    const EAT_OFFSET_MINUTES = 3 * 60;
    const localMinutes =
      ((eventTime.getUTCHours() * 60 + eventTime.getUTCMinutes()) + EAT_OFFSET_MINUTES) % (24 * 60);
    const [startHour, startMin] = startTime.split(':').map(Number);
    const cutoffMinutes = (startHour ?? 8) * 60 + (startMin ?? 0) + graceMinutes;
    const isLate = localMinutes > cutoffMinutes;

    // 3–5. Atomic transaction: debounce check + attendance upsert + log update
    // Wrapping in a transaction prevents duplicate check-ins from concurrent taps.
    const result = await prisma.$transaction(async (tx) => {
      // Debounce: check for a processed event for this student in the last DEBOUNCE_MINUTES
      const debounceWindow = new Date(eventTime.getTime() - DEBOUNCE_MINUTES * 60 * 1000);
      const recentLog = await tx.rfidEventLog.findFirst({
        where: {
          tenantId,
          studentId: student.id,
          timestamp: { gte: debounceWindow, lt: eventTime },
          processed: true,
        },
        orderBy: { timestamp: 'desc' },
      });

      if (recentLog) {
        return { debounced: true };
      }

      // Get or create attendance record for today
      const existingAttendance = await tx.attendance.findUnique({
        where: { tenantId_studentId_date: { tenantId, studentId: student.id, date: today } },
      });

      let attendance;
      let action: 'CHECK_IN' | 'CHECK_OUT' | 'IGNORED';

      if (!existingAttendance) {
        attendance = await tx.attendance.create({
          data: {
            tenantId,
            studentId: student.id,
            date: today,
            status: isLate ? 'LATE' : 'PRESENT',
            checkInTime: eventTime,
            source: 'RFID',
            rfidReaderId: dto.readerId,
          },
        });
        action = 'CHECK_IN';
      } else if (existingAttendance.checkInTime && !existingAttendance.checkOutTime) {
        attendance = await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: { checkOutTime: eventTime },
        });
        action = 'CHECK_OUT';
      } else {
        // Already complete — mark log as IGNORED using the specific log entry id
        await tx.rfidEventLog.update({
          where: { id: eventLog.id },
          data: { action: 'IGNORED' },
        });
        return { debounced: false, ignored: true };
      }

      // Mark the specific log entry as processed (use id, not updateMany)
      await tx.rfidEventLog.update({
        where: { id: eventLog.id },
        data: { processed: true, action },
      });

      return { debounced: false, ignored: false, action, attendance };
    });

    if (result.debounced) {
      return { ignored: true, reason: 'debounce' };
    }
    if (result.ignored) {
      return { ignored: true, reason: 'already_complete' };
    }

    const { action, attendance } = result as {
      action: 'CHECK_IN' | 'CHECK_OUT';
      attendance: { status: string; checkInTime: Date | null; checkOutTime: Date | null };
    };

    // 6. Emit Socket.IO event — includes all fields the frontend AttendanceEvent interface requires
    try {
      const io = getIo();
      io.of('/attendance').to(tenantId).emit('attendance:update', {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        photo: student.photo ?? null,
        className: student.class.name,
        sectionName: student.section.name,
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        source: 'RFID',
        action,
      });
    } catch {
      // Socket.IO may not be initialized in test environments — non-fatal
    }

    // 7. Queue parent notification
    const parentLinks = await prisma.parentStudent.findMany({
      where: { tenantId, studentId: student.id },
      select: { parentId: true },
    });

    if (parentLinks.length > 0) {
      await notificationQueue.add('attendance-notification', {
        type: action === 'CHECK_IN' ? 'ATTENDANCE_CHECKIN' : 'ATTENDANCE_CHECKOUT',
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        parentIds: parentLinks.map((l) => l.parentId),
        time: eventTime.toISOString(),
        tenantId,
      });
    }

    return {
      ignored: false,
      action,
      student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
      attendance: {
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
      },
    };
  },

  async markManual(tenantId: string, _markedBy: string, dto: ManualAttendanceDto) {
    const student = await prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundError('Student not found');

    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.upsert({
      where: {
        tenantId_studentId_date: { tenantId, studentId: dto.studentId, date },
      },
      update: { status: dto.status, remarks: dto.remarks, source: 'MANUAL' },
      create: {
        tenantId,
        studentId: dto.studentId,
        date,
        status: dto.status,
        source: 'MANUAL',
        remarks: dto.remarks,
      },
    });

    try {
      const io = getIo();
      io.of('/attendance').to(tenantId).emit('attendance:update', {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        status: attendance.status,
        date: attendance.date,
        source: 'MANUAL',
      });
    } catch {
      // Non-fatal
    }

    return attendance;
  },

  async markBulk(tenantId: string, dto: BulkAttendanceDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    // P0-3: Validate all studentIds belong to the given class/section
    const validStudents = await prisma.student.findMany({
      where: { tenantId, classId: dto.classId, sectionId: dto.sectionId },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));
    const invalidIds = dto.records.filter((r) => !validIds.has(r.studentId)).map((r) => r.studentId);
    if (invalidIds.length > 0) {
      throw new BadRequestError(
        `Student IDs do not belong to the specified class/section: ${invalidIds.join(', ')}`,
      );
    }

    const results = await prisma.$transaction(
      dto.records.map((record) =>
        prisma.attendance.upsert({
          where: {
            tenantId_studentId_date: { tenantId, studentId: record.studentId, date },
          },
          update: { status: record.status, remarks: record.remarks, source: 'MANUAL' },
          create: {
            tenantId,
            studentId: record.studentId,
            date,
            status: record.status,
            source: 'MANUAL',
            remarks: record.remarks,
          },
        }),
      ),
    );

    return { saved: results.length };
  },

  async list(tenantId: string, filters: AttendanceFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = { tenantId };

    if (filters.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      where.date = d;
    } else if (filters.startDate ?? filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.status) where.status = filters.status as Prisma.AttendanceWhereInput['status'];

    if (filters.classId ?? filters.sectionId) {
      where.student = {
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      };
    }

    // $transaction pins both queries to same connection (preserves RLS context)
    const [records, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { checkInTime: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getReport(
    tenantId: string,
    filters: {
      startDate: string;
      endDate: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
    },
  ) {
    // P1-1: Guard against full-table scans on large date ranges
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      throw new BadRequestError('Report date range cannot exceed 90 days');
    }

    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      date: {
        gte: start,
        lte: end,
      },
    };

    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.classId ?? filters.sectionId) {
      where.student = {
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      };
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate by student
    const studentMap = new Map<
      string,
      {
        student: (typeof records)[number]['student'];
        present: number;
        absent: number;
        late: number;
        excused: number;
        halfDay: number;
        total: number;
      }
    >();

    for (const record of records) {
      const key = record.studentId;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          student: record.student,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          halfDay: 0,
          total: 0,
        });
      }
      const s = studentMap.get(key)!;
      s.total++;
      if (record.status === 'PRESENT') s.present++;
      else if (record.status === 'ABSENT') s.absent++;
      else if (record.status === 'LATE') s.late++;
      else if (record.status === 'EXCUSED') s.excused++;
      else if (record.status === 'HALF_DAY') s.halfDay++;
    }

    return Array.from(studentMap.values()).map((s) => ({
      student: s.student,
      totalDays: s.total,
      presentDays: s.present,
      absentDays: s.absent,
      lateDays: s.late,
      excusedDays: s.excused,
      halfDayDays: s.halfDay,
      attendancePercentage:
        s.total > 0
          ? Math.round(((s.present + s.late + s.halfDay) / s.total) * 100)
          : 0,
    }));
  },

  async getTodaySummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use $transaction to pin all queries to one connection (preserves RLS context)
    const [totalStudents, presentCount, absentCount, lateCount] = await prisma.$transaction([
      prisma.student.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.attendance.count({ where: { tenantId, date: today, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { tenantId, date: today, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { tenantId, date: today, status: 'LATE' } }),
    ]);

    const markedCount = presentCount + absentCount + lateCount;

    return {
      totalStudents,
      presentCount,
      absentCount,
      lateCount,
      notMarkedCount: Math.max(0, totalStudents - markedCount),
      attendancePercentage:
        totalStudents > 0
          ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
          : 0,
    };
  },

  async getRecentCheckIns(tenantId: string, limit = 5) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.attendance.findMany({
      where: { tenantId, date: today, checkInTime: { not: null } },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
      take: limit,
    });
  },
};
