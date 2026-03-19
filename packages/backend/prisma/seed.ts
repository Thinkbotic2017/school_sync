import {
  PrismaClient,
  PlanType,
  CalendarType,
  UserRole,
  SubjectType,
  Gender,
  StudentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

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

async function main() {
  console.log('🌱 Seeding database...\n');

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

  const subjects = await Promise.all(
    subjectDefs.map((s) =>
      prisma.subject.upsert({
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
      }),
    ),
  );

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

  const students = await Promise.all(
    studentDefs.map((s) =>
      prisma.student.upsert({
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
      }),
    ),
  );

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
