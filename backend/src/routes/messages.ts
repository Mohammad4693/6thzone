import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Check if assignment is still active (72h not passed)
async function isAssignmentActive(requestId: string): Promise<boolean> {
  const assignment = await prisma.assignment.findUnique({
    where: { requestId },
  });
  if (!assignment) return false;
  if (assignment.status !== 'ACTIVE') return false;
  return new Date() < assignment.expiresAt;
}

// POST /api/messages/:requestId - send message
router.post('/:requestId', upload.single('voice'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const { content } = req.body;

  // Verify access
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  // Access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR') {
    if (!request.assignment || request.assignment.mentorId !== req.userId) {
      return res.status(403).json({ error: 'این پرونده به شما تخصیص نیافته است' });
    }
  }

  // Check 72h expiry — server-side enforcement
  const active = await isAssignmentActive(requestId);
  if (!active) {
    return res.status(403).json({ error: 'زمان فعال پرونده به پایان رسیده. ارسال پیام ممکن نیست.' });
  }

  if (!content && !req.file) {
    return res.status(400).json({ error: 'متن یا فایل صوتی الزامی است' });
  }

  let attachmentId: string | undefined;
  if (req.file) {
    const att = await prisma.attachment.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
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
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    include: { attachment: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

// Retry failed message
router.post('/:requestId/retry/:messageId', async (req: AuthRequest, res) => {
  const { requestId, messageId } = req.params;
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.requestId !== requestId) return res.status(404).json({ error: 'پیام یافت نشد' });
  if (msg.status !== 'FAILED') return res.status(400).json({ error: 'این پیام نیاز به تلاش مجدد ندارد' });

  const active = await isAssignmentActive(requestId);
  if (!active) return res.status(403).json({ error: 'زمان فعال پرونده به پایان رسیده' });

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { status: 'SENT' },
  });
  res.json(updated);
});

export default router;
