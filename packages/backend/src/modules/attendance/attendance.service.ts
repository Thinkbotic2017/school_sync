import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
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

    // 1. Look up student by RFID card number
    // NOTE: When RFID encryption is live, decrypt cardNumber before lookup
    const student = await prisma.student.findFirst({
      where: { tenantId, rfidCardNumber: dto.cardNumber },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    // Log the raw event regardless of outcome
    await prisma.rfidEventLog.create({
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

    // 2. Debounce check: any processed event for this student in last DEBOUNCE_MINUTES?
    const debounceWindow = new Date(eventTime.getTime() - DEBOUNCE_MINUTES * 60 * 1000);
    const recentLog = await prisma.rfidEventLog.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        timestamp: { gte: debounceWindow, lt: eventTime },
        processed: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    if (recentLog) {
      return { ignored: true, reason: 'debounce' };
    }

    // 3. Get school config for late detection
    const config = await prisma.schoolConfig.findUnique({ where: { tenantId } });
    const startTime = config?.schoolStartTime ?? '08:00';
    const graceMinutes = config?.graceMinutes ?? 15;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const cutoffMinutes = (startHour ?? 8) * 60 + (startMin ?? 0) + graceMinutes;
    const checkInMinutes = eventTime.getHours() * 60 + eventTime.getMinutes();
    const isLate = checkInMinutes > cutoffMinutes;

    // 4. Get or create attendance record for today
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        tenantId_studentId_date: { tenantId, studentId: student.id, date: today },
      },
    });

    let attendance;
    let action: 'CHECK_IN' | 'CHECK_OUT' | 'IGNORED';

    if (!existingAttendance) {
      // First tap = CHECK_IN
      attendance = await prisma.attendance.create({
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
      // Second tap = CHECK_OUT
      attendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: { checkOutTime: eventTime },
      });
      action = 'CHECK_OUT';
    } else {
      // Already has both or no check-in — ignore
      await prisma.rfidEventLog.updateMany({
        where: { tenantId, cardNumber: dto.cardNumber, timestamp: eventTime },
        data: { action: 'IGNORED' },
      });
      return { ignored: true, reason: 'already_complete' };
    }

    // 5. Mark event log as processed
    await prisma.rfidEventLog.updateMany({
      where: { tenantId, studentId: student.id, timestamp: eventTime },
      data: { processed: true, action },
    });

    // 6. Emit Socket.IO event to the /attendance namespace room for this tenant
    try {
      const io = getIo();
      io.of('/attendance').to(tenantId).emit('attendance:update', {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
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

    const [records, total] = await Promise.all([
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
    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      date: {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
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
      attendancePercentage:
        s.total > 0
          ? Math.round(((s.present + s.late + s.halfDay) / s.total) * 100)
          : 0,
    }));
  },

  async getTodaySummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStudents, presentCount, absentCount, lateCount] = await Promise.all([
      prisma.student.count({ where: { tenantId, status: { not: 'INACTIVE' } } }),
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
