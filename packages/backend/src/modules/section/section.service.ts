import { PrismaClient } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateSectionDto, UpdateSectionDto, SectionFilters } from './section.types';

type DbClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class SectionService {
  async list(tenantId: string, filters: SectionFilters, db: DbClient) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(filters.classId && { classId: filters.classId }),
    };

    // Sequential queries on the same db client (required by RLS).
    // NEVER use Promise.all with Prisma — each call would grab a different
    // pool connection, losing the RLS set_config context.
    const total = await db.section.count({ where });
    const data = await db.section.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
      include: {
        class: { select: { id: true, name: true, numericOrder: true } },
        _count: { select: { students: true } },
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
    const section = await db.section.findFirst({
      where: { id, tenantId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            numericOrder: true,
            academicYear: { select: { id: true, name: true } },
          },
        },
        _count: { select: { students: true } },
      },
    });

    if (!section) {
      throw new NotFoundError('Section not found');
    }

    return section;
  }

  async create(tenantId: string, dto: CreateSectionDto, db: DbClient) {
    // Verify classId belongs to this tenant
    const cls = await db.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) {
      throw new NotFoundError('Class not found');
    }

    const existing = await db.section.findFirst({
      where: { tenantId, classId: dto.classId, name: dto.name },
    });
    if (existing) {
      throw new ConflictError(`Section "${dto.name}" already exists in this class`);
    }

    return db.section.create({
      data: {
        tenantId,
        classId: dto.classId,
        name: dto.name,
        capacity: dto.capacity ?? 40,
      },
      include: {
        class: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSectionDto, db: DbClient) {
    const existing = await db.section.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    if (dto.classId) {
      const cls = await db.class.findFirst({ where: { id: dto.classId, tenantId } });
      if (!cls) {
        throw new NotFoundError('Class not found');
      }
    }

    // Check uniqueness for name/classId combination
    if (dto.name || dto.classId) {
      const newName = dto.name ?? existing.name;
      const newClassId = dto.classId ?? existing.classId;

      const conflict = await db.section.findFirst({
        where: {
          tenantId,
          classId: newClassId,
          name: newName,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictError(`Section "${newName}" already exists in this class`);
      }
    }

    return db.section.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.classId !== undefined && { classId: dto.classId }),
      },
      include: {
        class: { select: { id: true, name: true } },
      },
    });
  }

  async delete(tenantId: string, id: string, db: DbClient) {
    const existing = await db.section.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    const studentCount = await db.student.count({ where: { sectionId: id, tenantId } });
    if (studentCount > 0) {
      throw new BadRequestError(
        `Cannot deactivate section with ${studentCount} linked student(s). Reassign or remove students first.`,
      );
    }

    await db.section.update({ where: { id }, data: { isActive: false } });
    return { message: 'Section deactivated successfully' };
  }
}

export const sectionService = new SectionService();
