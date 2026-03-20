import { CalendarType, FeeFrequency, PrismaClient, SubjectType } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError } from '../../utils/errors';
import type { SetupWizardInput, SetupResult, SetupStatusResult } from './setup.types';

type DbClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ── Grading preset definitions ────────────────────────────────────────────────

const GRADING_PRESETS: Record<string, object> = {
  ethiopian: {
    scale: [
      { letter: 'A', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
      { letter: 'B', min: 80, max: 89, gpa: 3.0, description: 'Very Good' },
      { letter: 'C', min: 60, max: 79, gpa: 2.0, description: 'Good' },
      { letter: 'D', min: 50, max: 59, gpa: 1.0, description: 'Pass' },
      { letter: 'F', min: 0, max: 49, gpa: 0.0, description: 'Fail' },
    ],
    passingGrade: 'D',
    minimumPassPercentage: 50,
  },
  igcse: {
    scale: [
      { letter: 'A*', min: 90, max: 100, gpa: 4.0, description: 'Outstanding' },
      { letter: 'A', min: 80, max: 89, gpa: 3.7, description: 'Excellent' },
      { letter: 'B', min: 70, max: 79, gpa: 3.0, description: 'Good' },
      { letter: 'C', min: 60, max: 69, gpa: 2.0, description: 'Satisfactory' },
      { letter: 'D', min: 50, max: 59, gpa: 1.0, description: 'Moderate' },
      { letter: 'E', min: 40, max: 49, gpa: 0.5, description: 'Borderline' },
      { letter: 'F', min: 0, max: 39, gpa: 0.0, description: 'Fail' },
    ],
    passingGrade: 'C',
    minimumPassPercentage: 60,
  },
  ib: {
    scale: [
      { letter: '7', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
      { letter: '6', min: 80, max: 89, gpa: 3.5, description: 'Very Good' },
      { letter: '5', min: 70, max: 79, gpa: 3.0, description: 'Good' },
      { letter: '4', min: 60, max: 69, gpa: 2.5, description: 'Satisfactory' },
      { letter: '3', min: 50, max: 59, gpa: 2.0, description: 'Mediocre' },
      { letter: '2', min: 40, max: 49, gpa: 1.0, description: 'Poor' },
      { letter: '1', min: 0, max: 39, gpa: 0.0, description: 'Very Poor' },
    ],
    passingGrade: '4',
    minimumPassPercentage: 60,
  },
  american: {
    scale: [
      { letter: 'A', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
      { letter: 'B', min: 80, max: 89, gpa: 3.0, description: 'Good' },
      { letter: 'C', min: 70, max: 79, gpa: 2.0, description: 'Average' },
      { letter: 'D', min: 60, max: 69, gpa: 1.0, description: 'Below Average' },
      { letter: 'F', min: 0, max: 59, gpa: 0.0, description: 'Fail' },
    ],
    passingGrade: 'D',
    minimumPassPercentage: 60,
  },
};

export class SetupService {
  /**
   * Initialize a school in one big sequential transaction.
   *
   * All Prisma operations use the transaction client (db) passed in — never
   * the global prisma instance — so every query shares the RLS context
   * established by setRLSContext middleware.
   *
   * Operations are strictly sequential; NEVER use Promise.all with Prisma.
   */
  async initializeSchool(
    tenantId: string,
    input: SetupWizardInput,
    userId: string,
    db: DbClient,
  ): Promise<SetupResult> {
    // ── Guard: prevent re-initialization ────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestError('Tenant not found');
    }
    if (tenant.setupComplete) {
      throw new BadRequestError('School has already been initialized. Use individual config endpoints to make changes.');
    }

    // ── All tenant-scoped operations run first. They use the RLS-scoped `db`
    // client provided by the middleware interactive transaction, so any failure
    // here will roll back every write above it before the global prisma update
    // below is ever reached. ─────────────────────────────────────────────────
    // eslint-disable-next-line prefer-const
    let result!: SetupResult;

    // ── 1. Upsert TenantConfig entries for all 8 categories ─────────────────
    const gradingConfig =
      input.gradingPreset === 'custom' && input.customGrading
        ? input.customGrading
        : GRADING_PRESETS[input.gradingPreset] ?? GRADING_PRESETS['ethiopian'];

    const assessmentConfig = {
      gradeGroups: input.assessmentWeights.map((aw) => ({
        name: aw.gradeGroup,
        grades: aw.grades,
        caWeight: aw.caWeight,
        examWeight: aw.examWeight,
        categories: aw.categories,
      })),
    };

    const promotionConfig = {
      minimumOverallAverage: input.promotionRules.minAverage,
      maximumFailedSubjects: input.promotionRules.maxFailed,
      autoPromoteGrades: input.promotionRules.autoPromoteGrades,
      reExamAllowed: input.promotionRules.reExamAllowed,
      reExamMaxAttempts: 1,
      rankingEnabledFromGrade: input.grades[Math.floor(input.grades.length / 2)]?.name ?? '',
    };

    const operationsConfig = {
      workingDays: input.operations.workingDays,
      schoolStartTime: input.operations.startTime,
      schoolEndTime: input.operations.endTime,
      graceMinutes: input.operations.graceMinutes,
      periodsPerDay: input.operations.periodsPerDay,
      periodDurationMinutes: 45,
      attendanceMode: 'DAILY',
      breaks: [],
    };

    const generalConfig = {
      country: input.schoolProfile.country,
      currency: input.schoolProfile.country === 'ET' ? 'ETB' : 'USD',
      calendarType: input.schoolProfile.calendarType === 'ETHIOPIAN' ? 'ETHIOPIAN' : 'GREGORIAN',
      timezone: input.schoolProfile.timezone,
      locale: input.schoolProfile.locale,
      secondaryLocale: input.schoolProfile.locale === 'am' ? 'en' : 'en',
    };

    const feesConfig = {
      currency: input.schoolProfile.country === 'ET' ? 'ETB' : 'USD',
      latePenalty: { graceDays: 15, penaltyPercent: 2.5, maxPenaltyPercent: 10 },
      clearanceRequired: ['REPORT_CARD', 'TRANSFER_CERTIFICATE'],
      paymentMethods: ['CASH', 'BANK_TRANSFER'],
      discounts: { sibling: {}, fullPaymentAnnual: 0 },
    };

    const attendanceConfig = {
      mode: 'DAILY',
      graceMinutes: input.operations.graceMinutes,
      notifyOnAbsence: true,
      notificationChannels: ['PUSH'],
    };

    const reportCardConfig = {
      showRank: true,
      showAttendance: true,
      showConduct: true,
      showTeacherRemarks: true,
      showPrincipalRemarks: true,
      showPhoto: false,
      languages: [input.schoolProfile.locale, 'en'].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ),
      primaryLanguage: input.schoolProfile.locale,
    };

    try {
    const configEntries: Array<{ category: string; config: object }> = [
      { category: 'general', config: generalConfig },
      { category: 'grading', config: gradingConfig as object },
      { category: 'assessment', config: assessmentConfig },
      { category: 'promotion', config: promotionConfig },
      { category: 'operations', config: operationsConfig },
      { category: 'fees', config: feesConfig },
      { category: 'attendance', config: attendanceConfig },
      { category: 'reportCard', config: reportCardConfig },
    ];

    for (const entry of configEntries) {
      await db.tenantConfig.upsert({
        where: { tenantId_category: { tenantId, category: entry.category } },
        // Do not overwrite if already initialised
        update: {},
        create: {
          tenantId,
          category: entry.category,
          config: entry.config,
          updatedBy: userId,
        },
      });
    }

    // ── 2. Create AcademicYear ───────────────────────────────────────────────
    const calendarType: CalendarType =
      input.schoolProfile.calendarType === 'ETHIOPIAN'
        ? CalendarType.ETHIOPIAN
        : CalendarType.GREGORIAN;

    const academicYear = await db.academicYear.create({
      data: {
        tenantId,
        name: input.academicYear.name,
        startDate: new Date(input.academicYear.startDate),
        endDate: new Date(input.academicYear.endDate),
        isCurrent: true,
        calendarType,
      },
    });

    // ── 3. Create Class records (one per grade) ──────────────────────────────
    // Map grade name → created classId for later use
    const gradeNameToClassId = new Map<string, string>();

    for (const grade of input.grades) {
      const cls = await db.class.create({
        data: {
          tenantId,
          name: grade.name,
          numericOrder: grade.displayOrder,
          academicYearId: academicYear.id,
        },
      });
      gradeNameToClassId.set(grade.name, cls.id);
    }

    const classCount = gradeNameToClassId.size;

    // ── 4. Create Section records ────────────────────────────────────────────
    let sectionCount = 0;

    for (const grade of input.grades) {
      const classId = gradeNameToClassId.get(grade.name);
      if (!classId) continue;

      for (const section of grade.sections) {
        await db.section.create({
          data: {
            tenantId,
            classId,
            name: section.name,
            capacity: section.capacity,
          },
        });
        sectionCount += 1;
      }
    }

    // ── 5. Create Subject records ────────────────────────────────────────────
    // Map subject code → created subjectId for ClassSubject assignments
    const subjectCodeToId = new Map<string, string>();

    for (const subject of input.subjects) {
      const created = await db.subject.create({
        data: {
          tenantId,
          academicYearId: academicYear.id,
          name: subject.name,
          code: subject.code.toUpperCase(),
          type: subject.type as SubjectType,
        },
      });
      subjectCodeToId.set(subject.code.toUpperCase(), created.id);
    }

    const subjectCount = subjectCodeToId.size;

    // ── 6. Create ClassSubject assignments ───────────────────────────────────
    for (const subject of input.subjects) {
      const subjectId = subjectCodeToId.get(subject.code.toUpperCase());
      if (!subjectId) continue;

      for (const gradeName of subject.gradesApplicable) {
        const classId = gradeNameToClassId.get(gradeName);
        if (!classId) continue;

        await db.classSubject.create({
          data: {
            tenantId,
            classId,
            subjectId,
            periodsPerWeek: subject.periodsPerWeek,
          },
        });
      }
    }

    // ── 7. Create FeeStructure records ───────────────────────────────────────
    for (const fee of input.feeStructures) {
      if (fee.applicableGrades.length === 0) {
        // Tenant-wide fee (no classId restriction)
        await db.feeStructure.create({
          data: {
            tenantId,
            academicYearId: academicYear.id,
            name: fee.name,
            amount: fee.amount,
            frequency: fee.frequency as FeeFrequency,
            isActive: true,
          },
        });
      } else {
        // One FeeStructure row per applicable grade
        for (const gradeName of fee.applicableGrades) {
          const classId = gradeNameToClassId.get(gradeName);

          await db.feeStructure.create({
            data: {
              tenantId,
              academicYearId: academicYear.id,
              name: fee.name,
              amount: fee.amount,
              frequency: fee.frequency as FeeFrequency,
              classId: classId ?? null,
              isActive: true,
            },
          });
        }
      }
    }

      result = {
        academicYearId: academicYear.id,
        classCount,
        sectionCount,
        subjectCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'School initialization failed';
      throw new BadRequestError(`Initialization failed and all changes have been rolled back: ${message}`);
    }

    // ── 8. Mark tenant setupComplete = true ──────────────────────────────────
    // This runs OUTSIDE the RLS transaction because the Tenant table is a
    // platform-level table with no RLS. Using the global prisma client here is
    // intentional and safe. This line is only reached if ALL db operations above
    // succeeded without throwing.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { setupComplete: true },
    });

    return result;
  }

  /**
   * Return whether the school has completed its setup wizard.
   * Reads directly from the platform-level Tenant table (no RLS).
   */
  async getSetupStatus(tenantId: string): Promise<SetupStatusResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { setupComplete: true },
    });

    return { setupComplete: tenant?.setupComplete ?? false };
  }
}

export const setupService = new SetupService();
