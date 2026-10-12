// Server-side OpenAI helpers. The browser NEVER talks to OpenAI directly —
// every call goes through this module on the server. The API key is read
// from the environment only and is never logged or returned in any response.
import fs from 'fs';
import path from 'path';

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function aiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  return raw.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export function chatModel(): string {
  // gpt-4o-mini: strong Persian understanding, JSON mode, low cost — a good
  // default for the analysis/chat workload. Override with AI_CHAT_MODEL.
  return process.env.AI_CHAT_MODEL || 'gpt-4o-mini';
}

export function transcribeModel(): string {
  // whisper-1: the most broadly available OpenAI transcription model with
  // solid Persian support. Override with AI_TRANSCRIBE_MODEL.
  return process.env.AI_TRANSCRIBE_MODEL || 'whisper-1';
}

// Prompts live in editable files (prompts/*.md) so they can be changed
// without touching code. Path is resolved from the process working dir
// (backend/ both locally, in docker, and on Render).
export function loadPrompt(name: 'analysis' | 'final-sheet'): string {
  const file = path.resolve(process.cwd(), 'prompts', `${name}.md`);
  return fs.readFileSync(file, 'utf-8');
}

// USD per 1M tokens, used only for the admin cost report.
const PRICE_TABLE: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
};

export async function transcribeAudio(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimetype }), filename || 'voice.webm');
  form.append('model', transcribeModel());
  const res = await fetch(`${aiBaseUrl()}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcription_failed_${res.status}`);
  const data = (await res.json()) as any;
  const text = (data.text || '').trim();
  if (!text) throw new Error('transcription_empty');
  return text;
}

export interface ChatJsonResult {
  data: any;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// Chat call that must return a JSON object. Throws on HTTP errors and on
// unparseable output — callers record the failure, never fabricate output.
export async function chatJson(systemPrompt: string, userContent: string): Promise<ChatJsonResult> {
  const model = chatModel();
  const res = await fetch(`${aiBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`ai_chat_failed_${res.status}`);
  const raw = (await res.json()) as any;
  const content = raw.choices?.[0]?.message?.content || '';
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('ai_invalid_json');
  }
  const tokensIn = raw.usage?.prompt_tokens ?? 0;
  const tokensOut = raw.usage?.completion_tokens ?? 0;
  const price = PRICE_TABLE[model] || { in: 0, out: 0 };
  const costUsd = (tokensIn / 1e6) * price.in + (tokensOut / 1e6) * price.out;
  return { data, tokensIn, tokensOut, costUsd };
}

// Validates the analysis JSON from prompts/analysis.md. Throws with a short
// code on any structural problem.
export function validateAnalysis(data: any): void {
  if (!data || typeof data !== 'object') throw new Error('ai_invalid_json');
  if (typeof data.summary !== 'string') throw new Error('invalid_summary');
  if (!Array.isArray(data.missing_info)) throw new Error('invalid_missing_info');
  if (
    !Array.isArray(data.questions) ||
    data.questions.length > 5 ||
    !data.questions.every((q: any) => typeof q === 'string' && q.trim())
  ) {
    throw new Error('invalid_questions');
  }
  const keys = ['problem', 'outcome', 'constraints_cost', 'resources_info', 'next_step'];
  if (
    !data.clarity ||
    typeof data.clarity !== 'object' ||
    !keys.every((k) => ['empty', 'partial', 'complete'].includes(data.clarity[k]))
  ) {
    throw new Error('invalid_clarity');
  }
  if (typeof data.ready_for_final !== 'boolean') throw new Error('invalid_ready');
}
