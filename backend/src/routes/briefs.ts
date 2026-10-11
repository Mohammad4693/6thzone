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
    constraints, prerequisites, incompleteInfo, criteria, nextStep, openTopics,
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
      nextStep: nextStep || '',
      openTopics: openTopics || '',
      mentorName,
      summaryAt: new Date(),
      aiDraftContent: aiDraftContent || null,
      mentorApproved: false,
    },
    update: {
      title, initialDesc, clarifiedProblem, desiredOutcome, priority,
      constraints, prerequisites, incompleteInfo, criteria, nextStep, openTopics,
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

// GET /api/briefs/:requestId/download - print-ready HTML download of the final brief.
// Member can download only after BOTH mentor and member have approved.
router.get('/:requestId/download', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: { include: { mentor: { select: { firstName: true, lastName: true } } } }, finalBrief: true },
  });
  if (!request || !request.finalBrief) return res.status(404).json({ error: 'برگه یافت نشد' });

  if (req.userRole === 'MEMBER') {
    if (request.userId !== req.userId) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    if (!request.finalBrief.mentorApproved || request.finalBrief.memberApproved !== true) {
      return res.status(403).json({ error: 'دانلود پس از تأیید منتور و تأیید خودتان فعال می‌شود' });
    }
  }
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const b = request.finalBrief;
  const section = (label: string, value?: string | null) => `
    <section class="sec">
      <h2>${label}</h2>
      <p>${escapeHtml(value || '—')}</p>
    </section>`;

  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(b.title || 'برگه روشن نیاز')}</title>
<style>
  body { font-family: Tahoma, 'Vazirmatn', sans-serif; direction: rtl; color: #1d1c1a; max-width: 720px; margin: 32px auto; padding: 0 16px; line-height: 1.9; }
  h1 { font-size: 20px; border-bottom: 2px solid #F69A46; padding-bottom: 8px; }
  .meta { color: #6b6560; font-size: 12px; margin-bottom: 24px; }
  .sec { margin-bottom: 18px; page-break-inside: avoid; }
  .sec h2 { font-size: 14px; color: #F69A46; margin: 0 0 4px; }
  .sec p { margin: 0; white-space: pre-wrap; font-size: 13px; }
  footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 11px; color: #6b6560; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>برگه روشن نیاز — ${escapeHtml(b.title || 'بدون عنوان')}</h1>
  <div class="meta">شرح اولیه فرد: ${escapeHtml(b.initialDesc || '—')}</div>
  ${section('نیاز روشن (مسئله)', b.clarifiedProblem)}
  ${section('اولویت‌ها', b.priority)}
  ${section('اطلاعات ناقص', b.incompleteInfo)}
  ${section('معیارهای انتخاب منابع', b.criteria)}
  ${section('قدم بعدی', b.nextStep)}
  <footer>
    منتور: ${escapeHtml(b.mentorName || '—')} — تأیید منتور: ${b.mentorApproved ? 'دارد' : 'ندارد'} — تأیید فرد: ${b.memberApproved === true ? 'دارد' : 'ندارد'}
    <br>سراج — این برگه فقط برای روشن‌شدن نیاز است و مشاوره تخصصی محسوب نمی‌شود.
  </footer>
</body>
</html>`;

  logAudit(req.userId, 'DOWNLOAD_BRIEF', 'Request', requestId);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="seraj-brief-${requestId.slice(0, 8)}.html"`);
  res.send(html);
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
