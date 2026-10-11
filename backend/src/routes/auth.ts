import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { generateToken } from '../middleware/auth';
import { generateOtp, normalizeIranPhone, isValidIranPhone, CODE_EXPIRY_MINUTES, MAX_ATTEMPTS } from '../utils/otp';
import { logAudit } from '../utils/audit';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'نام، نام خانوادگی و شماره موبایل الزامی است' });
  }
  const normalizedPhone = normalizeIranPhone(phone);
  if (!isValidIranPhone(normalizedPhone)) {
    return res.status(400).json({ error: 'شماره موبایل نامعتبر است. فرمت صحیح: 09xxxxxxxxx' });
  }

  const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (existing) {
    return res.status(409).json({ error: 'این شماره قبلاً ثبت شده است. وارد شوید.' });
  }

  // Create user with a random password (login is OTP-based)
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      phone: normalizedPhone,
      passwordHash,
      role: 'MEMBER',
      phoneVerified: 'UNVERIFIED',
      profile: { create: {} },
    },
  });

  // Generate OTP
  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      phone: normalizedPhone,
      code,
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000),
    },
  });

  // NOTE: SMS sending requires an external SMS gateway (e.g. Kavenegar, Farapayamak).
  // This connection is NOT configured. In development, the code is returned for testing.
  // In production, connect an SMS provider and send the code via their API.
  const smsConfigured = !!process.env.SMS_API_KEY;

  logAudit(user.id, 'REGISTER', 'User', user.id);

  res.json({
    message: 'کد تأیید ارسال شد',
    userId: user.id,
    phone: normalizedPhone,
    // In dev mode without SMS, return the code so testing is possible.
    // This is NOT fake verification — the code is real and must be entered.
    devCode: smsConfigured ? undefined : code,
    smsConfigured,
    note: smsConfigured
      ? 'کد از طریق پیامک ارسال شد'
      : 'اتصال پیامک تکمیل نشده. در محیط توسعه، کد نمایش داده می‌شود. برای ارسال واقعی، کلید سرویس پیامک را تنظیم کنید.',
  });
});

// POST /api/auth/send-code (resend or send to existing user)
router.post('/send-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'شماره موبایل الزامی است' });
  const normalizedPhone = normalizeIranPhone(phone);
  if (!isValidIranPhone(normalizedPhone)) {
    return res.status(400).json({ error: 'شماره موبایل نامعتبر است' });
  }

  // Rate limit: max 3 codes per 10 minutes
  const recentCodes = await prisma.otpCode.count({
    where: {
      phone: normalizedPhone,
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (recentCodes >= 3) {
    return res.status(429).json({ error: 'تعداد درخواست کد بیش از حد. ۱۰ دقیقه صبر کنید.' });
  }

  const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (!user) {
    return res.status(404).json({ error: 'این شماره ثبت نشده است. ابتدا ثبت‌نام کنید.' });
  }

  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      phone: normalizedPhone,
      code,
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000),
      // `phone` is the FK to User, so the scalar alone sets the relation.
      // Passing the relation too makes Prisma reject the create (invalid input).
    },
  });

  const smsConfigured = !!process.env.SMS_API_KEY;
  res.json({
    message: 'کد تأیید ارسال شد',
    userId: user.id,
    devCode: smsConfigured ? undefined : code,
    smsConfigured,
  });
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'شماره و کد الزامی است' });
  const normalizedPhone = normalizeIranPhone(phone);

  // Find the latest unused, non-expired code
  const otp = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    return res.status(400).json({ error: 'کد منقضی شده یا یافت نشد. کد جدید درخواست کنید.' });
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'تعداد تلاش بیش از حد. کد جدید درخواست کنید.' });
  }

  if (otp.code !== code) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return res.status(400).json({ error: 'کد نادرست' });
  }

  // Mark code as used
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  // Verify user phone
  const user = await prisma.user.update({
    where: { phone: normalizedPhone },
    data: { phoneVerified: 'VERIFIED' },
    include: { profile: true, mentorProfile: true },
  });

  logAudit(user.id, 'PHONE_VERIFIED', 'User', user.id);

  const token = generateToken(user.id, user.role, user.phone);
  res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phoneVerified: user.phoneVerified,
      profile: user.profile,
      mentorProfile: user.mentorProfile,
    },
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'احراز هویت نشده' });
  }
  const jwt = await import('jsonwebtoken');
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seraj-dev-secret-change-me') as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { profile: true, mentorProfile: true },
    });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    res.json({
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phoneVerified: user.phoneVerified,
      profile: user.profile,
      mentorProfile: user.mentorProfile,
    });
  } catch {
    res.status(401).json({ error: 'نشست نامعتبر' });
  }
});

export default router;
