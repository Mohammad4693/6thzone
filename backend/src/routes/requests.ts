import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// Multer config for voice/file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ok = allowed.some(a => file.mimetype.startsWith(a));
    cb(ok ? null : new Error('نوع فایل مجاز نیست'), ok);
  },
});

// GET consent text (current version)
router.get('/consent', async (_req, res) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'consent_text' } });
  const version = await prisma.setting.findUnique({ where: { key: 'consent_version' } });
  res.json({
    text: setting?.value || DEFAULT_CONSENT_TEXT,
    version: version?.value || '1.0',
  });
});

// POST /api/requests - create new request (member)
router.post('/', requireRole('MEMBER'), upload.single('voice'), async (req: AuthRequest, res) => {
  const { description, title, consentAccepted, consentVersion } = req.body;

  if (!description && !req.file) {
    return res.status(400).json({ error: 'متن یا فایل صوتی الزامی است' });
  }

  if (!consentAccepted || consentAccepted !== 'true') {
    return res.status(400).json({ error: 'پذیرش فرم رضایت الزامی است' });
  }

  // Get contribution amount from settings
  const amountSetting = await prisma.setting.findUnique({ where: { key: 'contribution_amount' } });
  const amount = parseInt(amountSetting?.value || '150000');

  // Get consent text
  const consentSetting = await prisma.setting.findUnique({ where: { key: 'consent_text' } });
  const cVersion = await prisma.setting.findUnique({ where: { key: 'consent_version' } });
  const consentText = consentSetting?.value || DEFAULT_CONSENT_TEXT;
  const cVer = cVersion?.value || '1.0';

  let attachmentId: string | undefined;
  let finalDesc = description || '';

  if (req.file) {
    const att = await prisma.attachment.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.userId!,
        requestId: null,
      },
    });
    attachmentId = att.id;
    // If no text description, note that it's a voice file
    if (!finalDesc) finalDesc = '[پیام صوتی - در انتظار تبدیل به متن]';
  }

  const request = await prisma.request.create({
    data: {
      userId: req.userId!,
      title: title || null,
      description: finalDesc,
      status: 'PENDING_REVIEW',
      contributionAmount: amount,
      consentVersion: cVer,
      consentAcceptedAt: new Date(),
      consentRecords: {
        create: {
          version: cVer,
          text: consentText,
        },
      },
      contribution: {
        create: {
          amount,
          status: 'PENDING',
        },
      },
      attachments: attachmentId ? { connect: { id: attachmentId } } : undefined,
    },
    include: { contribution: true, attachments: true },
  });

  logAudit(req.userId, 'CREATE_REQUEST', 'Request', request.id);
  res.json(request);
});

// GET /api/requests - list my requests (member) or assigned (mentor)
router.get('/', async (req: AuthRequest, res) => {
  if (req.userRole === 'MEMBER') {
    const requests = await prisma.request.findMany({
      where: { userId: req.userId },
      include: { assignment: { include: { mentor: { include: { mentorProfile: true } } } }, contribution: true, feedback: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  }
  if (req.userRole === 'MENTOR') {
    const assignments = await prisma.assignment.findMany({
      where: { mentorId: req.userId, status: 'ACTIVE' },
      include: { request: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, contribution: true } } },
    });
    return res.json(assignments.map(a => a.request));
  }
  // Admin sees all
  const requests = await prisma.request.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, profile: true } },
      assignment: { include: { mentor: { include: { mentorProfile: true } } } },
      contribution: true,
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
      user: { select: { id: true, firstName: true, lastName: true, phone: true, profile: true } },
      assignment: { include: { mentor: { include: { mentorProfile: true, profile: true } } } },
      messages: { orderBy: { createdAt: 'asc' }, include: { attachment: true } },
      attachments: true,
      aiDrafts: true,
      claritySections: true,
      sessions: true,
      finalBrief: true,
      contribution: true,
      consentRecords: true,
      feedback: true,
    },
  });

  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

  // Access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی به این پرونده مجاز نیست' });
  }
  if (req.userRole === 'MENTOR') {
    if (!request.assignment || request.assignment.mentorId !== req.userId) {
      return res.status(403).json({ error: 'این پرونده به شما تخصیص نیافته است' });
    }
    // Hide AI drafts from member view (mentor sees them)
  }

  // Access to case files is logged for the record (سؤال ۹: لاگ دسترسی به پرونده‌ها)
  logAudit(req.userId!, 'VIEW_CASE', 'Request', id, { role: req.userRole });

  // For members, strip AI drafts
  if (req.userRole === 'MEMBER') {
    (request as any).aiDrafts = [];
  }

  res.json(request);
});

export const DEFAULT_CONSENT_TEXT = `سراج فقط به روشن‌شدن نیاز شما کمک می‌کند. این خدمت مشاوره تخصصی، توصیه اجرایی یا تضمین نتیجه نیست. پرداخت وجه به منتور، سفارش خدمت تخصصی یا انعقاد قرارداد با او در قالب سراج مجاز نیست. تصمیم‌ها و اقدام‌های بعدی خارج از این خدمت، با انتخاب خود شما انجام می‌شود.`;

export default router;
