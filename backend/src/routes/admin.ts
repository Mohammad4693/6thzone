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
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const receiptUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/admin/dashboard
router.get('/dashboard', requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  const [
    pendingRequests,
    approvedRequests,
    activeRequests,
    closedRequests,
    mentors,
    unassigned,
    nearExpiry,
    sessions,
    closedCompleted,
    closedIncomplete,
    feedback,
    errors,
  ] = await Promise.all([
    prisma.request.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.request.count({ where: { status: 'APPROVED' } }),
    prisma.request.count({ where: { status: 'ASSIGNED' } }),
    prisma.request.count({ where: { status: { in: ['CLOSED_EXPIRED', 'CLOSED_INCOMPLETE'] } } }),
    prisma.mentorProfile.findMany({ include: { user: { select: { firstName: true, lastName: true, phone: true } } } }),
    prisma.request.count({ where: { status: 'APPROVED', assignment: null } }),
    prisma.assignment.count({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date(Date.now() + 12 * 60 * 60 * 1000) },
      },
    }),
    prisma.session.findMany({ where: { status: { in: ['REQUESTED', 'SCHEDULED'] } }, include: { request: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.request.count({ where: { status: 'CLOSED_COMPLETED' } }),
    prisma.request.count({ where: { status: 'CLOSED_INCOMPLETE' } }),
    prisma.feedback.findMany({ where: { status: 'SUBMITTED' } }),
    prisma.auditLog.findMany({ where: { action: { contains: 'ERROR' } }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  // Pilot metrics
  const totalFeedback = feedback.length;
  const satisfiedCount = feedback.filter(f => f.rating >= 4).length;
  const satisfactionRate = totalFeedback > 0 ? Math.round((satisfiedCount / totalFeedback) * 100) : null;

  res.json({
    pendingRequests,
    approvedRequests,
    activeRequests,
    closedRequests,
    mentors,
    unassigned,
    nearExpiry,
    sessions,
    closedCompleted,
    closedIncomplete,
    pilotMetrics: {
      totalFeedback,
      satisfiedCount,
      satisfactionRate,
      responseRate: totalFeedback > 0 ? `${satisfiedCount}/${totalFeedback}` : null,
      dataAvailable: totalFeedback > 0,
    },
    errors,
  });
});

// GET /api/admin/requests - all requests with filters
router.get('/requests', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { status } = req.query;
  const where = status ? { status: status as any } : {};
  const requests = await prisma.request.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true, profile: true } },
      assignment: { include: { mentor: { include: { mentorProfile: true } } } },
      contribution: true,
      feedback: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

// POST /api/admin/requests/:id/approve
router.post('/requests/:id/approve', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const request = await prisma.request.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
  if (request.status !== 'PENDING_REVIEW') {
    return res.status(400).json({ error: 'این درخواست در وضعیت بررسی نیست' });
  }

  const updated = await prisma.request.update({
    where: { id },
    data: { status: 'APPROVED' },
  });
  logAudit(req.userId, 'APPROVE_REQUEST', 'Request', id);
  res.json(updated);
});

// POST /api/admin/requests/:id/reject
router.post('/requests/:id/reject', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const request = await prisma.request.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
  if (request.status !== 'PENDING_REVIEW') {
    return res.status(400).json({ error: 'این درخواست در وضعیت بررسی نیست' });
  }

  const updated = await prisma.request.update({
    where: { id },
    data: { status: 'REJECTED', closedAt: new Date() },
  });
  logAudit(req.userId, 'REJECT_REQUEST', 'Request', id, { reason });
  res.json(updated);
});

// POST /api/admin/requests/:id/assign - assign mentor
router.post('/requests/:id/assign', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { mentorId } = req.body;
  if (!mentorId) return res.status(400).json({ error: 'انتخاب منتور الزامی است' });

  const request = await prisma.request.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
  if (request.status !== 'APPROVED') {
    return res.status(400).json({ error: 'درخواست در وضعیت پذیرش نیست' });
  }

  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true },
  });
  if (!mentor || mentor.role !== 'MENTOR' || !mentor.mentorProfile) {
    return res.status(400).json({ error: 'منتور نامعتبر است' });
  }
  if (mentor.mentorProfile.activeCount >= mentor.mentorProfile.capacity) {
    return res.status(400).json({ error: 'ظرفیت این منتور تکمیل است' });
  }

  // Check no existing active assignment
  const existing = await prisma.assignment.findUnique({ where: { requestId: id } });
  if (existing && existing.status === 'ACTIVE') {
    return res.status(400).json({ error: 'این پرونده قبلاً منتور دارد' });
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 72 * 60 * 60 * 1000); // exactly 72h

  const assignment = await prisma.assignment.create({
    data: {
      requestId: id,
      mentorId,
      startedAt,
      expiresAt,
      status: 'ACTIVE',
    },
  });

  await prisma.request.update({ where: { id }, data: { status: 'ASSIGNED' } });
  await prisma.mentorProfile.update({
    where: { userId: mentorId },
    data: { activeCount: { increment: 1 } },
  });

  // Initialize clarity sections (15 axes)
  const axes = CLARITY_AXES;
  await prisma.claritySection.createMany({
    data: axes.map((a, i) => ({
      requestId: id,
      axisNumber: i + 1,
      axisLabel: a,
      enabled: false,
      confirmed: false,
    })),
  });

  // Initialize progress sections (5 parts)
  const progress = PROGRESS_SECTIONS;
  await prisma.progressSection.createMany({
    data: progress.map((p, i) => ({
      requestId: id,
      section: i + 1,
      label: p,
      confirmed: false,
    })),
  });

  logAudit(req.userId, 'ASSIGN_MENTOR', 'Request', id, { mentorId });
  res.json(assignment);
});

// POST /api/admin/requests/:id/replace-mentor
router.post('/requests/:id/replace-mentor', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { mentorId } = req.body;

  const oldAssignment = await prisma.assignment.findUnique({ where: { requestId: id } });
  if (!oldAssignment || oldAssignment.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'تخصیص فعالی وجود ندارد' });
  }

  // Mark old as replaced (do NOT recalculate expiry — keep original deadline)
  await prisma.assignment.update({
    where: { id: oldAssignment.id },
    data: { status: 'REPLACED', closedAt: new Date() },
  });
  await prisma.mentorProfile.update({
    where: { userId: oldAssignment.mentorId },
    data: { activeCount: { decrement: 1 } },
  });

  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true },
  });
  if (!mentor || mentor.role !== 'MENTOR') return res.status(400).json({ error: 'منتور نامعتبر' });

  // New assignment keeps the ORIGINAL expiry (does not recalculate from new start)
  const newAssignment = await prisma.assignment.create({
    data: {
      requestId: id,
      mentorId,
      startedAt: oldAssignment.startedAt, // keep original start
      expiresAt: oldAssignment.expiresAt, // keep original expiry
      status: 'ACTIVE',
    },
  });
  await prisma.mentorProfile.update({
    where: { userId: mentorId },
    data: { activeCount: { increment: 1 } },
  });

  logAudit(req.userId, 'REPLACE_MENTOR', 'Request', id, { oldMentorId: oldAssignment.mentorId, newMentorId: mentorId });
  res.json(newAssignment);
});

// POST /api/admin/requests/:id/close
router.post('/requests/:id/close', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'completed' | 'incomplete'
  const request = await prisma.request.findUnique({ where: { id }, include: { assignment: true } });
  if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

  const status = type === 'completed' ? 'CLOSED_COMPLETED' : 'CLOSED_INCOMPLETE';
  await prisma.request.update({ where: { id }, data: { status, closedAt: new Date() } });

  if (request.assignment && request.assignment.status === 'ACTIVE') {
    await prisma.assignment.update({
      where: { id: request.assignment.id },
      data: { status: 'EXPIRED', closedAt: new Date() },
    });
    await prisma.mentorProfile.update({
      where: { userId: request.assignment.mentorId },
      data: { activeCount: { decrement: 1 } },
    });
  }

  logAudit(req.userId, 'CLOSE_REQUEST', 'Request', id, { type });
  res.json({ ok: true });
});

// POST /api/admin/contribution/:requestId/confirm
router.post('/contribution/:requestId/confirm', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const contribution = await prisma.contribution.findUnique({ where: { requestId } });
  if (!contribution) return res.status(404).json({ error: 'مشارکت یافت نشد' });

  const updated = await prisma.contribution.update({
    where: { requestId },
    data: { status: 'CONFIRMED', confirmedBy: req.userId, confirmedAt: new Date() },
  });
  logAudit(req.userId, 'CONFIRM_CONTRIBUTION', 'Contribution', requestId);
  res.json(updated);
});

// POST /api/admin/contribution/:requestId/exempt
router.post('/contribution/:requestId/exempt', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const updated = await prisma.contribution.update({
    where: { requestId },
    data: { status: 'EXEMPT' },
  });
  logAudit(req.userId, 'EXEMPT_CONTRIBUTION', 'Contribution', requestId);
  res.json(updated);
});

// POST /api/admin/contribution/:requestId/upload-receipt
router.post('/contribution/:requestId/upload-receipt', requireRole('ADMIN'), receiptUpload.single('receipt'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'فایل الزامی است' });
  const updated = await prisma.contribution.update({
    where: { requestId },
    data: { receiptPath: req.file.path, status: 'SUBMITTED' },
  });
  res.json(updated);
});

// POST /api/admin/verify-service/:userId
router.post('/verify-service/:userId', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { status } = req.body; // 'VERIFIED' | 'REJECTED'
  const profile = await prisma.profile.update({
    where: { userId },
    data: { verification: status, verifiedAt: status === 'VERIFIED' ? new Date() : null },
  });
  logAudit(req.userId, 'VERIFY_SERVICE', 'Profile', userId, { status });
  res.json(profile);
});

// POST /api/admin/mentors - create mentor
router.post('/mentors', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { userId, expertise, capacity } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: 'MENTOR' },
  });

  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId },
    create: { userId, expertise: expertise || [], capacity: capacity || 5 },
    update: { expertise: expertise || undefined, capacity: capacity || undefined },
  });

  logAudit(req.userId, 'ROLE_CHANGE', 'User', userId, { newRole: 'MENTOR' });
  res.json({ user: updated, mentorProfile });
});

// PUT /api/admin/mentors/:userId - update mentor capacity/expertise
router.put('/mentors/:userId', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { expertise, capacity } = req.body;
  const updated = await prisma.mentorProfile.update({
    where: { userId },
    data: {
      expertise: expertise || undefined,
      capacity: capacity || undefined,
    },
  });
  res.json(updated);
});

// GET /api/admin/users
router.get('/users', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { role } = req.query;
  const where = role ? { role: role as any } : {};
  const users = await prisma.user.findMany({
    where,
    include: { profile: true, mentorProfile: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// POST /api/admin/sessions/:id/schedule
router.post('/sessions/:id/schedule', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { scheduledAt, link } = req.body;
  const session = await prisma.session.update({
    where: { id },
    data: { scheduledAt: new Date(scheduledAt), link, status: 'SCHEDULED' },
  });
  logAudit(req.userId, 'SCHEDULE_SESSION', 'Session', id);
  res.json(session);
});

// POST /api/admin/sessions/:id/attendance
router.post('/sessions/:id/attendance', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { memberAttended, mentorAttended, status } = req.body;
  const session = await prisma.session.update({
    where: { id },
    data: { memberAttended, mentorAttended, status: status || 'COMPLETED' },
  });
  res.json(session);
});

// GET /api/admin/reports
router.get('/reports', requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  const totalMembers = await prisma.user.count({ where: { role: 'MEMBER' } });
  const totalMentors = await prisma.user.count({ where: { role: 'MENTOR' } });
  const totalRequests = await prisma.request.count();
  const completedInTime = await prisma.request.count({ where: { status: 'CLOSED_COMPLETED' } });
  const closedIncomplete = await prisma.request.count({ where: { status: 'CLOSED_INCOMPLETE' } });
  const feedback = await prisma.feedback.findMany({ where: { status: 'SUBMITTED' } });

  const sessions = await prisma.session.findMany({ where: { status: 'COMPLETED' } });
  const memberAttended = sessions.filter(s => s.memberAttended && s.mentorAttended).length;
  const mentorAttended = sessions.filter(s => s.mentorAttended).length;
  const attendanceRate = mentorAttended > 0 ? Math.round((memberAttended / mentorAttended) * 100) : null;

  const satisfied = feedback.filter(f => f.rating >= 4).length;
  const satisfactionRate = feedback.length > 0 ? Math.round((satisfied / feedback.length) * 100) : null;

  res.json({
    totalMembers,
    totalMentors,
    totalRequests,
    completedInTime,
    closedIncomplete,
    feedbackCount: feedback.length,
    satisfactionRate,
    satisfactionDataAvailable: feedback.length > 0,
    attendanceRate,
    attendanceDataAvailable: mentorAttended > 0,
    pilotCapacity: 50,
    capacityUsed: totalMembers,
    capacityAvailable: totalMembers < 50,
  });
});

export const CLARITY_AXES = [
  'نیاز واقعی',
  'نتیجه مطلوب',
  'ضرورت و فوریت',
  'گزینه‌های نیازمند بررسی',
  'هزینه‌های کامل',
  'بودجه و محدودیت مالی',
  'پیش‌نیازها',
  'منبع‌یابی',
  'معیار اعتبارسنجی منابع',
  'معیار مقایسه منابع',
  'ریسک‌های قابل بررسی',
  'تبعات برآورده‌نشدن',
  'امکان بازگشت',
  'اطلاعات ناقص',
  'موضوعات لازم برای پیگیری و ارزیابی',
];

export const PROGRESS_SECTIONS = [
  'شرح مسئله',
  'نتیجه مطلوب',
  'ضرورت و محدودیت‌ها',
  'اطلاعات و منابع لازم برای بررسی',
  'جمع‌بندی نیاز',
];

export default router;
