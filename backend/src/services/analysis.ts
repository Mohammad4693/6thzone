// Async AI rounds. Every round is created as PENDING (the member sees only a
// "در حال تحلیل" status), runs in the background, and its output is stored
// for the admin panel only — no AI output is ever returned to members until
// the admin approves it (the rule is enforced in the read paths too).
import { prisma } from '../prisma';
import { chatJson, loadPrompt, validateAnalysis, isAiConfigured } from '../utils/ai';

export function startAnalysis(requestId: string): void {
  runRound(requestId, 'ANALYSIS').catch(() => {});
}

export function startFinalSheet(requestId: string): void {
  runRound(requestId, 'FINAL_SHEET').catch(() => {});
}

const CLARITY_LABELS_FA: Record<string, string> = {
  problem: 'مسئله',
  outcome: 'نتیجه مطلوب',
  constraints_cost: 'قیود و هزینه',
  resources_info: 'منابع و اطلاعات',
  next_step: 'قدم بعدی',
};

const CLARITY_STATUSES_FA: Record<string, string> = {
  empty: 'خالی',
  partial: 'نیمه‌کاره',
  complete: 'کامل',
};

// Flattens a case into the text sent to the model: the member's confirmed
// initial text plus the full Q&A thread. Voice messages count by their
// confirmed transcript (never raw audio).
async function threadText(requestId: string): Promise<string> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!request) throw new Error('request_not_found');
  const parts: string[] = [`شرح اولیه: ${request.description || '[بدون متن]'}`];
  for (const m of request.messages) {
    const who = m.sender === 'MEMBER' ? 'فرد' : 'ادمین سراج';
    parts.push(`${who}: ${m.content || '[پیام صوتی]'}`);
  }
  return parts.join('\n');
}

async function runRound(requestId: string, kind: 'ANALYSIS' | 'FINAL_SHEET'): Promise<void> {
  const inputText = await threadText(requestId);
  const count = await prisma.aiRound.count({ where: { requestId, kind } });
  const round = await prisma.aiRound.create({
    data: { requestId, kind, round: count + 1, inputText, status: 'PENDING' },
  });

  if (!isAiConfigured()) {
    await prisma.aiRound.update({
      where: { id: round.id },
      data: { status: 'FAILED', error: 'کلید سرویس هوش مصنوعی تنظیم نشده است' },
    });
    return;
  }

  try {
    const prompt = loadPrompt(kind === 'ANALYSIS' ? 'analysis' : 'final-sheet');
    const { data, tokensIn, tokensOut, costUsd } = await chatJson(prompt, inputText);
    if (kind === 'ANALYSIS') validateAnalysis(data);

    await prisma.aiRound.update({
      where: { id: round.id },
      data: { status: 'DONE', output: data, tokensIn, tokensOut, costUsd },
    });

    if (kind === 'ANALYSIS') {
      const questions = (data.questions || []) as string[];
      const baseOrder = await prisma.proposedQuestion.count({ where: { requestId } });
      if (questions.length > 0) {
        await prisma.proposedQuestion.createMany({
          data: questions.map((q, i) => ({
            requestId,
            roundId: round.id,
            text: q,
            source: 'AI',
            order: baseOrder + i,
          })),
        });
      }
    }
  } catch (e: any) {
    await prisma.aiRound.update({
      where: { id: round.id },
      data: { status: 'FAILED', error: e.message || 'خطای نامشخص' },
    });
  }
}

export { CLARITY_LABELS_FA, CLARITY_STATUSES_FA };
