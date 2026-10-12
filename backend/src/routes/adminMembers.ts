// Admin (reviewer) management of members + second reviewers, v4.
// Members log in only via one-time-ish personal links (30-day validity,
// revocable). The raw token is returned ONCE in the create/relink response
// and only its sha256 hash is stored.
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import bcrypt from 'bcryptjs';

const router = Router();

function appUrl(): string {
  return (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function createToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url'); // cryptographically secure
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function whatsappText(name: string, url: string): string {
  return `سلام ${name}، لینک ورود شما به سراج: ${url} — لطفاً این لینک را با کسی به اشتراک نگذارید.`;
}

// POST /api/admin/members — create member + personal login link
router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { firstName, lastName, phone } = req.body;
  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'نام، نام خانوادگی و شماره تلفن الزامی است' });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email: null }] },
  });
  if (existing && existing.phone === phone) {
    return res.status(409).json({ error: 'این شماره قبلاً ثبت شده است' });
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      phone,
      passwordHash,
      role: 'MEMBER',
      profile: { create: {} },
    },
  });

  const { raw, hash } = createToken();
  await prisma.loginLink.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  const loginUrl = `${appUrl()}/m/${raw}`;
  logAudit(req.userId, 'CREATE_MEMBER', 'User', user.id);
  res.status(201).json({
    user: { id: user.id, firstName, lastName, phone, role: 'MEMBER' },
    loginUrl,
    whatsappText: whatsappText(`${firstName} ${lastName}`, loginUrl),
  });
});

// GET /api/admin/members — list members with active-link status
router.get('/', requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  const members = await prisma.user.findMany({
    where: { role: 'MEMBER' },
    include: {
      loginLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { requests: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    phone: m.phone,
    createdAt: m.createdAt,
    requestCount: m._count.requests,
    linkActive: m.loginLinks.some(
      (l) => !l.revokedAt && !l.usedAt && l.expiresAt > new Date()
    ),
  })));
});

// POST /api/admin/members/:userId/relink — issue a fresh link (old ones stay revoked)
router.post('/:userId/relink', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || user.role !== 'MEMBER') return res.status(404).json({ error: 'عضو یافت نشد' });

  await prisma.loginLink.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const { raw, hash } = createToken();
  await prisma.loginLink.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const loginUrl = `${appUrl()}/m/${raw}`;
  logAudit(req.userId, 'RELINK_MEMBER', 'User', user.id);
  res.json({
    loginUrl,
    whatsappText: whatsappText(`${user.firstName} ${user.lastName}`, loginUrl),
  });
});

// POST /api/admin/members/:userId/revoke — invalidate all active links
router.post('/:userId/revoke', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || user.role !== 'MEMBER') return res.status(404).json({ error: 'عضو یافت نشد' });

  await prisma.loginLink.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  logAudit(req.userId, 'REVOKE_LINKS', 'User', user.id);
  res.json({ ok: true });
});

// POST /api/admin/members/reviewers — add a second reviewer (admin) with email+password
router.post('/reviewers', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'ایمیل و رمز (حداقل ۸ نویسه) الزامی است' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      firstName: firstName || 'بازبین',
      lastName: lastName || 'سراج',
      email,
      phone: `reviewer-${email}`, // unique placeholder; reviewers log in with email
      passwordHash,
      role: 'ADMIN',
    },
  });

  logAudit(req.userId, 'ADD_REVIEWER', 'User', user.id, { email });
  res.status(201).json({ id: user.id, email, role: user.role });
});

export default router;
