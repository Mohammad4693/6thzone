import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// GET /api/clarity/:requestId - get clarity sections
router.get('/:requestId', async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { assignment: true, claritySections: true },
  }) as any;
  if (!request) return res.status(404).json({ error: 'پرونده یافت نشد' });
  const progressSections = request.progressSections || [];

  // Access control
  if (req.userRole === 'MEMBER' && request.userId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }
  if (req.userRole === 'MENTOR' && (!request.assignment || request.assignment.mentorId !== req.userId)) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  // Members only see progress, not full clarity details
  if (req.userRole === 'MEMBER') {
    const confirmed = progressSections.filter((p: any) => p.confirmed).length;
    const progress = Math.round((confirmed / 5) * 100);
    return res.json({
      progress,
      progressSections: progressSections.map((p: any) => ({ section: p.section, label: p.label, confirmed: p.confirmed })),
      claritySections: request.claritySections.map((c: any) => ({ axisNumber: c.axisNumber, axisLabel: c.axisLabel, enabled: c.enabled, confirmed: c.confirmed })),
    });
  }

  res.json({
    claritySections: request.claritySections,
    progressSections,
    progress: Math.round((progressSections.filter((p: any) => p.confirmed).length / 5) * 100),
  });
});

// PUT /api/clarity/:requestId/axis/:axisNumber - update clarity axis (mentor only)
router.put('/:requestId/axis/:axisNumber', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId, axisNumber } = req.params;
  const { enabled, confirmed, notes } = req.body;

  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const updated = await prisma.claritySection.update({
    where: { requestId_axisNumber: { requestId, axisNumber: parseInt(axisNumber) } },
    data: { enabled, confirmed, notes },
  });
  res.json(updated);
});

// PUT /api/clarity/:requestId/progress/:section - toggle progress section (mentor only)
router.put('/:requestId/progress/:section', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId, section } = req.params;
  const { confirmed } = req.body;

  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const updated = await prisma.progressSection.update({
    where: { requestId_section: { requestId, section: parseInt(section) } },
    data: { confirmed },
  });
  res.json(updated);
});

export default router;
