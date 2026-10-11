import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// GET /api/mentor/dashboard
router.get('/dashboard', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const assignments = await prisma.assignment.findMany({
    where: { mentorId: req.userId, status: 'ACTIVE' },
    include: {
      request: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, profile: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          aiDrafts: { where: { status: 'PENDING_REVIEW' } },
          claritySections: true,
          sessions: { where: { status: { in: ['REQUESTED', 'SCHEDULED'] } } },
        },
      },
    },
  });

  const now = new Date();
  const dashboard = assignments.map(a => ({
    ...a,
    timeRemaining: Math.max(0, a.expiresAt.getTime() - now.getTime()),
    request: {
      ...a.request,
      newDrafts: a.request.aiDrafts.length,
      latestMessage: a.request.messages[0] || null,
      pendingSessions: a.request.sessions.length,
    },
  }));

  res.json(dashboard);
});

// GET /api/mentor/requests/:id
router.get('/requests/:id', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const assignment = await prisma.assignment.findUnique({
    where: { requestId: id },
    include: {
      request: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true, profile: true } },
          messages: { orderBy: { createdAt: 'asc' }, include: { attachment: true } },
          attachments: true,
          aiDrafts: { orderBy: { createdAt: 'desc' } },
          claritySections: true,
          sessions: true,
          finalBrief: true,
        },
      },
    },
  });

  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'این پرونده به شما تخصیص نیافته است' });
  }

  logAudit(req.userId, 'VIEW_CASE', 'Request', id, { role: 'MENTOR' });
  res.json(assignment);
});

// GET /api/mentor/availability — my weekly free windows
router.get('/availability', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const windows = await prisma.mentorAvailability.findMany({
    where: { mentorId: req.userId! },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
  res.json(windows);
});

// PUT /api/mentor/availability — replace my weekly free windows
router.put('/availability', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { windows } = req.body as {
    windows: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  };
  if (!Array.isArray(windows)) {
    return res.status(400).json({ error: 'بازه‌ها نامعتبر است' });
  }
  for (const w of windows) {
    if (
      !Number.isInteger(w.dayOfWeek) || w.dayOfWeek < 0 || w.dayOfWeek > 6 ||
      !Number.isInteger(w.startMinute) || !Number.isInteger(w.endMinute) ||
      w.startMinute < 0 || w.endMinute > 1440 || w.endMinute - w.startMinute < 15
    ) {
      return res.status(400).json({ error: 'هر بازه باید حداقل ۱۵ دقیقه باشد و روز/ساعت معتبر داشته باشد' });
    }
  }

  await prisma.mentorAvailability.deleteMany({ where: { mentorId: req.userId! } });
  if (windows.length > 0) {
    await prisma.mentorAvailability.createMany({
      data: windows.map(w => ({
        mentorId: req.userId!,
        dayOfWeek: w.dayOfWeek,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      })),
    });
  }
  logAudit(req.userId, 'UPDATE_AVAILABILITY', 'MentorAvailability', req.userId, { count: windows.length });

  const saved = await prisma.mentorAvailability.findMany({
    where: { mentorId: req.userId! },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
  res.json(saved);
});

export default router;
