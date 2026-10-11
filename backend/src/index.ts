import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
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
