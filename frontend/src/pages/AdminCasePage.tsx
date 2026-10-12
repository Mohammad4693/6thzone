import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import AuthAudio from '../components/AuthAudio';
import { REQUEST_STATUS_FA, CLARITY_KEYS_FA, CLARITY_STATUS_FA } from '../lib/labels';

interface Round {
  id: string;
  kind: string;
  round: number;
  status: string;
  output?: any;
  error?: string | null;
  costUsd?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  createdAt: string;
}

interface Question {
  id: string;
  text: string;
  source: string;
  status: string;
  order: number;
}

interface Message {
  id: string;
  sender: string;
  type: string;
  content?: string | null;
  attachmentId?: string | null;
  createdAt: string;
}

export default function AdminCasePage() {
  const { requestId } = useParams();
  const [request, setRequest] = useState<any>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [finalDraft, setFinalDraft] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualText, setManualText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sheet, setSheet] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [rq, rd, msg] = await Promise.all([
          client.get(`/requests/${requestId}`),
          client.get(`/cases/${requestId}/rounds`),
          client.get(`/messages/${requestId}`),
        ]);
        if (!alive) return;
        setRequest(rq.data);
        setRounds(rd.data.rounds);
        setQuestions(rd.data.questions);
        setMessages(msg.data);
        // latest DONE final-sheet draft
        const fd = await client.get(`/cases/${requestId}/final-draft`);
        if (!alive) return;
        setFinalDraft(fd.data);
        // prefill sheet form from existing brief or latest draft
        setSheet((prev: any) => {
          if (prev) return prev;
          const brief = rq.data.finalBrief;
          const out = fd.data?.output || {};
          return brief
            ? {
                title: brief.title || '',
                problem: brief.clarifiedProblem || '',
                outcome: brief.desiredOutcome || '',
                constraints_cost: brief.constraints || '',
                resources_info: brief.incompleteInfo || '',
                next_step: brief.nextStep || '',
                missing_info: '',
              }
            : {
                title: out.title || '',
                problem: out.problem || '',
                outcome: out.outcome || '',
                constraints_cost: out.constraints_cost || '',
                resources_info: (out.missing_info || []).join('\n'),
                next_step: out.next_step || '',
                missing_info: (out.missing_info || []).join('\n'),
              };
        });
      } catch (e: any) {
        if (alive) setError(e.response?.data?.error || 'بارگذاری پرونده ناموفق بود');
      }
    };
    load();
    // poll while any round is in progress
    const id = setInterval(() => {
      if (rounds.some((r) => r.status === 'PENDING')) load();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [requestId, rounds.length]);

  if (error && !request) {
    return (
      <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/admin" className="text-seraj-orange underline touch-target">بازگشت</Link>
      </div>
    );
  }
  if (!request) {
    return <div className="min-h-screen bg-seraj-bg flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }

  const lastAnalysis = rounds.filter((r) => r.kind === 'ANALYSIS').slice(-1)[0] || null;
  const activeQuestions = questions.filter((q) => q.status !== 'DELETED');
  const approvedCount = questions.filter((q) => q.status === 'APPROVED' || q.status === 'EDITED').length;

  const act = async (fn: () => Promise<any>) => {
    setBusy('work');
    setError('');
    try {
      await fn();
      const rd = await client.get(`/cases/${requestId}/rounds`);
      setRounds(rd.data.rounds);
      setQuestions(rd.data.questions);
    } catch (e: any) {
      setError(e.response?.data?.error || 'انجام نشد');
    } finally {
      setBusy('');
    }
  };

  const retryRound = async (roundId: string) => {
    setBusy('retry');
    setError('');
    try {
      await client.post(`/cases/rounds/${roundId}/retry`);
      const rd = await client.get(`/cases/${requestId}/rounds`);
      setRounds(rd.data.rounds);
    } catch (e: any) {
      setError(e.response?.data?.error || 'تلاش دوباره ناموفق بود');
    } finally {
      setBusy('');
    }
  };

  const generateFinalSheet = async () => {
    setBusy('sheet');
    setError('');
    try {
      await client.post(`/cases/${requestId}/final-sheet/generate`);
      // poll for completion
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const fd = await client.get(`/cases/${requestId}/final-draft`);
        const roundsNow = await client.get(`/cases/${requestId}/rounds`);
        setRounds(roundsNow.data.rounds);
        if (fd.data) {
          setFinalDraft(fd.data);
          const out = fd.data.output || {};
          setSheet({
            title: out.title || '',
            problem: out.problem || '',
            outcome: out.outcome || '',
            constraints_cost: out.constraints_cost || '',
            resources_info: (out.missing_info || []).join('\n'),
            next_step: out.next_step || '',
            missing_info: (out.missing_info || []).join('\n'),
          });
          break;
        }
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'ساخت پیش‌نویس ناموفق بود');
    } finally {
      setBusy('');
    }
  };

  const saveSheet = async () => {
    setBusy('save');
    setError('');
    try {
      await client.post(`/cases/${requestId}/final-sheet`, {
        title: sheet.title,
        problem: sheet.problem,
        outcome: sheet.outcome,
        constraints_cost: sheet.constraints_cost,
        resources_info: sheet.resources_info,
        next_step: sheet.next_step,
        missing_info: sheet.missing_info,
      });
      const rq = await client.get(`/requests/${requestId}`);
      setRequest(rq.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'ذخیره برگه ناموفق بود');
    } finally {
      setBusy('');
    }
  };

  const closeCase = async (type: 'completed' | 'incomplete') => {
    try {
      await client.post(`/cases/${requestId}/close`, { type });
      const rq = await client.get(`/requests/${requestId}`);
      setRequest(rq.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'بستن پرونده ناموفق بود');
    }
  };

  const field = (label: string, key: string, rows = 3) => (
    <div className="flex flex-col gap-2">
      <p className="text-seraj-orange text-xs font-bold">{label}</p>
      <textarea
        value={sheet?.[key] || ''}
        onChange={(e) => setSheet({ ...sheet, [key]: e.target.value })}
        rows={rows}
        className="w-full px-3 py-3 bg-black/30 border border-gray-700 rounded-xl text-sm"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <Link to="/admin" className="text-seraj-muted text-sm touch-target">بازگشت</Link>
        <h1 className="font-bold text-sm">
          پرونده — {request.user ? `${request.user.firstName} ${request.user.lastName}` : '—'}
        </h1>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 flex flex-col gap-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-seraj-muted">
            {REQUEST_STATUS_FA[request.status] || request.status}
          </span>
          <span className="text-seraj-muted text-xs" dir="ltr">
            {request.user?.phone}
          </span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Transcript + original audio (admin playback) */}
        <section className="bg-seraj-card border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
          <p className="font-bold text-sm">متن تأییدشده عضو</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.description}</p>
          {(request.attachments || []).map((a: any) => (
            <div key={a.id} className="border-t border-gray-800 pt-3">
              <p className="text-seraj-muted text-xs mb-2">صدای اصلی (پخش ادمین)</p>
              <AuthAudio fileId={a.id} />
            </div>
          ))}
        </section>

        {/* AI analysis */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">تحلیل هوش مصنوعی</h2>
            {lastAnalysis?.status === 'PENDING' && (
              <div className="flex items-center gap-2 text-seraj-muted text-xs">
                <div className="w-4 h-4 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin" />
                در حال تحلیل
              </div>
            )}
          </div>

          {!lastAnalysis && (
            <p className="text-seraj-muted text-sm">هنوز تحلیلی ثبت نشده است.</p>
          )}

          {lastAnalysis?.status === 'FAILED' && (
            <div className="bg-seraj-card border border-red-500/40 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-red-400 text-sm">{lastAnalysis.error || 'تحلیل ناموفق بود'}</p>
              <button
                onClick={() => retryRound(lastAnalysis.id)}
                disabled={busy === 'retry'}
                className="w-full py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold text-sm touch-target disabled:opacity-40"
              >
                تلاش دوباره
              </button>
              <p className="text-seraj-muted text-xs">یا سؤال را دستی اضافه کنید (پایین صفحه).</p>
            </div>
          )}

          {lastAnalysis?.status === 'DONE' && lastAnalysis.output && (
            <div className="bg-seraj-card border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
              <div>
                <p className="text-seraj-orange text-xs font-bold mb-1">خلاصه نیاز</p>
                <p className="text-sm leading-relaxed">{lastAnalysis.output.summary}</p>
              </div>
              <div>
                <p className="text-seraj-orange text-xs font-bold mb-1">اطلاعات ناقص</p>
                <ul className="text-sm leading-relaxed list-disc pr-5">
                  {(lastAnalysis.output.missing_info || []).map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                  {(lastAnalysis.output.missing_info || []).length === 0 && <li>—</li>}
                </ul>
              </div>
              <div>
                <p className="text-seraj-orange text-xs font-bold mb-1">وضعیت ۵ بخش شفافیت</p>
                <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
                  {Object.entries(lastAnalysis.output.clarity || {}).map(([k, v]) => (
                    <div key={k} className="bg-black/30 rounded-lg p-2">
                      <p className="text-seraj-muted">{CLARITY_KEYS_FA[k]}</p>
                      <p className="text-seraj-orange mt-1">{CLARITY_STATUS_FA[String(v)]}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-seraj-muted text-xs">
                آماده برای برگه نهایی: {lastAnalysis.output.ready_for_final ? 'بله' : 'نه'}
              </p>
            </div>
          )}
        </section>

        {/* Questions */}
        <section className="flex flex-col gap-3">
          <h2 className="font-bold">سؤال‌ها</h2>
          <div className="flex flex-col gap-2">
            {activeQuestions.map((q) => (
              <div key={q.id} className="bg-seraj-card border border-gray-800 rounded-xl p-3">
                {editing?.id === q.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-3 bg-black/30 border border-gray-700 rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          act(async () => {
                            await client.put(`/cases/questions/${q.id}`, { text: editing.text });
                            setEditing(null);
                          })
                        }
                        className="flex-1 py-2 bg-seraj-orange text-seraj-bg rounded-lg text-xs font-bold touch-target"
                      >
                        ذخیره
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-3 py-2 border border-gray-700 rounded-lg text-xs touch-target"
                      >
                        لغو
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed mb-1">{q.text}</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-seraj-muted text-xs">
                        {q.source === 'AI' ? 'پیشنهاد AI' : 'دستی'} —{' '}
                        {q.status === 'PENDING'
                          ? 'در انتظار تأیید'
                          : q.status === 'APPROVED'
                            ? 'تأییدشده'
                            : q.status === 'EDITED'
                              ? 'ویرایش‌شده (تأیید)'
                              : q.status === 'SENT'
                                ? 'ارسال‌شده به عضو'
                                : q.status}
                      </span>
                      {q.status !== 'SENT' && (
                        <div className="flex gap-2">
                          {q.status !== 'APPROVED' && q.status !== 'EDITED' && (
                            <button
                              onClick={() => act(() => client.post(`/cases/questions/${q.id}/approve`))}
                              className="text-seraj-orange text-xs underline px-2 py-2 touch-target"
                            >
                              تأیید
                            </button>
                          )}
                          <button
                            onClick={() => setEditing({ id: q.id, text: q.text })}
                            className="text-seraj-muted text-xs underline px-2 py-2 touch-target"
                          >
                            ویرایش
                          </button>
                          <button
                            onClick={() => act(() => client.delete(`/cases/questions/${q.id}`))}
                            className="text-red-400 text-xs underline px-2 py-2 touch-target"
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            {activeQuestions.length === 0 && (
              <p className="text-seraj-muted text-sm">سؤالی وجود ندارد.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={2}
              placeholder="افزودن سؤال دستی..."
              className="w-full px-3 py-3 bg-seraj-card border border-gray-700 rounded-xl text-sm"
            />
            <button
              onClick={() =>
                act(async () => {
                  await client.post(`/cases/${requestId}/questions`, { text: manualText });
                  setManualText('');
                })
              }
              disabled={!manualText.trim() || busy === 'work'}
              className="w-full py-3 bg-seraj-card border border-gray-700 rounded-xl font-bold text-sm touch-target disabled:opacity-40"
            >
              افزودن سؤال دستی
            </button>
          </div>

          <button
            onClick={() =>
              act(() => client.post(`/cases/${requestId}/send-questions`))
            }
            disabled={approvedCount === 0 || busy === 'work'}
            className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
          >
            ارسال سؤال‌های تأییدشده به عضو ({approvedCount})
          </button>
        </section>

        {/* Thread */}
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">گفتگوی پرونده</h2>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3 border ${
                m.sender === 'MEMBER'
                  ? 'bg-seraj-orange/10 border-seraj-orange/30'
                  : 'bg-seraj-card border-gray-800'
              }`}
            >
              <p className="text-seraj-muted text-xs mb-1">
                {m.sender === 'MEMBER' ? 'عضو' : 'ادمین'} —{' '}
                {new Date(m.createdAt).toLocaleString('fa-IR')}
              </p>
              {m.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>}
              {m.attachmentId && <AuthAudio fileId={m.attachmentId} />}
            </div>
          ))}
          {messages.length === 0 && <p className="text-seraj-muted text-sm">گفتگویی ثبت نشده است.</p>}
        </section>

        {/* Final sheet */}
        <section className="flex flex-col gap-3 bg-seraj-card border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">برگه نهایی</h2>
            {request.finalBrief && (
              <span className="text-seraj-muted text-xs">
                ذخیره‌شده — عضو: {request.finalBrief.memberApproved === true ? 'تأیید' : 'در انتظار'}
              </span>
            )}
          </div>
          {finalDraft && (
            <p className="text-seraj-muted text-xs">
              پیش‌نویس AI بارگذاری شده — ویرایش کنید و ذخیره/تأیید کنید.
            </p>
          )}
          {sheet && (
            <div className="flex flex-col gap-3">
              {field('عنوان', 'title', 1)}
              {field('مسئله', 'problem')}
              {field('نتیجه مطلوب', 'outcome')}
              {field('قیود و هزینه', 'constraints_cost')}
              {field('منابع و اطلاعات (فهرست ناقص‌ها — هر خط یک مورد)', 'resources_info')}
              {field('قدم بعدی', 'next_step')}
              <button
                onClick={saveSheet}
                disabled={busy === 'save'}
                className="w-full py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
              >
                {busy === 'save' ? '...' : 'ذخیره و تأیید ادمین'}
              </button>
              <Link
                to={`/brief/${requestId}`}
                className="text-center text-seraj-muted text-sm underline touch-target"
              >
                مشاهده برگه (نمای ادمین)
              </Link>
            </div>
          )}
          <button
            onClick={generateFinalSheet}
            disabled={busy === 'sheet'}
            className="w-full py-3 bg-seraj-card border border-seraj-orange rounded-xl font-bold text-seraj-orange touch-target disabled:opacity-40"
          >
            {busy === 'sheet' ? 'در حال ساخت پیش‌نویس...' : 'ساخت پیش‌نویس با AI'}
          </button>
        </section>

        {/* Close */}
        {request.status !== 'CLOSED_COMPLETED' && request.status !== 'CLOSED_INCOMPLETE' && (
          <section className="flex gap-2">
            <button
              onClick={() => closeCase('completed')}
              className="flex-1 py-3 bg-seraj-card border border-gray-700 rounded-xl text-sm touch-target"
            >
              بستن پرونده (تکمیل)
            </button>
            <button
              onClick={() => closeCase('incomplete')}
              className="flex-1 py-3 bg-seraj-card border border-gray-700 rounded-xl text-sm touch-target"
            >
              بستن پرونده (ناقص)
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
