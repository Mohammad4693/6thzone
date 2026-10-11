import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// POST /api/sessions/:requestId/request - member requests a session
router.post('/:requestId/request', requireRole('MEMBER'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });
  if (request.userId !== req.userId) return res.status(403).json({ error: 'دسترسی مجاز نیست' });

  // Check assignment is active
  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.status !== 'ACTIVE' || new Date() > assignment.expiresAt) {
    return res.status(400).json({ error: 'پرونده فعال نیست' });
  }

  const session = await prisma.session.create({
    data: { requestId, status: 'REQUESTED' },
  });
  res.json(session);
});

// GET /api/sessions/:requestId - list sessions for a request
router.get('/:requestId', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });

  // Access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const sessions = await prisma.session.findMany({ where: { requestId }, orderBy: { createdAt: 'desc' } });
  res.json(sessions);
});

export default router;
