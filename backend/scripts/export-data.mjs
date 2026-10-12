#!/usr/bin/env node
// Seraj data export — for the Render FREE Postgres (expires after ~30 days,
// no backups). Dumps every table to a single JSON file; audio attachments are
// written as files next to it.
//
// Usage (Render shell or local with DATABASE_URL set):
//   cd backend && node scripts/export-data.mjs /tmp/seraj-export
//
// Restore path: import the JSON with the same script's counterpart, or use
// pg_dump for a plan upgrade (see README "خروجی گرفتن از داده‌ها").
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TABLES = [
  'user', 'otpCode', 'loginLink', 'profile', 'mentorProfile', 'request',
  'assignment', 'mentorAvailability', 'message', 'attachment', 'aIDraft',
  'claritySection', 'progressSection', 'aiRound', 'proposedQuestion',
  'session', 'finalBrief', 'consentRecord', 'contribution', 'feedback',
  'auditLog', 'setting',
];

async function main() {
  const outDir = process.argv[2] || path.join(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  let audioCount = 0;

  for (const table of TABLES) {
    const rows = await prisma[table].findMany();
    const serialized = rows.map((row) => {
      const copy = { ...row };
      if (copy.data instanceof Uint8Array) {
        // Audio: write to its own file, keep only metadata in the JSON
        const dir = path.join(outDir, 'audio');
        fs.mkdirSync(dir, { recursive: true });
        const ext = (copy.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
        const file = path.join(dir, `${copy.id}.${ext}`);
        fs.writeFileSync(file, Buffer.from(copy.data));
        copy.data = `[audio file: ${path.basename(file)}]`;
        audioCount += 1;
      }
      return copy;
    });
    dump.tables[table] = serialized;
    console.log(`${table}: ${serialized.length} rows`);
  }

  const outFile = path.join(outDir, `seraj-export-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));
  console.log(`Export complete: ${outFile} (${audioCount} audio files in ${path.join(outDir, 'audio')})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
