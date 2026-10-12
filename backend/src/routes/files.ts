import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { FLAGS } from '../config/flags';

const router = Router();

// GET /api/files/:id - stream an attachment (access controlled).
// v4: audio lives in the database (attachment.data); legacy disk paths are
// still served for old records.
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return res.status(404).json({ error: 'فایل یافت نشد' });

  // Check access: member of the request, mentor of the request (flag on), or admin
  if (attachment.requestId) {
    const request = await prisma.request.findUnique({
      where: { id: attachment.requestId },
      include: { assignment: true },
    });
    if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

    if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
    if (req.userRole === 'MENTOR') {
      if (!FLAGS.mentorAssignment) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
      if (!request.assignment || request.assignment.mentorId !== req.userId) {
        return res.status(403).json({ error: 'دسترسی مجاز نیست' });
      }
    }
  } else {
    // No request attached — only the uploader or admin can access
    if (req.userRole !== 'ADMIN' && attachment.uploadedBy !== req.userId) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
  }

  if (attachment.data) {
    const buf = Buffer.from(attachment.data);
    res.setHeader('Content-Type', attachment.mimeType || 'audio/webm');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(buf);
  }

  if (attachment.path) {
    return res.download(attachment.path, attachment.originalName);
  }
  res.status(404).json({ error: 'محتوای فایل یافت نشد' });
});

export default router;
