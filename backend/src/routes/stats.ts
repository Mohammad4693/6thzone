// Admin statistics page (v4 §7) — aggregate metrics only.
import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/admin/stats
router.get('/stats', requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  const [totalRequests, finalBriefs, briefs, feedback, aiRounds, questions] = await Promise.all([
    prisma.request.count(),
    prisma.finalBrief.count({ where: { mentorApproved: true } }),
    prisma.finalBrief.findMany({
      where: { mentorApproved: true, summaryAt: { not: null } },
      include: { request: { select: { createdAt: true } } },
    }),
    prisma.feedback.findMany({ where: { status: 'SUBMITTED' }, select: { rating: true } }),
    prisma.aiRound.findMany({ select: { costUsd: true, tokensIn: true, tokensOut: true } }),
    prisma.proposedQuestion.findMany({ where: { source: 'AI' }, select: { status: true } }),
  ]);

  // Average time from submission to final brief (ms)
  const durations = briefs
    .filter((b) => b.summaryAt)
    .map((b) => (b.summaryAt!.getTime() - b.request.createdAt.getTime()));
  const avgMs = durations.length
    ? durations.reduce((s, d) => s + d, 0) / durations.length
    : null;

  // Satisfaction 1–5 distribution
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const f of feedback) distribution[String(f.rating)] = (distribution[String(f.rating)] || 0) + 1;

  // AI question outcomes
  const aiTotal = questions.length;
  const untouched = questions.filter((q) => q.status === 'APPROVED' || q.status === 'SENT').length;
  const edited = questions.filter((q) => q.status === 'EDITED').length;
  const deleted = questions.filter((q) => q.status === 'DELETED').length;
  const pct = (n: number) => (aiTotal > 0 ? Math.round((n / aiTotal) * 100) : null);

  const totalCost = aiRounds.reduce((s, r) => s + (r.costUsd || 0), 0);
  const totalTokensIn = aiRounds.reduce((s, r) => s + (r.tokensIn || 0), 0);
  const totalTokensOut = aiRounds.reduce((s, r) => s + (r.tokensOut || 0), 0);

  res.json({
    totalRequests,
    finalBriefs,
    avgHoursToBrief: avgMs === null ? null : Math.round((avgMs / 3600000) * 10) / 10,
    avgMinutesToBrief: avgMs === null ? null : Math.round(avgMs / 60000),
    satisfaction: {
      distribution,
      respondents: feedback.length,
    },
    aiQuestions: {
      total: aiTotal,
      approvedWithoutEdit: untouched,
      approvedWithoutEditPct: pct(untouched),
      edited,
      editedPct: pct(edited),
      deleted,
      deletedPct: pct(deleted),
    },
    aiCost: {
      calls: aiRounds.length,
      totalUsd: Math.round(totalCost * 10000) / 10000,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
    },
  });
});

export default router;
