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

  res.json(assignment);
});

export default router;
