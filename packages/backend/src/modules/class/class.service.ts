import { PrismaClient } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateClassDto, UpdateClassDto, ClassFilters } from './class.types';

type DbClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class ClassService {
  async list(tenantId: string, filters: ClassFilters, db: DbClient) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
    };

    // Sequential queries on the same db client (required by RLS).
    // NEVER use Promise.all with Prisma — each call would grab a different
    // pool connection, losing the RLS set_config context.
    const total = await db.class.count({ where });
    const data = await db.class.findMany({
      where,
      orderBy: { numericOrder: 'asc' },
      skip,
      take: limit,
      include: {
        academicYear: { select: { id: true, name: true, calendarType: true } },
        _count: { select: { sections: true, students: true } },
      },
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
    const cls = await db.class.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: { select: { id: true, name: true, calendarType: true } },
        sections: { orderBy: { name: 'asc' } },
        _count: { select: { students: true, classSubjects: true } },
      },
    });

    if (!cls) {
      throw new NotFoundError('Class not found');
    }

    return cls;
  }

  async create(tenantId: string, dto: CreateClassDto, db: DbClient) {
    const existing = await db.class.findFirst({
      where: { tenantId, name: dto.name, academicYearId: dto.academicYearId },
    });

    if (existing) {
      throw new ConflictError(
        `A class named "${dto.name}" already exists in this academic year`,
      );
    }

    // Verify the academic year belongs to this tenant
    const academicYear = await db.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
    });
    if (!academicYear) {
      throw new NotFoundError('Academic year not found');
    }

    return db.class.create({
      data: {
        tenantId,
        name: dto.name,
        numericOrder: dto.numericOrder,
        academicYearId: dto.academicYearId,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClassDto, db: DbClient) {
    const existing = await db.class.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Class not found');
    }

    // Check uniqueness if name or academicYearId changes
    if (dto.name || dto.academicYearId) {
      const newName = dto.name ?? existing.name;
      const newAcademicYearId = dto.academicYearId ?? existing.academicYearId;

      const conflict = await db.class.findFirst({
        where: {
          tenantId,
          name: newName,
          academicYearId: newAcademicYearId,
          id: { not: id },
        },
      });

      if (conflict) {
        throw new ConflictError(
          `A class named "${newName}" already exists in this academic year`,
        );
      }
    }

    if (dto.academicYearId) {
      const academicYear = await db.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId },
      });
      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }
    }

    return db.class.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.numericOrder !== undefined && { numericOrder: dto.numericOrder }),
        ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId }),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        sections: { orderBy: { name: 'asc' } },
      },
    });
  }

  async delete(tenantId: string, id: string, db: DbClient) {
    const existing = await db.class.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Class not found');
    }

    const studentCount = await db.student.count({ where: { classId: id, tenantId } });
    if (studentCount > 0) {
      throw new BadRequestError(
        `Cannot deactivate class with ${studentCount} linked student(s). Reassign or remove students first.`,
      );
    }

    await db.class.update({ where: { id }, data: { isActive: false } });
    return { message: 'Class deactivated successfully' };
  }
}

export const classService = new ClassService();
