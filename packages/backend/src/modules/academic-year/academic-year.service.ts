import { CalendarType, PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateAcademicYearDto, UpdateAcademicYearDto, AcademicYearFilters } from './academic-year.types';

type DbClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class AcademicYearService {
  async list(tenantId: string, filters: AcademicYearFilters, db: DbClient) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { tenantId };

    // Sequential queries on the same db client (required by RLS).
    // NEVER use Promise.all with Prisma — each call would grab a different
    // pool connection, losing the RLS set_config context.
    const total = await db.academicYear.count({ where });
    const data = await db.academicYear.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(tenantId: string, id: string, db: DbClient) {
    const academicYear = await db.academicYear.findFirst({
      where: { id, tenantId },
      include: {
        classes: {
          orderBy: { numericOrder: 'asc' },
        },
      },
    });

    if (!academicYear) {
      throw new NotFoundError('Academic year not found');
    }

    return academicYear;
  }

  async create(tenantId: string, dto: CreateAcademicYearDto, db: DbClient) {
    const data = {
      tenantId,
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      calendarType: dto.calendarType as CalendarType,
      isCurrent: dto.isCurrent ?? false,
    };

    if (data.isCurrent) {
      return (db as PrismaClient).$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.academicYear.create({ data });
      });
    }

    return db.academicYear.create({ data });
  }

  async update(tenantId: string, id: string, dto: UpdateAcademicYearDto, db: DbClient) {
    const existing = await db.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    const updateData = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      ...(dto.calendarType !== undefined && { calendarType: dto.calendarType as CalendarType }),
      ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
    };

    if (dto.isCurrent === true) {
      return (db as PrismaClient).$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true, id: { not: id } },
          data: { isCurrent: false },
        });
        return tx.academicYear.update({ where: { id }, data: updateData });
      });
    }

    return db.academicYear.update({ where: { id }, data: updateData });
  }

  async delete(tenantId: string, id: string, db: DbClient) {
    const existing = await db.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    const classCount = await db.class.count({ where: { academicYearId: id, tenantId } });
    if (classCount > 0) {
      throw new BadRequestError(
        `Cannot deactivate academic year with ${classCount} linked class(es). Deactivate or reassign classes first.`,
      );
    }

    await db.academicYear.update({ where: { id }, data: { isActive: false } });
    return { message: 'Academic year deactivated successfully' };
  }

  async setCurrent(tenantId: string, id: string, db: DbClient) {
    const existing = await db.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    return (db as PrismaClient).$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });
    });
  }
}

export const academicYearService = new AcademicYearService();
