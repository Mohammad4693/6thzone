import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { FLAGS } from '../config/flags';
import { startAnalysis } from '../services/analysis';

const router = Router();

// v4: audio answers are stored IN THE DATABASE (bytes), never on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // ~3 minutes of webm/opus
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('audio/');
    cb(ok ? null : (new Error('فایل صوتی مجاز نیست') as any), ok);
  },
});

// Can a message be posted on this case right now?
// - With FLAG_AUTO_CLOSE_72H on: legacy 72h rule applies.
// - v4 default: member/admin can post while the case is open (PENDING_REVIEW /
//   APPROVED / ASSIGNED); closed and rejected cases are read-only.
async function canPost(requestId: string): Promise<boolean> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });
  if (!request) return false;
  if (request.status.startsWith('CLOSED') || request.status === 'REJECTED') return false;

  if (FLAGS.autoClose72h) {
    const a = request.assignment;
    if (!a || a.status !== 'ACTIVE') return false;
    return new Date() < a.expiresAt;
  }
  return true;
}

// POST /api/messages/:requestId - send message (member answer or admin)
router.post('/:requestId', upload.single('voice'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const { content } = req.body;

  // Verify access (server-side)
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR') {
    if (!FLAGS.mentorAssignment) return res.status(403).json({ error: 'این بخش در نسخه تست فعال نیست' });
    if (!request.assignment || request.assignment.mentorId !== req.userId) {
      return res.status(403).json({ error: 'این پرونده به شما تخصیص نیافته است' });
    }
  }
  if (req.userRole === 'ADMIN' && request.status.startsWith('CLOSED')) {
    return res.status(403).json({ error: 'پرونده بسته شده است' });
  }

  if (!(await canPost(requestId))) {
    return res.status(403).json({ error: 'زمان فعال پرونده به پایان رسیده. ارسال پیام ممکن نیست.' });
  }

  if (!content && !req.file) {
    return res.status(400).json({ error: 'متن یا فایل صوتی الزامی است' });
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
        requestId,
      },
    });
    attachmentId = att.id;
  }

  const sender = req.userRole === 'MEMBER' ? 'MEMBER' : 'MENTOR';
  const message = await prisma.message.create({
    data: {
      requestId,
      sender,
      userId: req.userId,
      type: req.file ? 'VOICE' : 'TEXT',
      content: content || null,
      attachmentId,
      status: 'SENT',
    },
    include: { attachment: true },
  });

  // v4: a member answer restarts the AI analysis round and sends the case
  // back to the admin review queue. The response returns immediately.
  if (req.userRole === 'MEMBER') {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'PENDING_REVIEW' },
    });
    startAnalysis(requestId);
  }

  res.json(message);
});

// GET /api/messages/:requestId - list messages
router.get('/:requestId', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR' && (!FLAGS.mentorAssignment || !request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    include: { attachment: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

export default router;
