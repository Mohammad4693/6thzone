// v4 admin case-review endpoints. Everything here is ADMIN-only: AI rounds,
// proposed questions (approve / edit / delete / manual add), sending approved
// questions to the member, the final sheet, closing a case, and the
// "needs action" queue.
import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { startAnalysis, startFinalSheet } from '../services/analysis';

const router = Router();

// GET /api/cases/:id/rounds — AI rounds + proposed questions (admin only)
router.get('/:id/rounds', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const rounds = await prisma.aiRound.findMany({
    where: { requestId: req.params.id, kind: 'ANALYSIS' },
    orderBy: { createdAt: 'asc' },
  });
  const questions = await prisma.proposedQuestion.findMany({
    where: { requestId: req.params.id },
    orderBy: { order: 'asc' },
  });
  res.json({ rounds, questions });
});

// GET /api/cases/:id/final-draft — latest DONE final-sheet AI draft (admin only)
router.get('/:id/final-draft', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const round = await prisma.aiRound.findFirst({
    where: { requestId: req.params.id, kind: 'FINAL_SHEET', status: 'DONE' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(round || null);
});

// POST /api/cases/rounds/:roundId/retry — retry a failed round
router.post('/rounds/:roundId/retry', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const round = await prisma.aiRound.findUnique({ where: { id: req.params.roundId } });
  if (!round) return res.status(404).json({ error: 'دور تحلیل یافت نشد' });
  if (round.status === 'PENDING') return res.status(400).json({ error: 'این دور هنوز در حال تحلیل است' });

  if (round.kind === 'ANALYSIS') startAnalysis(round.requestId);
  else startFinalSheet(round.requestId);

  logAudit(req.userId, 'RETRY_AI_ROUND', 'AiRound', round.id);
  res.status(202).json({ ok: true });
});

// POST /api/cases/:id/final-sheet/generate — kick off AI final-sheet draft (async)
router.post('/:id/final-sheet/generate', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const request = await prisma.request.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  const pending = await prisma.aiRound.findFirst({
    where: { requestId: request.id, kind: 'FINAL_SHEET', status: 'PENDING' },
  });
  if (pending) return res.status(409).json({ error: 'پیش‌نویس قبلاً در حال ساخت است' });

  startFinalSheet(request.id);
  logAudit(req.userId, 'GENERATE_FINAL_SHEET', 'Request', request.id);
  res.status(202).json({ ok: true, message: 'در حال ساخت پیش‌نویس برگه' });
});

// POST /api/cases/:id/final-sheet — admin edits + approves the final sheet
router.post('/:id/final-sheet', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const request = await prisma.request.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  const { title, problem, outcome, constraints_cost, resources_info, next_step, missing_info } = req.body;
  const admin = await prisma.user.findUnique({ where: { id: req.userId } });

  const brief = await prisma.finalBrief.upsert({
    where: { requestId: request.id },
    create: {
      requestId: request.id,
      title: title || request.title || '',
      initialDesc: request.description || '',
      clarifiedProblem: problem || '',
      desiredOutcome: outcome || '',
      constraints: constraints_cost || '',
      incompleteInfo: missing_info || '',
      nextStep: next_step || '',
      mentorName: admin ? `${admin.firstName} ${admin.lastName}` : '',
      summaryAt: new Date(),
      mentorApproved: true,
    },
    update: {
      title: title ?? undefined,
      clarifiedProblem: problem ?? undefined,
      desiredOutcome: outcome ?? undefined,
      constraints: constraints_cost ?? undefined,
      incompleteInfo: missing_info ?? undefined,
      nextStep: next_step ?? undefined,
      summaryAt: new Date(),
      mentorApproved: true,
      memberApproved: null, // re-approval needed after changes
      memberFeedback: null,
    },
  });

  logAudit(req.userId, 'APPROVE_FINAL_SHEET', 'Request', request.id);
  res.json(brief);
});

// POST /api/cases/questions — manual question add
router.post('/:id/questions', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const request = await prisma.request.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'متن سؤال الزامی است' });

  const order = await prisma.proposedQuestion.count({ where: { requestId: request.id } });
  const question = await prisma.proposedQuestion.create({
    data: { requestId: request.id, text: String(text).trim(), source: 'MANUAL', order },
  });
  logAudit(req.userId, 'ADD_QUESTION', 'Request', request.id);
  res.status(201).json(question);
});

// PUT /api/cases/questions/:questionId — edit a question
router.put('/questions/:questionId', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'متن سؤال الزامی است' });
  const question = await prisma.proposedQuestion.update({
    where: { id: req.params.questionId },
    data: { text: String(text).trim(), status: 'EDITED' },
  });
  logAudit(req.userId, 'EDIT_QUESTION', 'ProposedQuestion', question.id);
  res.json(question);
});

// POST /api/cases/questions/:questionId/approve
router.post('/questions/:questionId/approve', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const question = await prisma.proposedQuestion.update({
    where: { id: req.params.questionId },
    data: { status: 'APPROVED' },
  });
  logAudit(req.userId, 'APPROVE_QUESTION', 'ProposedQuestion', question.id);
  res.json(question);
});

// DELETE /api/cases/questions/:questionId — soft delete (stays for stats)
router.delete('/questions/:questionId', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const question = await prisma.proposedQuestion.update({
    where: { id: req.params.questionId },
    data: { status: 'DELETED' },
  });
  logAudit(req.userId, 'DELETE_QUESTION', 'ProposedQuestion', question.id);
  res.json(question);
});

// POST /api/cases/:id/send-questions — only APPROVED/EDITED questions reach the member
router.post('/:id/send-questions', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const request = await prisma.request.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  const approved = await prisma.proposedQuestion.findMany({
    where: { requestId: request.id, status: { in: ['APPROVED', 'EDITED'] } },
    orderBy: { order: 'asc' },
  });
  if (approved.length === 0) {
    return res.status(400).json({ error: 'هیچ سؤال تأییدشده‌ای برای ارسال نیست' });
  }

  const messages = [];
  for (const q of approved) {
    const message = await prisma.message.create({
      data: {
        requestId: request.id,
        sender: 'MENTOR', // admin/reviewer messages arrive in the member thread
        userId: req.userId,
        type: 'TEXT',
        content: q.text,
        status: 'SENT',
      },
    });
    await prisma.proposedQuestion.update({
      where: { id: q.id },
      data: { status: 'SENT' },
    });
    messages.push(message);
  }

  // Case moves to "awaiting member answers"
  const updated = await prisma.request.update({
    where: { id: request.id },
    data: { status: 'APPROVED' },
  });

  logAudit(req.userId, 'SEND_QUESTIONS', 'Request', request.id, { count: messages.length });
  res.json({ messages, request: updated });
});

// POST /api/cases/:id/close — admin closes the case manually
router.post('/:id/close', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { type } = req.body; // 'completed' | 'incomplete'
  const request = await prisma.request.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });
  if (request.status.startsWith('CLOSED')) {
    return res.status(400).json({ error: 'این پرونده قبلاً بسته شده است' });
  }

  const status = type === 'completed' ? 'CLOSED_COMPLETED' : 'CLOSED_INCOMPLETE';
  const closed = await prisma.request.update({
    where: { id: request.id },
    data: { status, closedAt: new Date() },
  });
  logAudit(req.userId, 'CLOSE_REQUEST', 'Request', request.id, { type });
  res.json(closed);
});

// GET /api/cases/needs-action — queue of cases waiting for an admin move.
// A case needs action when: it has no analysis yet, its latest analysis
// FAILED, its latest analysis produced questions none of which were sent, or
// its final-sheet draft has not been turned into a brief yet.
router.get('/needs-action/all', requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  const active = await prisma.request.findMany({
    where: { status: { notIn: ['CLOSED_EXPIRED', 'CLOSED_COMPLETED', 'CLOSED_INCOMPLETE', 'REJECTED'] } },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      aiRounds: { orderBy: { createdAt: 'desc' } },
      finalBrief: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const needsAction = [];
  for (const r of active) {
    const lastAnalysis = [...r.aiRounds].reverse().find((x) => x.kind === 'ANALYSIS') || null;
    const lastFinal = [...r.aiRounds].reverse().find((x) => x.kind === 'FINAL_SHEET') || null;
    const sentCount = r.aiRounds.length > 0
      ? await prisma.proposedQuestion.count({ where: { requestId: r.id, status: 'SENT' } })
      : 0;

    let reason: string | null = null;
    if (lastFinal && lastFinal.status === 'DONE' && !r.finalBrief) {
      reason = 'پیش‌نویس برگه نهایی آماده است';
    } else if (!lastAnalysis || lastAnalysis.status === 'PENDING') {
      reason = null; // analysis in progress — nothing to do yet
    } else if (lastAnalysis.status === 'FAILED') {
      reason = 'تحلیل هوش مصنوعی ناموفق بود — تلاش دوباره یا سؤال دستی';
    } else if (lastAnalysis.status === 'DONE' && sentCount === 0) {
      reason = 'خروجی تحلیل آماده بررسی است';
    } else if (
      lastAnalysis.status === 'DONE' &&
      sentCount > 0 &&
      r.status === 'APPROVED' &&
      r.messages.length > 0 &&
      r.messages[0].sender === 'MEMBER' &&
      r.messages[0].createdAt > lastAnalysis.createdAt
    ) {
      reason = 'پاسخ تازه ثبت شده است';
    }

    if (reason) {
      needsAction.push({
        id: r.id,
        member: `${r.user.firstName} ${r.user.lastName}`,
        phone: r.user.phone,
        status: r.status,
        reason,
        updatedAt: r.updatedAt,
      });
    }
  }

  res.json(needsAction);
});

export default router;
