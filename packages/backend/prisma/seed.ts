import {
  PrismaClient,
  PlanType,
  CalendarType,
  UserRole,
  SubjectType,
  Gender,
  StudentStatus,
  AttendanceStatus,
  AttendanceSource,
  FeeFrequency,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { ethiopiaDefaults } from '../src/modules/config/defaults/ethiopia';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

function generateLicenseKey(): string {
  // Format: SS-XXXX-XXXX-XXXX-XXXX (SS = SchoolSync prefix)
  const segments = Array.from({ length: 4 }, () =>
    randomBytes(2).toString('hex').toUpperCase(),
  );
  return `SS-${segments.join('-')}`;
}

function oneYearFromNow(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

// Helper: set RLS tenant context for seed operations
async function setTenantContext(tenantId: string) {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, false)`, tenantId);
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // Disable RLS for seed by setting a superuser-compatible bypass via set_config
  // Tenant tables (Tenant, SubscriptionHistory) have no RLS — safe to write directly
  // Tenant-scoped tables need the context set before each write batch

  const passwordHash = await bcrypt.hash('Admin@123', BCRYPT_SALT_ROUNDS);

  // ── Tenant 1: Addis International School ──────────────────────────────────
  const addis = await prisma.tenant.upsert({
    where: { slug: 'addis-international' },
    update: {},
    create: {
      name: 'Addis International School',
      slug: 'addis-international',
      primaryColor: '#1E40AF',
      secondaryColor: '#3B82F6',
      plan: PlanType.PROFESSIONAL,
      licenseKey: generateLicenseKey(),
      licenseExpiresAt: oneYearFromNow(),
      maxStudents: 2000,
      maxStaff: 200,
      isActive: true,
      setupComplete: false,
      locale: 'en',
      calendarType: CalendarType.ETHIOPIAN,
      timezone: 'Africa/Addis_Ababa',
    },
  });

  console.log(`✅ Tenant: ${addis.name} (${addis.slug})`);
  console.log(`   ID:          ${addis.id}`);
  console.log(`   Plan:        ${addis.plan}`);
  console.log(`   License:     ${addis.licenseKey}`);
  console.log(`   Expires:     ${addis.licenseExpiresAt.toISOString().split('T')[0]}\n`);

  // Set RLS context for Addis tenant — all subsequent writes must match this tenantId
  await setTenantContext(addis.id);

  const addisAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: addis.id, email: 'admin@addis.edu.et' } },
    update: {},
    create: {
      tenantId: addis.id,
      email: 'admin@addis.edu.et',
      firstName: 'Abebe',
      lastName: 'Teshome',
      passwordHash,
      role: UserRole.SCHOOL_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Admin: ${addisAdmin.firstName} ${addisAdmin.lastName} <${addisAdmin.email}>`);
  console.log(`   ID:    ${addisAdmin.id}`);
  console.log(`   Role:  ${addisAdmin.role}\n`);

  // ── Tenant 2: Hawassa Academy ─────────────────────────────────────────────
  const hawassa = await prisma.tenant.upsert({
    where: { slug: 'hawassa-academy' },
    update: {},
    create: {
      name: 'Hawassa Academy',
      slug: 'hawassa-academy',
      primaryColor: '#065F46',
      secondaryColor: '#10B981',
      plan: PlanType.STARTER,
      licenseKey: generateLicenseKey(),
      licenseExpiresAt: oneYearFromNow(),
      maxStudents: 500,
      maxStaff: 50,
      isActive: true,
      setupComplete: false,
      locale: 'am',
      calendarType: CalendarType.ETHIOPIAN,
      timezone: 'Africa/Addis_Ababa',
    },
  });

  console.log(`✅ Tenant: ${hawassa.name} (${hawassa.slug})`);
  console.log(`   ID:          ${hawassa.id}`);
  console.log(`   Plan:        ${hawassa.plan}`);
  console.log(`   License:     ${hawassa.licenseKey}`);
  console.log(`   Expires:     ${hawassa.licenseExpiresAt.toISOString().split('T')[0]}\n`);

  // Switch RLS context to Hawassa
  await setTenantContext(hawassa.id);

  const hawassaAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: hawassa.id, email: 'admin@hawassa.edu.et' } },
    update: {},
    create: {
      tenantId: hawassa.id,
      email: 'admin@hawassa.edu.et',
      firstName: 'Meron',
      lastName: 'Hailu',
      passwordHash,
      role: UserRole.SCHOOL_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Admin: ${hawassaAdmin.firstName} ${hawassaAdmin.lastName} <${hawassaAdmin.email}>`);
  console.log(`   ID:    ${hawassaAdmin.id}`);
  console.log(`   Role:  ${hawassaAdmin.role}\n`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Academic Structure for Addis International School
  // ════════════════════════════════════════════════════════════════════════════

  // Switch RLS context back to Addis for all academic + student + attendance data
  await setTenantContext(addis.id);

  // ── Academic Year ─────────────────────────────────────────────────────────
  console.log('📚 Creating academic year...');

  const academicYear = await prisma.academicYear.upsert({
    where: {
      tenantId_name: { tenantId: addis.id, name: '2025-2026 (2018 E.C.)' },
    },
    update: {},
    create: {
      tenantId: addis.id,
      name: '2025-2026 (2018 E.C.)',
      startDate: new Date('2025-09-11'),
      endDate: new Date('2026-07-07'),
      isCurrent: true,
      calendarType: CalendarType.ETHIOPIAN,
    },
  });

  console.log(`   ✅ ${academicYear.name} (isCurrent: ${academicYear.isCurrent})\n`);

  // ── Classes ───────────────────────────────────────────────────────────────
  console.log('🏫 Creating classes and sections...');

  const grade1 = await prisma.class.upsert({
    where: {
      tenantId_name_academicYearId: {
        tenantId: addis.id,
        name: 'Grade 1',
        academicYearId: academicYear.id,
      },
    },
    update: {},
    create: {
      tenantId: addis.id,
      name: 'Grade 1',
      numericOrder: 1,
      academicYearId: academicYear.id,
    },
  });

  const grade2 = await prisma.class.upsert({
    where: {
      tenantId_name_academicYearId: {
        tenantId: addis.id,
        name: 'Grade 2',
        academicYearId: academicYear.id,
      },
    },
    update: {},
    create: {
      tenantId: addis.id,
      name: 'Grade 2',
      numericOrder: 2,
      academicYearId: academicYear.id,
    },
  });

  const grade3 = await prisma.class.upsert({
    where: {
      tenantId_name_academicYearId: {
        tenantId: addis.id,
        name: 'Grade 3',
        academicYearId: academicYear.id,
      },
    },
    update: {},
    create: {
      tenantId: addis.id,
      name: 'Grade 3',
      numericOrder: 3,
      academicYearId: academicYear.id,
    },
  });

  console.log(`   ✅ Grade 1 (id: ${grade1.id})`);
  console.log(`   ✅ Grade 2 (id: ${grade2.id})`);
  console.log(`   ✅ Grade 3 (id: ${grade3.id})`);

  // ── Sections (2 per class) ────────────────────────────────────────────────
  const g1SectionA = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade1.id, name: 'A' } },
    update: {},
    create: { tenantId: addis.id, classId: grade1.id, name: 'A', capacity: 40 },
  });
  const g1SectionB = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade1.id, name: 'B' } },
    update: {},
    create: { tenantId: addis.id, classId: grade1.id, name: 'B', capacity: 40 },
  });
  const g2SectionA = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade2.id, name: 'A' } },
    update: {},
    create: { tenantId: addis.id, classId: grade2.id, name: 'A', capacity: 40 },
  });
  const g2SectionB = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade2.id, name: 'B' } },
    update: {},
    create: { tenantId: addis.id, classId: grade2.id, name: 'B', capacity: 40 },
  });
  const g3SectionA = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade3.id, name: 'A' } },
    update: {},
    create: { tenantId: addis.id, classId: grade3.id, name: 'A', capacity: 40 },
  });
  const g3SectionB = await prisma.section.upsert({
    where: { tenantId_classId_name: { tenantId: addis.id, classId: grade3.id, name: 'B' } },
    update: {},
    create: { tenantId: addis.id, classId: grade3.id, name: 'B', capacity: 40 },
  });

  console.log(`   ✅ 6 sections created (A & B for each grade)\n`);

  // ── Subjects ──────────────────────────────────────────────────────────────
  console.log('📖 Creating subjects...');

  const subjectDefs = [
    { name: 'Mathematics', nameAmharic: 'ሂሳብ', code: 'MATH', type: SubjectType.CORE },
    { name: 'English Language', nameAmharic: 'እንግሊዝኛ', code: 'ENG', type: SubjectType.CORE },
    { name: 'Amharic', nameAmharic: 'አማርኛ', code: 'AMH', type: SubjectType.CORE },
    { name: 'Natural Science', nameAmharic: 'የተፈጥሮ ሳይንስ', code: 'SCI', type: SubjectType.CORE },
    { name: 'Social Studies', nameAmharic: 'ማህበራዊ ጥናቶች', code: 'SOC', type: SubjectType.CORE },
    {
      name: 'Physical Education',
      nameAmharic: 'አካላዊ ትምህርት',
      code: 'PE',
      type: SubjectType.EXTRACURRICULAR,
    },
  ];

  // Sequential upserts to avoid connection pool stealing the tenant context
  const subjects = [];
  for (const s of subjectDefs) {
    const subject = await prisma.subject.upsert({
      where: {
        tenantId_code_academicYearId: {
          tenantId: addis.id,
          code: s.code,
          academicYearId: academicYear.id,
        },
      },
      update: {},
      create: {
        tenantId: addis.id,
        academicYearId: academicYear.id,
        name: s.name,
        nameAmharic: s.nameAmharic,
        code: s.code,
        type: s.type,
      },
    });
    subjects.push(subject);
  }

  subjects.forEach((s) => console.log(`   ✅ ${s.name} (${s.code})`));
  console.log();

  // ── ClassSubject Assignments ───────────────────────────────────────────────
  console.log('🔗 Assigning subjects to classes...');

  const classes = [grade1, grade2, grade3];
  for (const cls of classes) {
    for (const subj of subjects) {
      await prisma.classSubject.upsert({
        where: {
          tenantId_classId_subjectId: {
            tenantId: addis.id,
            classId: cls.id,
            subjectId: subj.id,
          },
        },
        update: {},
        create: {
          tenantId: addis.id,
          classId: cls.id,
          subjectId: subj.id,
          periodsPerWeek: subj.type === SubjectType.EXTRACURRICULAR ? 2 : 5,
        },
      });
    }
  }

  console.log(`   ✅ ${classes.length * subjects.length} class-subject assignments created\n`);

  // ── Students ──────────────────────────────────────────────────────────────
  console.log('👩‍🎓 Creating 30 students...');

  type StudentDef = {
    admissionNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: Gender;
    rfidCardNumber: string;
    classId: string;
    sectionId: string;
  };

  const studentDefs: StudentDef[] = [
    // Grade 1 Section A — Male
    {
      admissionNumber: 'AIS-2026-001',
      firstName: 'Dawit',
      lastName: 'Bekele',
      dateOfBirth: new Date('2010-03-15'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G1A-001',
      classId: grade1.id,
      sectionId: g1SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-002',
      firstName: 'Yonas',
      lastName: 'Tadesse',
      dateOfBirth: new Date('2010-07-22'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G1A-002',
      classId: grade1.id,
      sectionId: g1SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-003',
      firstName: 'Biruk',
      lastName: 'Alemu',
      dateOfBirth: new Date('2010-11-05'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G1A-003',
      classId: grade1.id,
      sectionId: g1SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-004',
      firstName: 'Natnael',
      lastName: 'Girma',
      dateOfBirth: new Date('2010-04-18'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G1A-004',
      classId: grade1.id,
      sectionId: g1SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-005',
      firstName: 'Henok',
      lastName: 'Tesfaye',
      dateOfBirth: new Date('2010-09-30'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G1A-005',
      classId: grade1.id,
      sectionId: g1SectionA.id,
    },
    // Grade 1 Section B — Female
    {
      admissionNumber: 'AIS-2026-006',
      firstName: 'Selam',
      lastName: 'Abebe',
      dateOfBirth: new Date('2010-02-14'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G1B-001',
      classId: grade1.id,
      sectionId: g1SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-007',
      firstName: 'Tigist',
      lastName: 'Haile',
      dateOfBirth: new Date('2010-06-08'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G1B-002',
      classId: grade1.id,
      sectionId: g1SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-008',
      firstName: 'Mekdes',
      lastName: 'Worku',
      dateOfBirth: new Date('2010-12-25'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G1B-003',
      classId: grade1.id,
      sectionId: g1SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-009',
      firstName: 'Hanna',
      lastName: 'Belay',
      dateOfBirth: new Date('2010-05-11'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G1B-004',
      classId: grade1.id,
      sectionId: g1SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-010',
      firstName: 'Bethlehem',
      lastName: 'Desta',
      dateOfBirth: new Date('2010-08-19'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G1B-005',
      classId: grade1.id,
      sectionId: g1SectionB.id,
    },
    // Grade 2 Section A — Male
    {
      admissionNumber: 'AIS-2026-011',
      firstName: 'Eyob',
      lastName: 'Mulugeta',
      dateOfBirth: new Date('2009-01-20'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G2A-001',
      classId: grade2.id,
      sectionId: g2SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-012',
      firstName: 'Kaleb',
      lastName: 'Seyoum',
      dateOfBirth: new Date('2009-04-03'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G2A-002',
      classId: grade2.id,
      sectionId: g2SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-013',
      firstName: 'Mikael',
      lastName: 'Hailu',
      dateOfBirth: new Date('2009-07-16'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G2A-003',
      classId: grade2.id,
      sectionId: g2SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-014',
      firstName: 'Samuel',
      lastName: 'Kebede',
      dateOfBirth: new Date('2009-10-29'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G2A-004',
      classId: grade2.id,
      sectionId: g2SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-015',
      firstName: 'Fikir',
      lastName: 'Assefa',
      dateOfBirth: new Date('2009-03-07'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G2A-005',
      classId: grade2.id,
      sectionId: g2SectionA.id,
    },
    // Grade 2 Section B — Female
    {
      admissionNumber: 'AIS-2026-016',
      firstName: 'Meron',
      lastName: 'Getachew',
      dateOfBirth: new Date('2009-06-22'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G2B-001',
      classId: grade2.id,
      sectionId: g2SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-017',
      firstName: 'Rahel',
      lastName: 'Tesfaye',
      dateOfBirth: new Date('2009-09-14'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G2B-002',
      classId: grade2.id,
      sectionId: g2SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-018',
      firstName: 'Sara',
      lastName: 'Woldemichael',
      dateOfBirth: new Date('2009-12-01'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G2B-003',
      classId: grade2.id,
      sectionId: g2SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-019',
      firstName: 'Lidya',
      lastName: 'Ayele',
      dateOfBirth: new Date('2009-02-28'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G2B-004',
      classId: grade2.id,
      sectionId: g2SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-020',
      firstName: 'Naomi',
      lastName: 'Bekele',
      dateOfBirth: new Date('2009-05-17'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G2B-005',
      classId: grade2.id,
      sectionId: g2SectionB.id,
    },
    // Grade 3 Section A — Male
    {
      admissionNumber: 'AIS-2026-021',
      firstName: 'Abel',
      lastName: 'Mekonnen',
      dateOfBirth: new Date('2008-08-04'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G3A-001',
      classId: grade3.id,
      sectionId: g3SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-022',
      firstName: 'Daniel',
      lastName: 'Yohannes',
      dateOfBirth: new Date('2008-11-17'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G3A-002',
      classId: grade3.id,
      sectionId: g3SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-023',
      firstName: 'Ermias',
      lastName: 'Tesfa',
      dateOfBirth: new Date('2008-02-09'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G3A-003',
      classId: grade3.id,
      sectionId: g3SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-024',
      firstName: 'Fitsum',
      lastName: 'Zeleke',
      dateOfBirth: new Date('2008-05-25'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G3A-004',
      classId: grade3.id,
      sectionId: g3SectionA.id,
    },
    {
      admissionNumber: 'AIS-2026-025',
      firstName: 'Haben',
      lastName: 'Teshome',
      dateOfBirth: new Date('2008-09-12'),
      gender: Gender.MALE,
      rfidCardNumber: 'RFID-G3A-005',
      classId: grade3.id,
      sectionId: g3SectionA.id,
    },
    // Grade 3 Section B — Female
    {
      admissionNumber: 'AIS-2026-026',
      firstName: 'Kidist',
      lastName: 'Alemu',
      dateOfBirth: new Date('2008-01-30'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G3B-001',
      classId: grade3.id,
      sectionId: g3SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-027',
      firstName: 'Liya',
      lastName: 'Habtamu',
      dateOfBirth: new Date('2008-04-13'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G3B-002',
      classId: grade3.id,
      sectionId: g3SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-028',
      firstName: 'Martha',
      lastName: 'Demeke',
      dateOfBirth: new Date('2008-07-26'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G3B-003',
      classId: grade3.id,
      sectionId: g3SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-029',
      firstName: 'Nigest',
      lastName: 'Abay',
      dateOfBirth: new Date('2008-10-08'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G3B-004',
      classId: grade3.id,
      sectionId: g3SectionB.id,
    },
    {
      admissionNumber: 'AIS-2026-030',
      firstName: 'Tigist',
      lastName: 'Girma',
      dateOfBirth: new Date('2008-12-21'),
      gender: Gender.FEMALE,
      rfidCardNumber: 'RFID-G3B-005',
      classId: grade3.id,
      sectionId: g3SectionB.id,
    },
  ];

  // Sequential upserts to keep same connection/context
  const students = [];
  for (const s of studentDefs) {
    const student = await prisma.student.upsert({
      where: {
        tenantId_admissionNumber: {
          tenantId: addis.id,
          admissionNumber: s.admissionNumber,
        },
      },
      update: {},
      create: {
        tenantId: addis.id,
        admissionNumber: s.admissionNumber,
        rfidCardNumber: s.rfidCardNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        nationality: 'Ethiopian',
        classId: s.classId,
        sectionId: s.sectionId,
        admissionDate: new Date('2025-09-11'),
        status: StudentStatus.ACTIVE,
      },
    });
    students.push(student);
  }

  console.log(`   ✅ ${students.length} students created\n`);

  // ── Parents ───────────────────────────────────────────────────────────────
  console.log('👨‍👩‍👧 Creating 10 parents and linking to students...');

  const parentHash = await bcrypt.hash('Parent@123', BCRYPT_SALT_ROUNDS);

  type ParentDef = {
    firstName: string;
    lastName: string;
    email: string;
    relationship: string;
    studentIndex: number; // 0-based index into students array
  };

  const parentDefs: ParentDef[] = [
    {
      firstName: 'Bekele',
      lastName: 'Dawit',
      email: 'bekele.dawit@gmail.com',
      relationship: 'FATHER',
      studentIndex: 0,
    },
    {
      firstName: 'Tadesse',
      lastName: 'Yonas',
      email: 'tadesse.yonas@gmail.com',
      relationship: 'FATHER',
      studentIndex: 1,
    },
    {
      firstName: 'Almaz',
      lastName: 'Alemu',
      email: 'almaz.alemu@gmail.com',
      relationship: 'MOTHER',
      studentIndex: 2,
    },
    {
      firstName: 'Girma',
      lastName: 'Natnael',
      email: 'girma.natnael@gmail.com',
      relationship: 'FATHER',
      studentIndex: 3,
    },
    {
      firstName: 'Tesfaye',
      lastName: 'Henok',
      email: 'tesfaye.henok@gmail.com',
      relationship: 'FATHER',
      studentIndex: 4,
    },
    {
      firstName: 'Abebe',
      lastName: 'Selam',
      email: 'abebe.selam@gmail.com',
      relationship: 'MOTHER',
      studentIndex: 5,
    },
    {
      firstName: 'Haile',
      lastName: 'Tigist',
      email: 'haile.tigist@gmail.com',
      relationship: 'FATHER',
      studentIndex: 6,
    },
    {
      firstName: 'Worku',
      lastName: 'Mekdes',
      email: 'worku.mekdes@gmail.com',
      relationship: 'MOTHER',
      studentIndex: 7,
    },
    {
      firstName: 'Belay',
      lastName: 'Hanna',
      email: 'belay.hanna@gmail.com',
      relationship: 'FATHER',
      studentIndex: 8,
    },
    {
      firstName: 'Desta',
      lastName: 'Bethlehem',
      email: 'desta.bethlehem@gmail.com',
      relationship: 'MOTHER',
      studentIndex: 9,
    },
  ];

  for (const p of parentDefs) {
    const parentUser = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: addis.id, email: p.email } },
      update: {},
      create: {
        tenantId: addis.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        passwordHash: parentHash,
        role: UserRole.PARENT,
        isActive: true,
      },
    });

    const student = students[p.studentIndex];

    await prisma.parentStudent.upsert({
      where: {
        tenantId_parentId_studentId: {
          tenantId: addis.id,
          parentId: parentUser.id,
          studentId: student.id,
        },
      },
      update: {},
      create: {
        tenantId: addis.id,
        parentId: parentUser.id,
        studentId: student.id,
        relationship: p.relationship,
        isPrimary: true,
      },
    });

    console.log(
      `   ✅ ${parentUser.firstName} ${parentUser.lastName} → ${student.firstName} ${student.lastName} (${p.relationship})`,
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Attendance Seed Data
  // ════════════════════════════════════════════════════════════════════════════

  // ── SchoolConfig for both tenants ─────────────────────────────────────────
  console.log('\n⚙️  Creating school configs...');

  // Addis SchoolConfig (context already set to addis.id)
  await prisma.schoolConfig.upsert({
    where: { tenantId: addis.id },
    update: {},
    create: {
      tenantId: addis.id,
      schoolStartTime: '08:00',
      graceMinutes: 15,
      schoolEndTime: '15:30',
      timezone: 'Africa/Addis_Ababa',
    },
  });

  // Switch to Hawassa for Hawassa SchoolConfig
  await setTenantContext(hawassa.id);
  await prisma.schoolConfig.upsert({
    where: { tenantId: hawassa.id },
    update: {},
    create: {
      tenantId: hawassa.id,
      schoolStartTime: '08:00',
      graceMinutes: 15,
      schoolEndTime: '15:30',
      timezone: 'Africa/Addis_Ababa',
    },
  });

  // Switch back to Addis for attendance seeding
  await setTenantContext(addis.id);

  console.log('   ✅ SchoolConfig created for both tenants');

  // ── 7 days of attendance for all 30 Addis students ────────────────────────
  console.log('\n📋 Seeding 7 days of attendance data...');

  /**
   * Returns the last N weekdays (Mon-Fri) going backwards from today.
   * "Today" is excluded — we generate historical data only.
   */
  function getLastNWeekdays(n: number): Date[] {
    const days: Date[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (days.length < n) {
      cursor.setDate(cursor.getDate() - 1);
      const dow = cursor.getDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) {
        days.push(new Date(cursor));
      }
    }
    return days; // Most-recent first
  }

  /**
   * Seeded PRNG — deterministic per student+day so re-seeding is idempotent.
   */
  function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  const weekdays = getLastNWeekdays(7);

  // Build attendance records in batches using createMany (skip duplicates)
  type AttendanceCreateInput = {
    tenantId: string;
    studentId: string;
    date: Date;
    status: AttendanceStatus;
    checkInTime: Date | null;
    source: AttendanceSource;
  };

  const attendanceRecords: AttendanceCreateInput[] = [];

  weekdays.forEach((day, dayIndex) => {
    students.forEach((student, studentIndex) => {
      // Deterministic roll: 85% PRESENT, 10% LATE, 5% ABSENT
      const roll = seededRandom(studentIndex * 100 + dayIndex);

      let status: AttendanceStatus;
      let checkInTime: Date | null = null;

      if (roll < 0.85) {
        status = AttendanceStatus.PRESENT;
        // Check-in between 07:30 and 07:59
        const minuteOffset = Math.floor(seededRandom(studentIndex * 200 + dayIndex) * 30);
        checkInTime = new Date(day);
        checkInTime.setHours(7, 30 + minuteOffset, 0, 0);
      } else if (roll < 0.95) {
        status = AttendanceStatus.LATE;
        // Check-in between 08:16 and 09:00
        const minuteOffset = Math.floor(seededRandom(studentIndex * 300 + dayIndex) * 44);
        checkInTime = new Date(day);
        checkInTime.setHours(8, 16 + minuteOffset, 0, 0);
      } else {
        status = AttendanceStatus.ABSENT;
        checkInTime = null;
      }

      // Most records via RFID, a few via MANUAL
      const source: AttendanceSource =
        seededRandom(studentIndex * 400 + dayIndex) > 0.1
          ? AttendanceSource.RFID
          : AttendanceSource.MANUAL;

      attendanceRecords.push({
        tenantId: addis.id,
        studentId: student.id,
        date: day,
        status,
        checkInTime,
        source,
      });
    });
  });

  // createMany with skipDuplicates so re-running seed is safe
  const attendanceResult = await prisma.attendance.createMany({
    data: attendanceRecords,
    skipDuplicates: true,
  });

  console.log(`   ✅ ${attendanceResult.count} attendance records created (${weekdays.length} days × ${students.length} students)`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4 — Fee Seed Data
  // ════════════════════════════════════════════════════════════════════════════

  // Ensure tenant context is set for Addis (already set from attendance seeding above)
  await setTenantContext(addis.id);

  console.log('\n💰 Creating fee structures...');

  // 1. Tuition Fee — 5000 ETB, MONTHLY, all classes
  const existingTuition = await prisma.feeStructure.findFirst({
    where: { tenantId: addis.id, name: 'Tuition Fee', academicYearId: academicYear.id },
  });
  const tuitionFee = existingTuition ?? await prisma.feeStructure.create({
    data: {
      tenantId: addis.id,
      name: 'Tuition Fee',
      amount: 5000,
      currency: 'ETB',
      frequency: FeeFrequency.MONTHLY,
      classId: null,
      academicYearId: academicYear.id,
      isActive: true,
    },
  });

  // 2. Transport Fee — 1500 ETB, MONTHLY, all classes
  const existingTransport = await prisma.feeStructure.findFirst({
    where: { tenantId: addis.id, name: 'Transport Fee', academicYearId: academicYear.id },
  });
  const transportFee = existingTransport ?? await prisma.feeStructure.create({
    data: {
      tenantId: addis.id,
      name: 'Transport Fee',
      amount: 1500,
      currency: 'ETB',
      frequency: FeeFrequency.MONTHLY,
      classId: null,
      academicYearId: academicYear.id,
      isActive: true,
    },
  });

  // 3. Lab Fee — 2000 ETB, SEMESTER, Grade 3 only
  const existingLab = await prisma.feeStructure.findFirst({
    where: { tenantId: addis.id, name: 'Lab Fee', academicYearId: academicYear.id },
  });
  const labFee = existingLab ?? await prisma.feeStructure.create({
    data: {
      tenantId: addis.id,
      name: 'Lab Fee',
      amount: 2000,
      currency: 'ETB',
      frequency: FeeFrequency.SEMESTER,
      classId: grade3.id,
      academicYearId: academicYear.id,
      isActive: true,
    },
  });

  console.log('   ✅ Tuition Fee (5000 ETB, MONTHLY, all classes)');
  console.log('   ✅ Transport Fee (1500 ETB, MONTHLY, all classes)');
  console.log('   ✅ Lab Fee (2000 ETB, SEMESTER, Grade 3)');

  // Calculate due dates
  const nowDate = new Date();
  const tuitionDueDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const transportDueDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const semesterDueDate =
    nowDate.getMonth() < 6
      ? new Date(nowDate.getFullYear(), 0, 1)
      : new Date(nowDate.getFullYear(), 6, 1);
  const overdueDate = new Date(nowDate);
  overdueDate.setDate(overdueDate.getDate() - 30);

  console.log('\n📝 Creating fee records for 30 students...');

  for (let i = 0; i < students.length; i++) {
    const student = students[i];

    // ── Tuition Fee Record ──────────────────────────────────────────────────
    const existingTuitionRecord = await prisma.feeRecord.findFirst({
      where: { tenantId: addis.id, studentId: student.id, feeStructureId: tuitionFee.id },
    });
    if (!existingTuitionRecord) {
      let tuitionStatus: 'PAID' | 'PARTIAL' | 'PENDING';
      let tuitionPaidAmount: number;
      let tuitionPaidDate: Date | null = null;
      let tuitionInvoice: string | null = null;

      if (i < 20) {
        tuitionStatus = 'PAID';
        tuitionPaidAmount = 5000;
        tuitionPaidDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), (i % 10) + 1);
        tuitionInvoice = `INV-AIS-${nowDate.getFullYear()}-${String(i + 1).padStart(4, '0')}`;
      } else if (i < 25) {
        tuitionStatus = 'PARTIAL';
        tuitionPaidAmount = 2500;
      } else {
        tuitionStatus = 'PENDING';
        tuitionPaidAmount = 0;
      }

      await prisma.feeRecord.create({
        data: {
          tenantId: addis.id,
          studentId: student.id,
          feeStructureId: tuitionFee.id,
          amount: 5000,
          dueDate: tuitionDueDate,
          paidAmount: tuitionPaidAmount,
          status: tuitionStatus,
          paidDate: tuitionPaidDate,
          invoiceNumber: tuitionInvoice,
          paymentMethod: tuitionStatus !== 'PENDING' ? 'CASH' : null,
        },
      });
    }

    // ── Transport Fee Record ────────────────────────────────────────────────
    const existingTransportRecord = await prisma.feeRecord.findFirst({
      where: { tenantId: addis.id, studentId: student.id, feeStructureId: transportFee.id },
    });
    if (!existingTransportRecord) {
      let transportStatus: 'PAID' | 'PENDING' | 'OVERDUE';
      let transportPaidAmount: number;
      let transportPaidDate: Date | null = null;
      let transportDue: Date;

      if (i < 15) {
        transportStatus = 'PAID';
        transportPaidAmount = 1500;
        transportPaidDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), (i % 10) + 1);
        transportDue = transportDueDate;
      } else if (i < 25) {
        transportStatus = 'PENDING';
        transportPaidAmount = 0;
        transportDue = transportDueDate;
      } else {
        transportStatus = 'OVERDUE';
        transportPaidAmount = 0;
        transportDue = overdueDate;
      }

      await prisma.feeRecord.create({
        data: {
          tenantId: addis.id,
          studentId: student.id,
          feeStructureId: transportFee.id,
          amount: 1500,
          dueDate: transportDue,
          paidAmount: transportPaidAmount,
          status: transportStatus,
          paidDate: transportPaidDate,
          paymentMethod: transportStatus === 'PAID' ? 'BANK_TRANSFER' : null,
        },
      });
    }

    // ── Lab Fee Record — Grade 3 students only (index 20-29) ────────────────
    if (i >= 20) {
      const existingLabRecord = await prisma.feeRecord.findFirst({
        where: { tenantId: addis.id, studentId: student.id, feeStructureId: labFee.id },
      });
      if (!existingLabRecord) {
        await prisma.feeRecord.create({
          data: {
            tenantId: addis.id,
            studentId: student.id,
            feeStructureId: labFee.id,
            amount: 2000,
            dueDate: semesterDueDate,
            paidAmount: 0,
            status: 'PENDING',
          },
        });
      }
    }
  }

  console.log('   ✅ Tuition fee records: 20 PAID, 5 PARTIAL, 5 PENDING');
  console.log('   ✅ Transport fee records: 15 PAID, 10 PENDING, 5 OVERDUE');
  console.log('   ✅ Lab fee records: 10 PENDING (Grade 3 only)');

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5B — TenantConfig seed data
  // ════════════════════════════════════════════════════════════════════════════

  // Seed Ethiopia defaults for Addis International School
  await setTenantContext(addis.id);
  console.log('\n⚙️  Seeding tenant configs for Addis International...');

  const configCategories = [
    'general',
    'grading',
    'assessment',
    'promotion',
    'operations',
    'fees',
    'attendance',
    'reportCard',
  ] as const;

  type ConfigCategoryKey = (typeof configCategories)[number];

  for (const category of configCategories) {
    const defaultValue = ethiopiaDefaults[category as ConfigCategoryKey];
    await prisma.tenantConfig.upsert({
      where: { tenantId_category: { tenantId: addis.id, category } },
      update: {},
      create: {
        tenantId: addis.id,
        category,
        config: defaultValue as object,
        updatedBy: addisAdmin.id,
      },
    });
    console.log(`   ✅ ${category}`);
  }

  // Seed Ethiopia defaults for Hawassa Academy
  await setTenantContext(hawassa.id);
  console.log('\n⚙️  Seeding tenant configs for Hawassa Academy...');

  for (const category of configCategories) {
    const defaultValue = ethiopiaDefaults[category as ConfigCategoryKey];
    await prisma.tenantConfig.upsert({
      where: { tenantId_category: { tenantId: hawassa.id, category } },
      update: {},
      create: {
        tenantId: hawassa.id,
        category,
        config: defaultValue as object,
        updatedBy: hawassaAdmin.id,
      },
    });
    console.log(`   ✅ ${category}`);
  }

  // Restore context to addis for any further operations
  await setTenantContext(addis.id);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('🎉 Seed complete!\n');

  console.log('📊 Summary');
  console.log('─'.repeat(60));
  console.log(
    `${'Entity'.padEnd(30)} ${'Count'.padStart(6)}`,
  );
  console.log('─'.repeat(60));
  console.log(`${'Tenants'.padEnd(30)} ${'2'.padStart(6)}`);
  console.log(`${'School Admins'.padEnd(30)} ${'2'.padStart(6)}`);
  console.log(`${'Academic Years (Addis)'.padEnd(30)} ${'1'.padStart(6)}`);
  console.log(`${'Classes (Addis)'.padEnd(30)} ${'3'.padStart(6)}`);
  console.log(`${'Sections (Addis)'.padEnd(30)} ${'6'.padStart(6)}`);
  console.log(`${'Subjects (Addis)'.padEnd(30)} ${'6'.padStart(6)}`);
  console.log(`${'Class-Subject Links (Addis)'.padEnd(30)} ${'18'.padStart(6)}`);
  console.log(`${'Students (Addis)'.padEnd(30)} ${'30'.padStart(6)}`);
  console.log(`${'Parents (Addis)'.padEnd(30)} ${'10'.padStart(6)}`);
  console.log(`${'School Configs'.padEnd(30)} ${'2'.padStart(6)}`);
  console.log(`${'Attendance Records (Addis)'.padEnd(30)} ${'~210'.padStart(6)}`);
  console.log(`${'Fee Structures (Addis)'.padEnd(30)} ${'3'.padStart(6)}`);
  console.log(`${'Fee Records (Addis)'.padEnd(30)} ${'70'.padStart(6)}`);
  console.log(`${'Tenant Configs (per tenant)'.padEnd(30)} ${'8'.padStart(6)}`);
  console.log('─'.repeat(60));

  console.log('\nLogin credentials:');
  console.log('  Admin password:  Admin@123');
  console.log('  Parent password: Parent@123\n');
  console.log('  Addis International → X-Tenant-ID: addis-international');
  console.log('                        email: admin@addis.edu.et');
  console.log('  Hawassa Academy     → X-Tenant-ID: hawassa-academy');
  console.log('                        email: admin@hawassa.edu.et');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
