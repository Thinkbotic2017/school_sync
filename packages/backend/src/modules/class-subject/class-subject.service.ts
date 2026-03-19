import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import type { AssignSubjectDto } from './class-subject.types';

export class ClassSubjectService {
  async listByClass(tenantId: string, classId: string) {
    // Verify the class belongs to this tenant
    const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) {
      throw new NotFoundError('Class not found');
    }

    const data = await prisma.classSubject.findMany({
      where: { tenantId, classId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            nameAmharic: true,
            code: true,
            type: true,
          },
        },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    return data;
  }

  async assign(tenantId: string, dto: AssignSubjectDto) {
    // Verify class belongs to tenant
    const cls = await prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) {
      throw new NotFoundError('Class not found');
    }

    // Verify subject belongs to tenant
    const subject = await prisma.subject.findFirst({ where: { id: dto.subjectId, tenantId } });
    if (!subject) {
      throw new NotFoundError('Subject not found');
    }

    // Upsert — update if already exists, create if not
    return prisma.classSubject.upsert({
      where: {
        tenantId_classId_subjectId: {
          tenantId,
          classId: dto.classId,
          subjectId: dto.subjectId,
        },
      },
      create: {
        tenantId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
      },
      update: {
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            nameAmharic: true,
            code: true,
            type: true,
          },
        },
        class: { select: { id: true, name: true } },
      },
    });
  }

  async unassign(tenantId: string, classId: string, subjectId: string) {
    const existing = await prisma.classSubject.findFirst({
      where: { tenantId, classId, subjectId },
    });

    if (!existing) {
      throw new NotFoundError('Subject assignment not found for this class');
    }

    await prisma.classSubject.delete({ where: { id: existing.id } });
    return { message: 'Subject unassigned from class successfully' };
  }
}

export const classSubjectService = new ClassSubjectService();
