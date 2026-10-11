import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { prisma } from './prisma';
import authRoutes from './routes/auth';
import requestRoutes from './routes/requests';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import mentorRoutes from './routes/mentor';
import fileRoutes from './routes/files';
import settingsRoutes from './routes/settings';
import feedbackRoutes from './routes/feedback';
import sessionRoutes from './routes/sessions';
import clarityRoutes from './routes/clarity';
import briefRoutes from './routes/briefs';
import aiRoutes from './routes/ai';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files for uploads (protected by auth in routes)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/requests', authMiddleware, requestRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/mentor', authMiddleware, mentorRoutes);
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/sessions', authMiddleware, sessionRoutes);
app.use('/api/clarity', authMiddleware, clarityRoutes);
app.use('/api/briefs', authMiddleware, briefRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

// Profile route
app.get('/api/profile', authMiddleware, async (req: any, res) => {
  try {
    const user = await (await import('./prisma')).prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true, mentorProfile: true },
    });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    res.json({
      id: user.id,
      phone: user.phone,
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

// Expiry sweep: when the configurable hard expiry passes without the member's
// response, close the case read-only (CLOSED_EXPIRED), record the delay vs the
// 24h clarify target, and release the mentor's slot. Runs every 5 minutes.
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
// Run once shortly after boot
setTimeout(sweepExpiredCases, 10 * 1000);
