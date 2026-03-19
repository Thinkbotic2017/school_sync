import { CalendarType } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateAcademicYearDto, UpdateAcademicYearDto, AcademicYearFilters } from './academic-year.types';

export class AcademicYearService {
  async list(tenantId: string, filters: AcademicYearFilters) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.academicYear.findMany({
        where: { tenantId },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.academicYear.count({ where: { tenantId } }),
    ]);

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

  async getById(tenantId: string, id: string) {
    const academicYear = await prisma.academicYear.findFirst({
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

  async create(tenantId: string, dto: CreateAcademicYearDto) {
    const data = {
      tenantId,
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      calendarType: dto.calendarType as CalendarType,
      isCurrent: dto.isCurrent ?? false,
    };

    if (data.isCurrent) {
      return prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.academicYear.create({ data });
      });
    }

    return prisma.academicYear.create({ data });
  }

  async update(tenantId: string, id: string, dto: UpdateAcademicYearDto) {
    const existing = await prisma.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    const data = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      ...(dto.calendarType !== undefined && { calendarType: dto.calendarType as CalendarType }),
      ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
    };

    if (dto.isCurrent === true) {
      return prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true, id: { not: id } },
          data: { isCurrent: false },
        });
        return tx.academicYear.update({ where: { id }, data });
      });
    }

    return prisma.academicYear.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    const classCount = await prisma.class.count({ where: { academicYearId: id, tenantId } });
    if (classCount > 0) {
      throw new BadRequestError(
        `Cannot delete academic year with ${classCount} linked class(es). Remove or reassign classes first.`,
      );
    }

    await prisma.academicYear.delete({ where: { id } });
    return { message: 'Academic year deleted successfully' };
  }

  async setCurrent(tenantId: string, id: string) {
    const existing = await prisma.academicYear.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Academic year not found');
    }

    return prisma.$transaction(async (tx) => {
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
