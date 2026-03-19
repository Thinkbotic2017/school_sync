import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateSectionDto, UpdateSectionDto, SectionFilters } from './section.types';

export class SectionService {
  async list(tenantId: string, filters: SectionFilters) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(filters.classId && { classId: filters.classId }),
    };

    const [data, total] = await Promise.all([
      prisma.section.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          class: { select: { id: true, name: true, numericOrder: true } },
          _count: { select: { students: true } },
        },
      }),
      prisma.section.count({ where }),
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
    const section = await prisma.section.findFirst({
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

  async create(tenantId: string, dto: CreateSectionDto) {
    // Verify classId belongs to this tenant
    const cls = await prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) {
      throw new NotFoundError('Class not found');
    }

    const existing = await prisma.section.findFirst({
      where: { tenantId, classId: dto.classId, name: dto.name },
    });
    if (existing) {
      throw new ConflictError(`Section "${dto.name}" already exists in this class`);
    }

    return prisma.section.create({
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

  async update(tenantId: string, id: string, dto: UpdateSectionDto) {
    const existing = await prisma.section.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    if (dto.classId) {
      const cls = await prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
      if (!cls) {
        throw new NotFoundError('Class not found');
      }
    }

    // Check uniqueness for name/classId combination
    if (dto.name || dto.classId) {
      const newName = dto.name ?? existing.name;
      const newClassId = dto.classId ?? existing.classId;

      const conflict = await prisma.section.findFirst({
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

    return prisma.section.update({
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

  async delete(tenantId: string, id: string) {
    const existing = await prisma.section.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    const studentCount = await prisma.student.count({ where: { sectionId: id, tenantId } });
    if (studentCount > 0) {
      throw new BadRequestError(
        `Cannot delete section with ${studentCount} linked student(s). Reassign or remove students first.`,
      );
    }

    await prisma.section.delete({ where: { id } });
    return { message: 'Section deleted successfully' };
  }
}

export const sectionService = new SectionService();
