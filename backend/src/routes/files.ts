import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/files/:id - download attachment (access controlled)
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return res.status(404).json({ error: 'فایل یافت نشد' });

  // Check access: must be member of the request, mentor of the request, or admin
  if (attachment.requestId) {
    const request = await prisma.request.findUnique({
      where: { id: attachment.requestId },
      include: { assignment: true },
    });
    if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

    if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
    if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
  } else {
    // No request attached — only the uploader or admin can access
    if (req.userRole !== 'ADMIN' && attachment.uploadedBy !== req.userId) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
  }

  res.download(attachment.path, attachment.originalName);
});

export default router;
