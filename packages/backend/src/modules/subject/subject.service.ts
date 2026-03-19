import { SubjectType } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { PAGINATION } from '../../utils/constants';
import type { CreateSubjectDto, UpdateSubjectDto, SubjectFilters } from './subject.types';

export class SubjectService {
  async list(tenantId: string, filters: SubjectFilters) {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(filters.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
      ...(filters.type && { type: filters.type as SubjectType }),
    };

    const [data, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          academicYear: { select: { id: true, name: true } },
          _count: { select: { classSubjects: true } },
        },
      }),
      prisma.subject.count({ where }),
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
    const subject = await prisma.subject.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: { select: { id: true, name: true } },
        classSubjects: {
          include: {
            class: { select: { id: true, name: true, numericOrder: true } },
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundError('Subject not found');
    }

    return subject;
  }

  async create(tenantId: string, dto: CreateSubjectDto) {
    // Verify academic year belongs to this tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
    });
    if (!academicYear) {
      throw new NotFoundError('Academic year not found');
    }

    const existing = await prisma.subject.findFirst({
      where: { tenantId, code: dto.code, academicYearId: dto.academicYearId },
    });
    if (existing) {
      throw new ConflictError(
        `A subject with code "${dto.code}" already exists in this academic year`,
      );
    }

    return prisma.subject.create({
      data: {
        tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        nameAmharic: dto.nameAmharic,
        code: dto.code.toUpperCase(),
        type: (dto.type ?? 'CORE') as SubjectType,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSubjectDto) {
    const existing = await prisma.subject.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Subject not found');
    }

    if (dto.academicYearId) {
      const academicYear = await prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId },
      });
      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }
    }

    // Check code uniqueness if code or academicYearId changes
    if (dto.code || dto.academicYearId) {
      const newCode = (dto.code ?? existing.code).toUpperCase();
      const newAcademicYearId = dto.academicYearId ?? existing.academicYearId;

      const conflict = await prisma.subject.findFirst({
        where: {
          tenantId,
          code: newCode,
          academicYearId: newAcademicYearId,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictError(
          `A subject with code "${newCode}" already exists in this academic year`,
        );
      }
    }

    return prisma.subject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAmharic !== undefined && { nameAmharic: dto.nameAmharic }),
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.type !== undefined && { type: dto.type as SubjectType }),
        ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId }),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.subject.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Subject not found');
    }

    const classSubjectCount = await prisma.classSubject.count({ where: { subjectId: id, tenantId } });
    if (classSubjectCount > 0) {
      throw new BadRequestError(
        `Cannot delete subject assigned to ${classSubjectCount} class(es). Unassign from all classes first.`,
      );
    }

    await prisma.subject.delete({ where: { id } });
    return { message: 'Subject deleted successfully' };
  }
}

export const subjectService = new SubjectService();
