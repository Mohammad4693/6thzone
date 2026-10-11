import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

const voiceStorage = multer.memoryStorage();
const audioUpload = multer({
  storage: voiceStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('audio/');
    cb(ok ? null : new Error('فایل صوتی مجاز نیست'), ok);
  },
});

// POST /api/ai/transcribe — voice → text for member's need registration.
// Uses the configured OpenAI-compatible transcription endpoint. Without a
// configured key it returns 503 and the member types the text manually —
// no fake output is ever produced.
router.post('/transcribe', requireRole('MEMBER'), audioUpload.single('audio'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل صوتی الزامی است' });

  const aiKey = process.env.AI_API_KEY;
  if (!aiKey) {
    return res.status(503).json({
      error: 'تبدیل صدا به متن انجام نشد',
      message: 'سرویس تبدیل صدا به متن تنظیم نشده است. لطفاً متن نیاز را بنویسید.',
    });
  }

  try {
    const base = (process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions')
      .replace(/\/chat\/completions$/, '');
    const transcribeUrl = process.env.AI_TRANSCRIBE_URL || `${base}/audio/transcriptions`;
    const model = process.env.AI_TRANSCRIBE_MODEL || 'whisper-1';

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), req.file.originalname || 'voice.webm');
    form.append('model', model);

    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiKey}` },
      body: form,
    });
    if (!response.ok) throw new Error(`transcription service returned ${response.status}`);

    const data = await response.json() as any;
    const text = (data.text || '').trim();
    if (!text) return res.status(502).json({ error: 'متنی از صدا استخراج نشد. لطفاً بنویسید.' });

    res.json({ text });
  } catch (e: any) {
    res.status(502).json({
      error: 'تبدیل صدا به متن ناموفق بود',
      message: 'می‌توانید دوباره تلاش کنید یا متن را بنویسید.',
      detail: e.message,
    });
  }
});

// POST /api/ai/:requestId/generate - generate AI draft (mentor only)
router.post('/:requestId/generate', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const assignment = await prisma.assignment.findUnique({
    where: { requestId },
    include: {
      request: {
        include: {
          messages: { orderBy: { createdAt: 'asc' }, include: { attachment: true } },
          claritySections: true,
          aiDrafts: { where: { status: 'PENDING_REVIEW' } },
        },
      },
    },
  });

  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  // Check AI service is configured
  const aiKey = process.env.AI_API_KEY;
  if (!aiKey) {
    return res.status(503).json({
      error: 'اتصال انجام نشده',
      message: 'کلید سرویس هوش مصنوعی تنظیم نشده. خروجی ساختگی ارائه نمی‌شود.',
    });
  }

  // Build context from messages (only this person's data, no cross-contamination)
  const memberMessages = assignment.request.messages
    .filter(m => m.sender === 'MEMBER')
    .map(m => m.content || '[پیام صوتی]')
    .join('\n');

  const mentorMessages = assignment.request.messages
    .filter(m => m.sender === 'MENTOR')
    .map(m => m.content || '[پیام صوتی]')
    .join('\n');

  const confirmedAxes = assignment.request.claritySections
    .filter(c => c.confirmed)
    .map(c => c.axisLabel);

  // Call AI service
  try {
    const prompt = buildPrompt(memberMessages, mentorMessages, confirmedAxes);
    const aiResponse = await callAIService(prompt, aiKey);

    const contentHash = crypto.createHash('sha256').update(aiResponse).digest('hex');

    const draft = await prisma.aIDraft.create({
      data: {
        requestId,
        content: aiResponse,
        status: 'PENDING_REVIEW',
        contentHash,
      },
    });

    res.json(draft);
  } catch (e: any) {
    logAudit(req.userId, 'AI_ERROR', 'Request', requestId, { error: e.message });
    return res.status(502).json({
      error: 'خطای سرویس هوش مصنوعی',
      message: 'درخواست ناموفق بود. اطلاعات عضو حذف نشده. می‌توانید دوباره تلاش کنید.',
    });
  }
});

// POST /api/ai/:requestId/draft/:draftId/approve - approve and send to member
router.post('/:requestId/draft/:draftId/approve', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId, draftId } = req.params;
  const { editedContent } = req.body;

  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const draft = await prisma.aIDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.requestId !== requestId) {
    return res.status(404).json({ error: 'پیش‌نویس یافت نشد' });
  }
  if (draft.status !== 'PENDING_REVIEW') {
    return res.status(400).json({ error: 'این پیش‌نویس قبلاً بررسی شده است' });
  }

  // Check content hasn't changed since review started (prevent approving stale version)
  if (editedContent) {
    const newHash = crypto.createHash('sha256').update(editedContent).digest('hex');
    if (draft.contentHash && newHash !== draft.contentHash && draft.status === 'PENDING_REVIEW') {
      // Content was edited — update draft first
      await prisma.aIDraft.update({
        where: { id: draftId },
        data: { content: editedContent, contentHash: newHash, status: 'EDITED', reviewedBy: req.userId, reviewedAt: new Date() },
      });
    }
  }

  // Check assignment still active
  if (new Date() > assignment.expiresAt) {
    return res.status(403).json({ error: 'زمان فعال پرونده به پایان رسیده' });
  }

  // Create message to member
  const finalContent = editedContent || draft.content;
  const message = await prisma.message.create({
    data: {
      requestId,
      sender: 'MENTOR',
      userId: req.userId,
      type: 'TEXT',
      content: finalContent,
      status: 'SENT',
    },
  });

  // Mark draft as approved
  const updatedDraft = await prisma.aIDraft.update({
    where: { id: draftId },
    data: {
      status: editedContent ? 'EDITED' : 'APPROVED',
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      sentMessageId: message.id,
    },
  });

  logAudit(req.userId, 'APPROVE_DRAFT', 'AIDraft', draftId, { messageId: message.id });
  res.json({ draft: updatedDraft, message });
});

// POST /api/ai/:requestId/draft/:draftId/reject
router.post('/:requestId/draft/:draftId/reject', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId, draftId } = req.params;
  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const draft = await prisma.aIDraft.update({
    where: { id: draftId },
    data: { status: 'REJECTED', reviewedBy: req.userId, reviewedAt: new Date() },
  });
  res.json(draft);
});

// GET /api/ai/:requestId/drafts - list drafts (mentor only)
router.get('/:requestId/drafts', requireRole('MENTOR'), async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const assignment = await prisma.assignment.findUnique({ where: { requestId } });
  if (!assignment || assignment.mentorId !== req.userId) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const drafts = await prisma.aIDraft.findMany({
    where: { requestId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(drafts);
});

function buildPrompt(memberMsgs: string, mentorMsgs: string, confirmedAxes: string[]): string {
  return `You are an AI assistant helping a mentor clarify a person's need. Based on the conversation, generate a draft of up to 3 short, clear questions to help clarify the need. Separate facts from assumptions. Identify incomplete information. Do not give advice or make decisions. Do not generate fake data or numbers. Respond in Persian (Farsi).

Member's messages:
${memberMsgs || '[هنوز پیامی ثبت نشده]'}

Mentor's messages so far:
${mentorMsgs || '[بدون پیام]'}

Confirmed clarity axes:
${confirmedAxes.join(', ') || '[هیچ محوری تأیید نشده]'}

Generate a draft with:
1. Summary of what the member has said so far
2. Up to 3 relevant clarifying questions
3. Notes on incomplete information or assumptions to check

Keep it concise and in Persian.`;
}

async function callAIService(prompt: string, apiKey: string): Promise<string> {
  // Generic AI service call — supports OpenAI-compatible APIs
  const aiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const aiModel = process.env.AI_MODEL || 'gpt-4o-mini';

  const response = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: 'system', content: 'You are a helpful assistant for clarifying needs. Always respond in Persian (Farsi). Never give professional advice or make decisions for the person.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI service returned ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'خروجی دریافت نشد';
}

export default router;
