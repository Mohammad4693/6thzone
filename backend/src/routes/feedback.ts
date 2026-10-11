import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// POST /api/feedback/:requestId - submit feedback (member)
router.post('/:requestId', requireRole('MEMBER'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۵ باشد' });
  }

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
  if (request.userId !== req.userId) return res.status(403).json({ error: 'دسترسی مجاز نیست' });

  // Check if already submitted
  const existing = await prisma.feedback.findFirst({
    where: { requestId, userId: req.userId, status: 'SUBMITTED' },
  });
  if (existing) return res.status(400).json({ error: 'قبلاً نظرسنجی ثبت شده است' });

  const feedback = await prisma.feedback.create({
    data: {
      requestId,
      userId: req.userId!,
      rating,
      comment: comment || null,
      status: 'SUBMITTED',
    },
  });

  res.json(feedback);
});

// GET /api/feedback/:requestId - get feedback for a request
router.get('/:requestId', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

  // Only member of the request or admin can see
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR') {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const feedback = await prisma.feedback.findMany({ where: { requestId } });
  res.json(feedback);
});

export default router;
