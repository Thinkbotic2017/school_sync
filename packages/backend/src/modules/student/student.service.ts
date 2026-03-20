import { prisma } from '../../config/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors';
// TODO(CRIT-003): Import encryptRfid / decryptRfid from '../../utils/crypto' and:
//   - encrypt rfidCardNumber before write in create(), update(), and bulkCreate()
//   - decrypt rfidCardNumber after read in getById() and list()
//   - update checkRfidUniqueness() to compare encrypted values (requires HMAC index or full-table scan)
//   - run a one-off migration script to encrypt all existing plaintext rfidCardNumber values
// Until that migration is complete, RFID numbers are stored in plaintext.
import type {
  CreateStudentDto,
  UpdateStudentDto,
  StudentFilters,
  AssignParentDto,
  AddDocumentDto,
  BulkImportResult,
} from './student.types';

async function generateAdmissionNumber(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  const prefix = tenant.slug.replace(/-/g, '').slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { tenantId } });
  const seq = (count + 1).toString().padStart(3, '0');
  return `${prefix}-${year}-${seq}`;
}

async function checkRfidUniqueness(
  rfidCardNumber: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.student.findFirst({
    where: {
      rfidCardNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictError(`RFID card number '${rfidCardNumber}' is already assigned to another student`);
  }
}

export const studentService = {
  async list(tenantId: string, filters: StudentFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: import('@prisma/client').Prisma.StudentWhereInput = {
      tenantId,
      ...(filters.classId ? { classId: filters.classId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      // If a specific status is requested, honour it exactly.
      // Otherwise, hide INACTIVE students by default (they are soft-deleted).
      // Pass includeInactive=true to surface them for admin audit purposes.
      ...(filters.status
        ? { status: filters.status as 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'SUSPENDED' }
        : filters.includeInactive
          ? {}
          : { status: { not: 'INACTIVE' as const } }),
      ...(filters.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' as const } },
              { lastName: { contains: filters.search, mode: 'insensitive' as const } },
              { admissionNumber: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // Sequential queries on the same connection (required by RLS).
    // NEVER use Promise.all with Prisma — each call grabs a different pool
    // connection, losing the RLS set_config context.
    const total = await prisma.student.count({ where });
    const students = await prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: limit,
    });

    return {
      data: students,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(tenantId: string, id: string) {
    const student = await prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        parentLinks: true,
        documents: true,
      },
    });

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    // Fetch parent user details for each parent link
    const parentUserIds = student.parentLinks.map((link) => link.parentId);
    const parentUsers =
      parentUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: parentUserIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          })
        : [];

    const parentUserMap = new Map(parentUsers.map((u) => [u.id, u]));

    const parentLinksWithUsers = student.parentLinks.map((link) => ({
      ...link,
      parent: parentUserMap.get(link.parentId) ?? null,
    }));

    return {
      ...student,
      parentLinks: parentLinksWithUsers,
    };
  },

  async create(tenantId: string, dto: CreateStudentDto) {
    if (dto.rfidCardNumber) {
      await checkRfidUniqueness(dto.rfidCardNumber);
    }

    const admissionNumber = await generateAdmissionNumber(tenantId);

    const student = await prisma.student.create({
      data: {
        tenantId,
        admissionNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        nationality: dto.nationality ?? 'Ethiopian',
        classId: dto.classId,
        sectionId: dto.sectionId,
        rollNumber: dto.rollNumber,
        rfidCardNumber: dto.rfidCardNumber,
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    return student;
  },

  async update(tenantId: string, id: string, dto: UpdateStudentDto) {
    const existing = await prisma.student.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    if (dto.rfidCardNumber && dto.rfidCardNumber !== existing.rfidCardNumber) {
      await checkRfidUniqueness(dto.rfidCardNumber, id);
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.bloodGroup !== undefined ? { bloodGroup: dto.bloodGroup } : {}),
        ...(dto.nationality !== undefined ? { nationality: dto.nationality } : {}),
        ...(dto.classId !== undefined ? { classId: dto.classId } : {}),
        ...(dto.sectionId !== undefined ? { sectionId: dto.sectionId } : {}),
        ...(dto.rollNumber !== undefined ? { rollNumber: dto.rollNumber } : {}),
        ...(dto.rfidCardNumber !== undefined ? { rfidCardNumber: dto.rfidCardNumber } : {}),
        ...(dto.admissionDate !== undefined ? { admissionDate: new Date(dto.admissionDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    return student;
  },

  async delete(tenantId: string, id: string) {
    const existing = await prisma.student.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    // Soft delete: set status to INACTIVE rather than removing the row.
    // This preserves attendance, exam results, and financial records that reference this student.
    // Design decision: we reuse StudentStatus.INACTIVE for deletion because adding a separate
    // `deletedAt` column would require a schema migration. Admins can still see soft-deleted
    // students by explicitly filtering for status=INACTIVE.
    // TODO: if we need to distinguish "deleted" from "legitimately inactive" in future,
    //       add a `deletedAt DateTime?` column to the Student model.
    await prisma.student.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  },

  async updatePhoto(tenantId: string, id: string, photoPath: string) {
    const existing = await prisma.student.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    const student = await prisma.student.update({
      where: { id },
      data: { photo: photoPath },
      select: { id: true, photo: true },
    });

    return student;
  },

  async assignParent(tenantId: string, studentId: string, dto: AssignParentDto) {
    const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    const parentUser = await prisma.user.findFirst({
      where: { id: dto.parentId, tenantId },
    });
    if (!parentUser) {
      throw new NotFoundError('Parent user not found');
    }

    if (dto.isPrimary) {
      await prisma.parentStudent.updateMany({
        where: { tenantId, studentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const link = await prisma.parentStudent.upsert({
      where: {
        tenantId_parentId_studentId: {
          tenantId,
          parentId: dto.parentId,
          studentId,
        },
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
      },
      create: {
        tenantId,
        parentId: dto.parentId,
        studentId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    return link;
  },

  async removeParent(tenantId: string, studentId: string, parentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    const link = await prisma.parentStudent.findFirst({
      where: { tenantId, studentId, parentId },
    });
    if (!link) {
      throw new NotFoundError('Parent link not found');
    }

    await prisma.parentStudent.delete({ where: { id: link.id } });
  },

  async listDocuments(tenantId: string, studentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    const documents = await prisma.studentDocument.findMany({
      where: { studentId, tenantId },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents;
  },

  async addDocument(tenantId: string, studentId: string, doc: AddDocumentDto) {
    const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    const document = await prisma.studentDocument.create({
      data: {
        tenantId,
        studentId,
        name: doc.name,
        filePath: doc.filePath,
        fileType: doc.fileType,
      },
    });

    return document;
  },

  async deleteDocument(tenantId: string, documentId: string) {
    const document = await prisma.studentDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    await prisma.studentDocument.delete({ where: { id: documentId } });
  },

  async bulkCreate(tenantId: string, rows: CreateStudentDto[]): Promise<BulkImportResult> {
    if (rows.length === 0) {
      return { created: 0, errors: [] };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const prefix = tenant.slug.replace(/-/g, '').slice(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const baseCount = await prisma.student.count({ where: { tenantId } });

    const errors: Array<{ row: number; error: string }> = [];
    const validRows: Array<{
      tenantId: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      gender: 'MALE' | 'FEMALE';
      bloodGroup: string | null;
      nationality: string;
      classId: string;
      sectionId: string;
      rollNumber: string | null;
      rfidCardNumber: string | null;
      admissionDate: Date;
      status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'SUSPENDED';
      photo: string | null;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        if (!row.firstName || !row.lastName) {
          throw new Error('firstName and lastName are required');
        }
        if (!row.dateOfBirth || isNaN(Date.parse(row.dateOfBirth))) {
          throw new Error('Valid dateOfBirth is required');
        }
        if (!row.gender || !['MALE', 'FEMALE'].includes(row.gender)) {
          throw new Error("gender must be 'MALE' or 'FEMALE'");
        }
        if (!row.classId || !row.sectionId) {
          throw new Error('classId and sectionId are required');
        }

        if (row.rfidCardNumber) {
          const rfidExists = await prisma.student.findFirst({
            where: { rfidCardNumber: row.rfidCardNumber },
          });
          if (rfidExists) {
            throw new Error(`RFID card '${row.rfidCardNumber}' is already in use`);
          }
        }

        const seq = (baseCount + validRows.length + 1).toString().padStart(3, '0');
        const admissionNumber = `${prefix}-${year}-${seq}`;

        validRows.push({
          tenantId,
          admissionNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: new Date(row.dateOfBirth),
          gender: row.gender,
          bloodGroup: row.bloodGroup ?? null,
          nationality: row.nationality ?? 'Ethiopian',
          classId: row.classId,
          sectionId: row.sectionId,
          rollNumber: row.rollNumber ?? null,
          rfidCardNumber: row.rfidCardNumber ?? null,
          admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
          status: row.status ?? 'ACTIVE',
          photo: null,
        });
      } catch (err) {
        errors.push({
          row: rowNum,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    if (validRows.length > 0) {
      await prisma.student.createMany({ data: validRows, skipDuplicates: true });
    }

    return { created: validRows.length, errors };
  },
};
