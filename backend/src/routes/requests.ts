import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { FLAGS } from '../config/flags';
import { startAnalysis } from '../services/analysis';

const router = Router();

// v4: audio is stored IN THE DATABASE (bytes), never on disk — the Render
// free tier wipes the filesystem on restart. Compressed webm/opus, max 3 min.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // ~3 minutes of webm/opus
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('audio/');
    cb(ok ? null : (new Error('فایل صوتی مجاز نیست') as any), ok);
  },
});

export const CONSENT_TEXT_V4 =
  'متن و صدای من برای تحلیل به سرویس هوش مصنوعی ارسال می‌شود و فقط ادمین سراج به پرونده من دسترسی دارد.';
export const CONSENT_WARNING_V4 = 'لطفاً کد ملی و شماره حساب ننویسید.';
export const CONSENT_VERSION_V4 = '4.0';

// GET consent text (current version)
router.get('/consent', async (_req, res) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'consent_text' } });
  const version = await prisma.setting.findUnique({ where: { key: 'consent_version' } });
  res.json({
    text: setting?.value || CONSENT_TEXT_V4,
    version: version?.value || CONSENT_VERSION_V4,
    warning: CONSENT_WARNING_V4,
  });
});

// GET consent status for the logged-in member (first-login gate)
router.get('/consent-status', requireRole('MEMBER'), async (req: AuthRequest, res) => {
  const accepted = await prisma.consentRecord.findFirst({
    where: { userId: req.userId },
  });
  res.json({ accepted: !!accepted });
});

// POST /api/requests/consent — record the first-login consent tick
router.post('/consent', requireRole('MEMBER'), async (req: AuthRequest, res) => {
  const { accepted } = req.body;
  if (accepted !== true) return res.status(400).json({ error: 'پذیرش رضایت الزامی است' });

  const existing = await prisma.consentRecord.findFirst({ where: { userId: req.userId! } });
  if (!existing) {
    await prisma.consentRecord.create({
      data: {
        userId: req.userId,
        version: CONSENT_VERSION_V4,
        text: CONSENT_TEXT_V4,
      },
    });
    logAudit(req.userId, 'ACCEPT_CONSENT', 'User', req.userId);
  }
  res.json({ ok: true });
});

// POST /api/requests — create request (member). The description is the
// member-CONFIRMED transcript or typed text; optional audio is stored in the
// DB for admin playback. AI analysis is kicked off asynchronously.
router.post('/', requireRole('MEMBER'), upload.single('voice'), async (req: AuthRequest, res) => {
  const { description, title } = req.body;

  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'متن تأییدشده نیاز الزامی است' });
  }

  // Server-side consent enforcement (not just UI)
  const consent = await prisma.consentRecord.findFirst({ where: { userId: req.userId! } });
  if (!consent) {
    return res.status(403).json({ error: 'ابتدا فرم رضایت را بپذیرید' });
  }

  let attachmentId: string | undefined;
  if (req.file) {
    const att = await prisma.attachment.create({
      data: {
        filename: `voice-${Date.now()}.webm`,
        originalName: req.file.originalname || 'voice.webm',
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
        uploadedBy: req.userId!,
        requestId: null,
      },
    });
    attachmentId = att.id;
  }

  const request = await prisma.request.create({
    data: {
      userId: req.userId!,
      title: title || null,
      description: String(description).trim(),
      status: 'PENDING_REVIEW',
      consentVersion: CONSENT_VERSION_V4,
      consentAcceptedAt: consent.acceptedAt,
      attachments: attachmentId ? { connect: { id: attachmentId } } : undefined,
    },
    include: { attachments: true },
  });

  logAudit(req.userId, 'CREATE_REQUEST', 'Request', request.id);

  // Async AI analysis — response returns immediately with "در حال تحلیل" status
  startAnalysis(request.id);

  res.status(201).json(request);
});

// GET /api/requests - list my requests (member) or all (admin)
router.get('/', async (req: AuthRequest, res) => {
  if (req.userRole === 'MEMBER') {
    const requests = await prisma.request.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  }
  if (req.userRole === 'MENTOR') {
    // Legacy mentor flow (flag off in v4)
    if (!FLAGS.mentorAssignment) return res.status(403).json({ error: 'این بخش در نسخه تست فعال نیست' });
    const assignments = await prisma.assignment.findMany({
      where: { mentorId: req.userId, status: 'ACTIVE' },
      include: { request: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, contribution: true } } },
    });
    return res.json(assignments.map((a) => a.request));
  }
  // Admin sees all (without AI internals — use /api/cases for those)
  const requests = await prisma.request.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      finalBrief: { select: { mentorApproved: true, memberApproved: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

// GET /api/requests/:id
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { attachment: true } },
      attachments: true,
      finalBrief: true,
      consentRecords: true,
      feedback: true,
    },
  });

  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

  // Server-side access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی به این پرونده مجاز نیست' });
  }
  if (req.userRole === 'MENTOR') {
    if (!FLAGS.mentorAssignment) return res.status(403).json({ error: 'این بخش در نسخه تست فعال نیست' });
    const assignment = await prisma.assignment.findUnique({ where: { requestId: id } });
    if (!assignment || assignment.mentorId !== req.userId) {
      return res.status(403).json({ error: 'این پرونده به شما تخصیص نیافته است' });
    }
  }

  logAudit(req.userId!, 'VIEW_CASE', 'Request', id, { role: req.userRole });

  if (req.userRole === 'MEMBER') {
    // RULE: no AI output ever reaches the member API/UI without admin approval.
    // Members only get the round STATUS (for "در حال تحلیل" indicator).
    const lastRound = await prisma.aiRound.findFirst({
      where: { requestId: id, kind: 'ANALYSIS' },
      orderBy: { createdAt: 'desc' },
    });
    const memberView: any = {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status,
      domain: request.domain,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      messages: request.messages,
      attachments: request.attachments,
      finalBrief: request.finalBrief && request.finalBrief.mentorApproved ? request.finalBrief : null,
      feedback: request.feedback.filter((f) => f.userId === req.userId),
      analysisStatus: lastRound ? lastRound.status : null, // PENDING | DONE | FAILED
    };
    return res.json(memberView);
  }

  res.json(request);
});

export default router;
