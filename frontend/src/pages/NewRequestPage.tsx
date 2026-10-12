import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import AudioRecorder from '../components/AudioRecorder';
import AuthAudio from '../components/AuthAudio';

type Step = 'input' | 'recorded' | 'transcribing' | 'confirm' | 'submitting';

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('input');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const startText = () => {
    setAudioBlob(null);
    setStep('confirm');
    setHint('');
  };

  const onRecorded = (blob: Blob) => {
    setAudioBlob(blob);
    setStep('recorded');
  };

  const transcribe = async () => {
    if (!audioBlob) return;
    setStep('transcribing');
    setError('');
    try {
      const form = new FormData();
      form.append('audio', audioBlob, 'voice.webm');
      const res = await client.post('/ai/transcribe', form);
      setText(res.data.text);
      setStep('confirm');
      setHint('متن زیر را بررسی و اصلاح کن؛ فقط متن تأییدشده وارد پرونده می‌شود.');
    } catch (e: any) {
      setStep('recorded');
      const status = e.response?.status;
      if (status === 503) {
        setError('سرویس تبدیل صدا به متن تنظیم نشده است. لطفاً متن نیاز را بنویسید.');
      } else {
        setError('تبدیل صدا به متن ناموفق بود. دوباره تلاش کنید یا متن را بنویسید.');
      }
    }
  };

  const submit = async () => {
    if (!text.trim()) {
      setError('متن نیاز خالی است');
      return;
    }
    setStep('submitting');
    setError('');
    try {
      const form = new FormData();
      form.append('description', text.trim());
      if (audioBlob) form.append('voice', audioBlob, 'voice.webm');
      const res = await client.post('/requests', form);
      navigate(`/case/${res.data.id}`, { replace: true });
    } catch (e: any) {
      setStep('confirm');
      setError(e.response?.data?.error || 'ثبت پرونده ناموفق بود');
    }
  };

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <Link to="/dashboard" className="text-seraj-muted text-sm touch-target">بازگشت</Link>
        <h1 className="font-bold">ثبت نیاز جدید</h1>
        <span className="w-12" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {hint && <p className="text-seraj-orange text-sm mb-4 text-center">{hint}</p>}

        {step === 'input' && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-seraj-muted text-center leading-relaxed">
              نیاز خود را با صدا بگو (حداکثر ۳ دقیقه) یا بنویس.
            </p>
            <AudioRecorder onRecorded={onRecorded} />
            <button
              onClick={startText}
              className="text-seraj-orange text-sm underline touch-target px-4"
            >
              ترجیح می‌دهم بنویسم
            </button>
          </div>
        )}

        {step === 'recorded' && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-seraj-muted text-center">صدای شما آماده است. بشنوید و تأیید کنید.</p>
            {audioBlob && <AuthAudio blob={audioBlob} />}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={transcribe}
                className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target"
              >
                تبدیل به متن و ادامه
              </button>
              <button
                onClick={() => {
                  setAudioBlob(null);
                  setStep('input');
                }}
                className="w-full py-3 bg-seraj-card border border-gray-700 rounded-xl touch-target"
              >
                ضبط دوباره
              </button>
            </div>
          </div>
        )}

        {step === 'transcribing' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-10 h-10 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-seraj-muted">در حال تبدیل صدا به متن...</p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col gap-4">
            <p className="text-seraj-muted text-sm leading-relaxed">
              قدم بعدی: متن را بخوان، اصلاح کن و تأیید کن. فقط متن تأییدشده وارد پرونده می‌شود. لطفاً کد ملی و شماره حساب ننویس.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="متن نیاز شما..."
              className="w-full px-4 py-3 bg-seraj-card border border-gray-700 rounded-xl text-seraj-text leading-relaxed"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={submit}
              disabled={!text.trim() || (step as string) === 'submitting'}
              className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-50"
            >
              {(step as string) === 'submitting' ? 'در حال ثبت...' : 'تأیید و ثبت پرونده'}
            </button>
            {step === 'confirm' && !audioBlob && (
              <button
                onClick={() => setStep('input')}
                className="text-seraj-muted text-sm underline touch-target"
              >
                ضبط صدا به‌جای نوشتن
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
