import { PrismaClient, PlanType, CalendarType, UserRole } from '@prisma/client';
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

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(60));
  console.log('🎉 Seed complete!\n');
  console.log('Login credentials (password: Admin@123):');
  console.log(`  Addis International → X-Tenant-ID: addis-international`);
  console.log(`                        email: admin@addis.edu.et`);
  console.log(`  Hawassa Academy     → X-Tenant-ID: hawassa-academy`);
  console.log(`                        email: admin@hawassa.edu.et`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
