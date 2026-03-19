import { Prisma, FeeStatus, FeeFrequency } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import type {
  CreateFeeStructureDto,
  UpdateFeeStructureDto,
  FeeStructureFilters,
  RecordPaymentDto,
  WaiveFeeDto,
  FeeRecordFilters,
  CreateDiscountDto,
  FeeReportFilters,
} from './fee.types';

// ─── Invoice number generation helper ─────────────────────────────────────────
// Format: INV-{TENANT_PREFIX}-{YEAR}-{SEQUENCE padded to 4 digits}
// Tenant prefix = first 3 uppercase letters of tenant name initials, e.g. "AIS" for "Addis International School"
// Must be called inside a serializable transaction to prevent concurrent duplicate invoice numbers.
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const prefix = (tenant?.name ?? 'SCH')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const year = new Date().getFullYear();

  const count = await tx.feeRecord.count({
    where: {
      tenantId,
      invoiceNumber: { startsWith: `INV-${prefix}-${year}-` },
    },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `INV-${prefix}-${year}-${seq}`;
}

// ─── Due date calculation ──────────────────────────────────────────────────────
function calculateDueDate(frequency: FeeFrequency, referenceDate: Date = new Date()): Date {
  const d = new Date(referenceDate);
  switch (frequency) {
    case 'ONE_TIME':
      return d;
    case 'MONTHLY':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'QUARTERLY':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    case 'SEMESTER':
      return d.getMonth() < 6
        ? new Date(d.getFullYear(), 0, 1)
        : new Date(d.getFullYear(), 6, 1);
    case 'ANNUAL':
      return new Date(d.getFullYear(), 8, 1); // Sep 1 — Ethiopian academic year start
    default:
      return d;
  }
}

export const feeService = {
  // ─── Fee Structures ─────────────────────────────────────────────────────────

  async listStructures(tenantId: string, filters: FeeStructureFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FeeStructureWhereInput = { tenantId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.classId) where.classId = filters.classId;
    if (filters.frequency) where.frequency = filters.frequency as FeeFrequency;
    if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';

    const [records, total] = await prisma.$transaction([
      prisma.feeStructure.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          _count: { select: { feeRecords: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.feeStructure.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getStructureById(tenantId: string, id: string) {
    const record = await prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });
    if (!record) throw new NotFoundError('Fee structure not found');
    return record;
  },

  async createStructure(tenantId: string, dto: CreateFeeStructureDto) {
    return prisma.feeStructure.create({
      data: {
        tenantId,
        name: dto.name,
        amount: dto.amount,
        currency: dto.currency ?? 'ETB',
        frequency: dto.frequency as FeeFrequency,
        classId: dto.classId ?? null,
        academicYearId: dto.academicYearId,
        isActive: true,
      },
    });
  },

  async updateStructure(tenantId: string, id: string, dto: UpdateFeeStructureDto) {
    const existing = await prisma.feeStructure.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('Fee structure not found');

    return prisma.feeStructure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency as FeeFrequency }),
        ...(dto.classId !== undefined && { classId: dto.classId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  },

  async deleteStructure(tenantId: string, id: string) {
    const existing = await prisma.feeStructure.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('Fee structure not found');
    // Soft delete — set isActive: false
    return prisma.feeStructure.update({ where: { id }, data: { isActive: false } });
  },

  async generateRecords(tenantId: string, structureId: string) {
    const structure = await prisma.feeStructure.findFirst({
      where: { id: structureId, tenantId, isActive: true },
    });
    if (!structure) throw new NotFoundError('Fee structure not found');

    const studentWhere: Prisma.StudentWhereInput = { tenantId, status: 'ACTIVE' };
    if (structure.classId) studentWhere.classId = structure.classId;

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });

    const existingRecords = await prisma.feeRecord.findMany({
      where: { tenantId, feeStructureId: structureId },
      select: { studentId: true },
    });
    const existingStudentIds = new Set(existingRecords.map((r) => r.studentId));

    const eligibleStudents = students.filter((s) => !existingStudentIds.has(s.id));

    if (eligibleStudents.length === 0) {
      return { created: 0, skipped: students.length };
    }

    const dueDate = calculateDueDate(structure.frequency);

    let created = 0;
    for (const student of eligibleStudents) {
      await prisma.feeRecord.create({
        data: {
          tenantId,
          studentId: student.id,
          feeStructureId: structureId,
          amount: structure.amount,
          dueDate,
          paidAmount: 0,
          status: 'PENDING',
        },
      });
      created++;
    }

    return { created, skipped: existingStudentIds.size };
  },

  // ─── Fee Records ─────────────────────────────────────────────────────────────

  async listRecords(tenantId: string, filters: FeeRecordFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FeeRecordWhereInput = { tenantId };
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.feeStructureId) where.feeStructureId = filters.feeStructureId;
    if (filters.status) where.status = filters.status as FeeStatus;
    if (filters.startDate || filters.endDate) {
      where.dueDate = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    // classId and search filters both target the student relation — merge carefully
    const studentFilter: Prisma.StudentWhereInput = {};
    if (filters.classId) studentFilter.classId = filters.classId;
    if (filters.search) {
      studentFilter.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { admissionNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    const [records, total] = await prisma.$transaction([
      prisma.feeRecord.findMany({
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
          feeStructure: { select: { id: true, name: true, frequency: true, currency: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.feeRecord.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getRecordById(tenantId: string, id: string) {
    const record = await prisma.feeRecord.findFirst({
      where: { id, tenantId },
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
        feeStructure: true,
      },
    });
    if (!record) throw new NotFoundError('Fee record not found');
    return record;
  },

  async recordPayment(tenantId: string, id: string, dto: RecordPaymentDto) {
    return prisma.$transaction(
      async (tx) => {
        const record = await tx.feeRecord.findFirst({ where: { id, tenantId } });
        if (!record) throw new NotFoundError('Fee record not found');
        if (record.status === 'WAIVED') throw new BadRequestError('Cannot pay a waived fee');
        if (record.status === 'PAID') throw new BadRequestError('Fee is already fully paid');

        const newPaidAmount = Number(record.paidAmount) + dto.amount;
        const totalAmount = Number(record.amount);

        if (newPaidAmount > totalAmount) {
          throw new BadRequestError(
            `Payment amount exceeds outstanding balance. Balance: ${totalAmount - Number(record.paidAmount)}`,
          );
        }

        const isPaid = newPaidAmount >= totalAmount;
        const newStatus: FeeStatus = isPaid ? 'PAID' : 'PARTIAL';
        const invoiceNumber =
          record.invoiceNumber ?? (await generateInvoiceNumber(tx, tenantId));

        const updated = await tx.feeRecord.update({
          where: { id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            paidDate: isPaid ? new Date() : record.paidDate,
            invoiceNumber,
            paymentMethod: dto.paymentMethod,
            receiptNumber: dto.receiptNumber ?? record.receiptNumber,
            remarks: dto.remarks ?? record.remarks,
          },
        });

        return { record: updated, invoiceNumber };
      },
      { isolationLevel: 'Serializable' },
    );
  },

  async waiveFee(tenantId: string, id: string, dto: WaiveFeeDto) {
    const record = await prisma.feeRecord.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundError('Fee record not found');
    if (record.status === 'PAID') throw new BadRequestError('Cannot waive a paid fee');
    if (record.status === 'WAIVED') throw new BadRequestError('Fee is already waived');

    return prisma.feeRecord.update({
      where: { id },
      data: { status: 'WAIVED', remarks: dto.reason },
    });
  },

  async updateRecord(
    tenantId: string,
    id: string,
    data: Partial<{ status: FeeStatus; remarks: string; dueDate: Date }>,
  ) {
    const record = await prisma.feeRecord.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundError('Fee record not found');
    return prisma.feeRecord.update({ where: { id }, data });
  },

  // ─── Discounts ───────────────────────────────────────────────────────────────

  async createDiscount(tenantId: string, dto: CreateDiscountDto) {
    const student = await prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundError('Student not found');
    const structure = await prisma.feeStructure.findFirst({ where: { id: dto.feeStructureId, tenantId } });
    if (!structure) throw new NotFoundError('Fee structure not found');

    if (dto.discountType === 'PERCENTAGE' && (dto.discountValue <= 0 || dto.discountValue > 100)) {
      throw new BadRequestError('Percentage discount must be between 1 and 100');
    }

    return prisma.feeDiscount.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        feeStructureId: dto.feeStructureId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        reason: dto.reason,
        approvedById: dto.approvedById,
      },
    });
  },

  async listDiscounts(tenantId: string, studentId?: string) {
    const where: Prisma.FeeDiscountWhereInput = { tenantId };
    if (studentId) where.studentId = studentId;
    return prisma.feeDiscount.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        feeStructure: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async deleteDiscount(tenantId: string, id: string) {
    const discount = await prisma.feeDiscount.findFirst({ where: { id, tenantId } });
    if (!discount) throw new NotFoundError('Discount not found');
    return prisma.feeDiscount.delete({ where: { id } });
  },

  // ─── Fee Reports ─────────────────────────────────────────────────────────────

  async getCollectionSummary(tenantId: string, filters: FeeReportFilters) {
    const where: Prisma.FeeRecordWhereInput = { tenantId };
    if (filters.startDate || filters.endDate) {
      where.dueDate = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }
    const studentFilter: Prisma.StudentWhereInput = {};
    if (filters.classId) studentFilter.classId = filters.classId;
    if (Object.keys(studentFilter).length > 0) where.student = studentFilter;
    if (filters.academicYearId) where.feeStructure = { academicYearId: filters.academicYearId };

    const records = await prisma.feeRecord.findMany({
      where,
      select: { amount: true, paidAmount: true, status: true },
    });

    const totalGenerated = records.reduce((s, r) => s + Number(r.amount), 0);
    const totalCollected = records.reduce((s, r) => s + Number(r.paidAmount), 0);
    const totalWaived = records
      .filter((r) => r.status === 'WAIVED')
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalOutstanding = records
      .filter((r) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(r.status))
      .reduce((s, r) => s + (Number(r.amount) - Number(r.paidAmount)), 0);
    const collectionPercentage =
      totalGenerated > 0 ? Math.round((totalCollected / totalGenerated) * 100) : 0;

    const statusBreakdown = {
      PAID: records.filter((r) => r.status === 'PAID').length,
      PARTIAL: records.filter((r) => r.status === 'PARTIAL').length,
      PENDING: records.filter((r) => r.status === 'PENDING').length,
      OVERDUE: records.filter((r) => r.status === 'OVERDUE').length,
      WAIVED: records.filter((r) => r.status === 'WAIVED').length,
    };

    return {
      totalGenerated,
      totalCollected,
      totalOutstanding,
      totalWaived,
      collectionPercentage,
      statusBreakdown,
      totalRecords: records.length,
    };
  },

  async getStudentLedger(tenantId: string, studentId: string) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    });
    if (!student) throw new NotFoundError('Student not found');

    const records = await prisma.feeRecord.findMany({
      where: { tenantId, studentId },
      include: { feeStructure: { select: { name: true, frequency: true } } },
      orderBy: { dueDate: 'asc' },
    });

    let runningBalance = 0;
    const ledger = records.map((r) => {
      const balance = Number(r.amount) - Number(r.paidAmount);
      runningBalance += balance;
      return { ...r, balance, runningBalance };
    });

    const totalFees = records.reduce((s, r) => s + Number(r.amount), 0);
    const totalPaid = records.reduce((s, r) => s + Number(r.paidAmount), 0);

    return {
      student,
      records: ledger,
      summary: { totalFees, totalPaid, outstanding: totalFees - totalPaid },
    };
  },

  async getOverdueRecords(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await prisma.feeRecord.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        dueDate: { lt: today },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            parentLinks: {
              where: { isPrimary: true },
              take: 1,
              select: { parentId: true, relationship: true },
            },
          },
        },
        feeStructure: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    return records.map((r) => ({
      ...r,
      daysOverdue: Math.floor(
        (now.getTime() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24),
      ),
      balance: Number(r.amount) - Number(r.paidAmount),
    }));
  },

  async getClassSummary(tenantId: string, filters: FeeReportFilters) {
    const where: Prisma.FeeRecordWhereInput = { tenantId };
    if (filters.academicYearId) where.feeStructure = { academicYearId: filters.academicYearId };

    const records = await prisma.feeRecord.findMany({
      where,
      select: {
        amount: true,
        paidAmount: true,
        status: true,
        student: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    const classMap = new Map<
      string,
      { classId: string; className: string; totalFees: number; collected: number }
    >();

    for (const r of records) {
      const classId = r.student.classId;
      const className = r.student.class.name;
      if (!classMap.has(classId)) {
        classMap.set(classId, { classId, className, totalFees: 0, collected: 0 });
      }
      const c = classMap.get(classId)!;
      c.totalFees += Number(r.amount);
      c.collected += Number(r.paidAmount);
    }

    const studentCounts = await prisma.student.groupBy({
      by: ['classId'],
      where: { tenantId, status: 'ACTIVE' },
      _count: { id: true },
    });
    const studentCountMap = new Map(studentCounts.map((s) => [s.classId, s._count.id]));

    return Array.from(classMap.values()).map((c) => ({
      classId: c.classId,
      className: c.className,
      totalStudents: studentCountMap.get(c.classId) ?? 0,
      totalFees: c.totalFees,
      collected: c.collected,
      outstanding: c.totalFees - c.collected,
      collectionPercentage:
        c.totalFees > 0 ? Math.round((c.collected / c.totalFees) * 100) : 0,
    }));
  },
};
