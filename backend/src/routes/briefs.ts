import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// GET /api/briefs/:requestId - get final brief
router.get('/:requestId', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true, finalBrief: true },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  // Access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  res.json(request.finalBrief);
});

// POST /api/briefs/:requestId - create/update final brief (mentor)
router.post('/:requestId', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const {
    title, initialDesc, clarifiedProblem, desiredOutcome, priority,
    constraints, prerequisites, incompleteInfo, criteria, openTopics,
    aiDraftContent,
  } = req.body;

  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const mentor = await prisma.user.findUnique({ where: { id: req.userId } });
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : '';

  const brief = await prisma.finalBrief.upsert({
    where: { requestId },
    create: {
      requestId,
      title: title || '',
      initialDesc: initialDesc || '',
      clarifiedProblem: clarifiedProblem || '',
      desiredOutcome: desiredOutcome || '',
      priority: priority || '',
      constraints: constraints || '',
      prerequisites: prerequisites || '',
      incompleteInfo: incompleteInfo || '',
      criteria: criteria || '',
      openTopics: openTopics || '',
      mentorName,
      summaryAt: new Date(),
      aiDraftContent: aiDraftContent || null,
      mentorApproved: false,
    },
    update: {
      title, initialDesc, clarifiedProblem, desiredOutcome, priority,
      constraints, prerequisites, incompleteInfo, criteria, openTopics,
      mentorName, summaryAt: new Date(),
      aiDraftContent: aiDraftContent || undefined,
      // Reset member approval when content changes
      memberApproved: null,
      memberFeedback: null,
    },
  });

  logAudit(req.userId, 'UPDATE_BRIEF', 'FinalBrief', requestId);
  res.json(brief);
});

// POST /api/briefs/:requestId/approve - mentor approves brief
router.post('/:requestId/approve', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const brief = await prisma.finalBrief.update({
    where: { requestId },
    data: { mentorApproved: true },
  });
  logAudit(req.userId, 'APPROVE_BRIEF', 'FinalBrief', requestId);
  res.json(brief);
});

// POST /api/briefs/:requestId/member-response - member approves or requests changes
router.post('/:requestId/member-response', requireRole('MEMBER'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const { approved, feedback } = req.body;

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });
  if (request.userId !== req.userId) return res.status(403).json({ error: 'دسترسی مجاز نیست' });

  // Check assignment is still active
  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || new Date() > assignment.expiresAt) {
    return res.status(400).json({ error: 'زمان فعال پرونده به پایان رسیده' });
  }

  const brief = await prisma.finalBrief.update({
    where: { requestId },
    data: { memberApproved: approved === true, memberFeedback: feedback || null },
  });
  res.json(brief);
});

// GET /api/briefs/:requestId/download - download brief as text (for PDF generation on client)
router.get('/:requestId/download', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true, finalBrief: true, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  res.json({
    brief: request.finalBrief,
    messages: request.messages,
    request,
  });
});

export default router;
