import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { prisma } from './prisma';
import { FLAGS, flagResponse } from './config/flags';
import authRoutes from './routes/auth';
import requestRoutes from './routes/requests';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import adminMembersRoutes from './routes/adminMembers';
import adminStatsRoutes from './routes/stats';
import mentorRoutes from './routes/mentor';
import fileRoutes from './routes/files';
import settingsRoutes from './routes/settings';
import feedbackRoutes from './routes/feedback';
import sessionRoutes from './routes/sessions';
import clarityRoutes from './routes/clarity';
import briefRoutes from './routes/briefs';
import aiRoutes from './routes/ai';
import casesRoutes from './routes/cases';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public feature flags (frontend hides disabled features)
app.get('/api/flags', (_req, res) => {
  res.json(flagResponse());
});

// Static files for legacy disk uploads (payments flag) — v4 audio lives in the DB
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes — v4
app.use('/api/requests', authMiddleware, requestRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/cases', authMiddleware, casesRoutes); // admin review workflow
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/admin/members', authMiddleware, adminMembersRoutes);
app.use('/api/admin/stats', authMiddleware, adminStatsRoutes);
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/briefs', authMiddleware, briefRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

// Legacy feature-flagged routes (stay in the codebase, off in the v4 MVP)
if (FLAGS.mentorAssignment) {
  app.use('/api/mentor', authMiddleware, mentorRoutes);
  app.use('/api/clarity', authMiddleware, clarityRoutes);
}
if (FLAGS.sessions) {
  app.use('/api/sessions', authMiddleware, sessionRoutes);
}

// Profile route
app.get('/api/profile', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true, mentorProfile: true },
    });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phoneVerified: user.phoneVerified,
      profile: user.profile,
      mentorProfile: user.mentorProfile,
    });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Seraj] Server running on port ${PORT}`);
});

// Bootstrap the first admin (reviewer) from environment, so a fresh Render
// database becomes usable without running the seed script.
// Default dev credentials (change via ADMIN_EMAIL / ADMIN_PASSWORD env vars,
// or in the Render dashboard). The password is documented in the README and
// must be changed before any real use.
async function ensureAdminFromEnv() {
  const email = (process.env.ADMIN_EMAIL || 'admin@seraj.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'seraj-admin-2026';
  const useEnv = !!process.env.ADMIN_EMAIL;
  if (!email) return;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        phone: `admin-${email}`, // unique placeholder; admins log in with email
        firstName: 'ادمین',
        lastName: 'سراج',
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`[Seraj] Admin reviewer created: ${email}`);
  } catch (e: any) {
    console.error('[Seraj] Admin bootstrap failed:', e.message);
  }
}
ensureAdminFromEnv();

// Legacy 72h auto-close sweep — only runs when FLAG_AUTO_CLOSE_72H is on
// (off in the v4 MVP).
if (FLAGS.autoClose72h) {
  const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

  async function sweepExpiredCases() {
    try {
      const expired = await prisma.assignment.findMany({
        where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      });
      for (const a of expired) {
        const now = new Date();
        const delayHours = a.targetAt
          ? Math.max(0, Math.ceil((now.getTime() - a.targetAt.getTime()) / 3600000))
          : null;
        await prisma.$transaction([
          prisma.assignment.update({
            where: { id: a.id },
            data: { status: 'EXPIRED', closedAt: now, completedAt: null, delayHours },
          }),
          prisma.request.update({
            where: { id: a.requestId },
            data: { status: 'CLOSED_EXPIRED', closedAt: now },
          }),
          prisma.mentorProfile.update({
            where: { userId: a.mentorId },
            data: { activeCount: { decrement: 1 } },
          }),
        ]);
        console.log(`[Seraj] Case ${a.requestId} closed (72h expiry), delayHours=${delayHours}`);
      }
    } catch (e: any) {
      console.error('[Seraj] Expiry sweep failed:', e.message);
    }
  }

  setInterval(sweepExpiredCases, EXPIRY_SWEEP_INTERVAL_MS);
  setTimeout(sweepExpiredCases, 10 * 1000);
}
