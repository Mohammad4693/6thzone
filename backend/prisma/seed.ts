import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default settings
  await prisma.setting.upsert({
    where: { key: 'contribution_amount' },
    create: { key: 'contribution_amount', value: '150000' },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'consent_text' },
    create: {
      key: 'consent_text',
      value: 'سراج فقط به روشن‌شدن نیاز شما کمک می‌کند. این خدمت مشاوره تخصصی، توصیه اجرایی یا تضمین نتیجه نیست. پرداخت وجه به منتور، سفارش خدمت تخصصی یا انعقاد قرارداد با او در قالب سراج مجاز نیست. تصمیم‌ها و اقدام‌های بعدی خارج از این خدمت، با انتخاب خود شما انجام می‌شود.',
    },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'consent_version' },
    create: { key: 'consent_version', value: '1.0' },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'domains' },
    create: { key: 'domains', value: JSON.stringify(['legal']) },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'data_retention_days' },
    create: { key: 'data_retention_days', value: '365' },
    update: {},
  });

  // Create first admin user
  const adminPhone = '+989000000001';
  const existingAdmin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123456', 10);
    await prisma.user.create({
      data: {
        phone: adminPhone,
        firstName: 'مدیر',
        lastName: 'سراج',
        role: Role.ADMIN,
        passwordHash,
        phoneVerified: 'VERIFIED',
      },
    });
    console.log('Admin user created:');
    console.log('  Phone: +989000000001');
    console.log('  (Login via OTP — in dev mode, code is shown in API response)');
  }

  // Create a test mentor
  const mentorPhone = '+989000000002';
  const existingMentor = await prisma.user.findUnique({ where: { phone: mentorPhone } });
  if (!existingMentor) {
    const passwordHash = await bcrypt.hash('mentor123456', 10);
    const mentor = await prisma.user.create({
      data: {
        phone: mentorPhone,
        firstName: 'منتور',
        lastName: 'آزمایشی',
        role: Role.MENTOR,
        passwordHash,
        phoneVerified: 'VERIFIED',
        mentorProfile: {
          create: {
            expertise: ['حقوقی'],
            capacity: 5,
          },
        },
      },
    });
    console.log('Mentor user created:');
    console.log('  Phone: +989000000002');
  }

  // Create a test member
  const memberPhone = '+989000000003';
  const existingMember = await prisma.user.findUnique({ where: { phone: memberPhone } });
  if (!existingMember) {
    const passwordHash = await bcrypt.hash('member123456', 10);
    await prisma.user.create({
      data: {
        phone: memberPhone,
        firstName: 'عضو',
        lastName: 'آزمایشی',
        role: Role.MEMBER,
        passwordHash,
        phoneVerified: 'VERIFIED',
        profile: {
          create: {
            serviceGroup: 'گروه آزمایشی',
            activityDesc: 'شرح فعالیت آزمایشی',
            verification: 'VERIFIED',
            verifiedAt: new Date(),
          },
        },
      },
    });
    console.log('Member user created:');
    console.log('  Phone: +989000000003');
  }

  console.log('Seed complete.');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
