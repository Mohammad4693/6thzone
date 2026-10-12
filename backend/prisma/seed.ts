// Seraj seed — minimal v4: consent text settings only.
// The admin (reviewer) is bootstrapped from ADMIN_EMAIL / ADMIN_PASSWORD
// env vars by src/index.ts on every boot, so a fresh database is usable
// immediately (works on Render without running the seed).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONSENT_TEXT =
  'متن و صدای من برای تحلیل به سرویس هوش مصنوعی ارسال می‌شود و فقط ادمین سراج به پرونده من دسترسی دارد.';

async function main() {
  console.log('Seeding database...');
  await prisma.setting.upsert({
    where: { key: 'consent_text' },
    create: { key: 'consent_text', value: CONSENT_TEXT },
    update: { value: CONSENT_TEXT },
  });
  await prisma.setting.upsert({
    where: { key: 'consent_version' },
    create: { key: 'consent_version', value: '4.0' },
    update: { value: '4.0' },
  });
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
