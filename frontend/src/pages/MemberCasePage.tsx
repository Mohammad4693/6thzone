import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import AudioRecorder from '../components/AudioRecorder';
import AuthAudio from '../components/AuthAudio';

interface Message {
  id: string;
  sender: string;
  type: string;
  content?: string | null;
  attachmentId?: string | null;
  createdAt: string;
}

interface CaseData {
  id: string;
  description: string;
  status: string;
  analysisStatus?: string | null;
  messages: Message[];
  finalBrief?: { mentorApproved: boolean; memberApproved?: boolean | null } | null;
  feedback?: { status: string }[];
}

type AnswerStep = 'idle' | 'recorded' | 'transcribing' | 'confirm' | 'sending';

export default function MemberCasePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [answerStep, setAnswerStep] = useState<AnswerStep>('idle');
  const [answerBlob, setAnswerBlob] = useState<Blob | null>(null);
  const [answerError, setAnswerError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await client.get(`/requests/${requestId}`);
        if (alive) {
          setData(res.data);
          setError('');
        }
      } catch (e: any) {
        if (alive) setError(e.response?.data?.error || 'پرونده یافت نشد');
      }
    };
    load();
    // poll while analysing or waiting for admin
    const id = setInterval(() => {
      setData((d) => {
        if (d && (d.analysisStatus === 'PENDING' || d.status === 'PENDING_REVIEW')) load();
        return d;
      });
    }, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [requestId]);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/dashboard" className="text-seraj-orange underline touch-target">بازگشت به داشبورد</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-seraj-bg flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }

  const closed = data.status.startsWith('CLOSED') || data.status === 'REJECTED';
  const canAnswer = data.status === 'APPROVED';

  const onAnswerRecorded = (blob: Blob) => {
    setAnswerBlob(blob);
    setAnswerStep('recorded');
  };

  const transcribeAnswer = async () => {
    if (!answerBlob) return;
    setAnswerStep('transcribing');
    setAnswerError('');
    try {
      const form = new FormData();
      form.append('audio', answerBlob, 'voice.webm');
      const res = await client.post('/ai/transcribe', form);
      setAnswerText(res.data.text);
      setAnswerStep('confirm');
    } catch (e: any) {
      setAnswerStep('recorded');
      setAnswerError(
        e.response?.status === 503
          ? 'سرویس تبدیل صدا تنظیم نشده است. لطفاً متن پاسخ را بنویسید.'
          : 'تبدیل صدا به متن ناموفق بود. دوباره تلاش کنید یا متن را بنویسید.'
      );
    }
  };

  const sendAnswer = async () => {
    if (!answerText.trim()) return;
    setAnswerStep('sending');
    setAnswerError('');
    try {
      const form = new FormData();
      form.append('content', answerText.trim());
      if (answerBlob) form.append('voice', answerBlob, 'voice.webm');
      await client.post(`/messages/${requestId}`, form);
      setAnswerText('');
      setAnswerBlob(null);
      setAnswerStep('idle');
      const res = await client.get(`/requests/${requestId}`);
      setData(res.data);
    } catch (e: any) {
      setAnswerStep('confirm');
      setAnswerError(e.response?.data?.error || 'ارسال پاسخ ناموفق بود');
    }
  };

  const brief = data.finalBrief;
  const myFeedback = (data.feedback || []).some((f) => f.status === 'SUBMITTED');

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <Link to="/dashboard" className="text-seraj-muted text-sm touch-target">بازگشت</Link>
        <h1 className="font-bold text-sm">پرونده شما</h1>
        <span className="w-12" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 flex flex-col gap-4">
        {/* Next-step guidance */}
        <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
          <p className="text-seraj-orange text-sm font-bold">
            {closed
              ? 'این پرونده بسته شده است.'
              : data.status === 'PENDING_REVIEW'
                ? data.analysisStatus === 'PENDING' || data.analysisStatus === null
                  ? 'در حال تحلیل نیاز شما — چند لحظه صبر کنید'
                  : 'ادمین سراج سؤال‌ها را آماده می‌کند — منتظر بمانید'
                : canAnswer
                  ? 'قدم بعدی شما: پاسخ سؤال‌های ادمین را با صدا یا متن بدهید'
                  : brief?.mentorApproved
                    ? 'برگه نهایی آماده است — ببینید و تأیید کنید'
                    : 'در انتظار ادمین سراج'}
          </p>
          {data.analysisStatus === 'PENDING' && !closed && (
            <div className="w-6 h-6 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin mt-3" />
          )}
        </div>

        {/* Initial text */}
        <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
          <p className="text-seraj-muted text-xs mb-2">متن تأییدشده شما</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.description}</p>
        </div>

        {/* Q&A thread — only approved questions sent by admin appear here */}
        <div className="flex flex-col gap-3">
          {data.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-4 border ${
                m.sender === 'MEMBER'
                  ? 'bg-seraj-orange/10 border-seraj-orange/30 self-end max-w-[85%]'
                  : 'bg-seraj-card border-gray-800 self-start max-w-[85%]'
              }`}
            >
              <p className="text-seraj-muted text-xs mb-2">
                {m.sender === 'MEMBER' ? 'شما' : 'ادمین سراج'}
              </p>
              {m.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>}
              {m.attachmentId && <AuthAudio fileId={m.attachmentId} />}
            </div>
          ))}
          {data.messages.length === 0 && (
            <p className="text-seraj-muted text-sm text-center py-6">
              هنوز سؤالی برای شما ارسال نشده است.
            </p>
          )}
        </div>

        {/* Answer composer */}
        {canAnswer && !closed && (
          <div className="bg-seraj-card border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
            <p className="text-seraj-orange text-sm font-bold">پاسخ شما</p>

            {answerStep === 'idle' && (
              <div className="flex flex-col items-center gap-4">
                <AudioRecorder onRecorded={onAnswerRecorded} />
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={3}
                  placeholder="یا پاسخ را بنویسید..."
                  className="w-full px-4 py-3 bg-black/30 border border-gray-700 rounded-xl text-seraj-text"
                />
                <button
                  onClick={() => setAnswerStep('confirm')}
                  disabled={!answerText.trim()}
                  className="w-full py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
                >
                  ارسال پاسخ متنی
                </button>
              </div>
            )}

            {answerStep === 'recorded' && (
              <div className="flex flex-col items-center gap-4">
                {answerBlob && <AuthAudio blob={answerBlob} />}
                <button
                  onClick={transcribeAnswer}
                  className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target"
                >
                  تبدیل به متن و ادامه
                </button>
                <button
                  onClick={() => {
                    setAnswerBlob(null);
                    setAnswerStep('idle');
                  }}
                  className="text-seraj-muted text-sm underline touch-target"
                >
                  ضبط دوباره
                </button>
              </div>
            )}

            {answerStep === 'transcribing' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-8 h-8 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin" />
                <p className="text-seraj-muted text-sm">در حال تبدیل صدا به متن...</p>
              </div>
            )}

            {answerStep === 'confirm' && (
              <div className="flex flex-col gap-3">
                <p className="text-seraj-muted text-sm">
                  متن را بررسی و اصلاح کن — فقط متن تأییدشده وارد پرونده می‌شود.
                </p>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-black/30 border border-gray-700 rounded-xl text-seraj-text"
                />
                {answerError && <p className="text-red-400 text-sm">{answerError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={sendAnswer}
                    disabled={!answerText.trim() || (answerStep as string) === 'sending'}
                    className="flex-1 py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
                  >
                    {(answerStep as string) === 'sending' ? 'در حال ارسال...' : 'تأیید و ارسال'}
                  </button>
                  <button
                    onClick={() => {
                      setAnswerBlob(null);
                      setAnswerText('');
                      setAnswerStep('idle');
                    }}
                    className="px-4 py-3 bg-transparent border border-gray-700 rounded-xl text-seraj-muted touch-target"
                  >
                    لغو
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final brief */}
        {brief?.mentorApproved && (
          <button
            onClick={() => navigate(`/brief/${requestId}`)}
            className="w-full py-4 bg-seraj-card border border-seraj-orange rounded-xl font-bold text-seraj-orange touch-target"
          >
            مشاهده برگه نهایی
          </button>
        )}

        {/* Survey after final approval */}
        {brief?.memberApproved === true && !myFeedback && <SurveyBox requestId={requestId!} />}
      </main>
    </div>
  );
}

function SurveyBox({ requestId }: { requestId: string }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (rating < 1) return;
    setBusy(true);
    setError('');
    try {
      await client.post(`/feedback/${requestId}`, { rating, comment });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.error || 'ثبت نظرسنجی ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-seraj-card border border-gray-800 rounded-xl p-4 text-center">
        <p className="text-seraj-orange text-sm font-bold mb-2">ممنون از نظر شما!</p>
        <button onClick={() => navigate('/dashboard')} className="text-seraj-muted text-sm underline touch-target">
          بازگشت به داشبورد
        </button>
      </div>
    );
  }

  return (
    <div className="bg-seraj-card border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <p className="font-bold text-sm">نظرسنجی: پرونده را چطور ارزیابی می‌کنید؟</p>
      <div className="flex gap-2 justify-center" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={`w-11 h-11 rounded-lg touch-target flex items-center justify-center ${
              n <= rating ? 'bg-seraj-orange text-seraj-bg' : 'bg-white/5 text-seraj-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="یک جمله درباره تجربه شما..."
        className="w-full px-4 py-3 bg-black/30 border border-gray-700 rounded-xl text-seraj-text"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={submit}
        disabled={rating < 1 || busy}
        className="w-full py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
      >
        ثبت نظر
      </button>
    </div>
  );
}
