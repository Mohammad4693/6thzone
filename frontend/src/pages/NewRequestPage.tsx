import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AudioRecorder from '../components/AudioRecorder';
import client from '../api/client';

export default function NewRequestPage() {
  const [mode, setMode] = useState<'choice' | 'voice' | 'text'>('choice');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [consentText, setConsentText] = useState('');
  const [consentVersion, setConsentVersion] = useState('1.0');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [contributionAmount, setContributionAmount] = useState(150000);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/settings').then(res => {
      setConsentText(res.data.consentText || '');
      setConsentVersion(res.data.consentVersion || '1.0');
      setContributionAmount(res.data.contributionAmount || 150000);
    }).catch(() => {});
    // Also get consent from the requests endpoint
    client.get('/requests/consent').then(res => {
      setConsentText(res.data.text || consentText);
      setConsentVersion(res.data.version || consentVersion);
    }).catch(() => {});
  }, []);

  const formatToman = (n: number) => n.toLocaleString('fa-IR') + ' تومان';

  const handleSubmit = async () => {
    if (!consentAccepted) {
      setError('پذیرش فرم رضایت الزامی است');
      return;
    }
    if (mode === 'text' && !text.trim()) {
      setError('متن نیاز الزامی است');
      return;
    }
    if (mode === 'voice' && !voiceBlob) {
      setError('ابتدا باید ضبط کنید');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      if (mode === 'voice' && voiceBlob) {
        formData.append('voice', voiceBlob, 'voice.webm');
      }
      formData.append('description', text);
      formData.append('title', title);
      formData.append('consentAccepted', 'true');
      formData.append('consentVersion', consentVersion);

      await client.post('/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ثبت درخواست');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">ثبت نیاز جدید</h1>

        {mode === 'choice' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('voice')}
              className="w-full bg-seraj-card rounded-2xl p-6 text-center hover:bg-white/5 transition"
            >
              <div className="w-16 h-16 rounded-full bg-seraj-orange/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <p className="font-bold">ضبط صدا</p>
              <p className="text-sm text-seraj-muted mt-1">نیازتان را با صدا بیان کنید</p>
            </button>

            <button
              onClick={() => setMode('text')}
              className="w-full bg-seraj-card rounded-2xl p-6 text-center hover:bg-white/5 transition"
            >
              <div className="w-16 h-16 rounded-full bg-seraj-orange/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <p className="font-bold">نوشتن متن</p>
              <p className="text-sm text-seraj-muted mt-1">نیازتان را به‌صورت متنی بیان کنید</p>
            </button>
          </div>
        )}

        {mode === 'voice' && (
          <div className="bg-seraj-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">ضبط صدا</h2>
            <AudioRecorder onRecorded={(blob) => setVoiceBlob(blob)} />
            {voiceBlob && (
              <div className="mt-4 text-center">
                <p className="text-green-400 text-sm mb-2">✓ صدا ضبط شد</p>
                <button
                  onClick={() => setVoiceBlob(null)}
                  className="text-seraj-muted text-sm underline"
                >
                  ضبط دوباره
                </button>
              </div>
            )}
            <div className="mt-4">
              <label className="text-sm text-seraj-muted mb-1 block">توضیح تکمیلی (اختیاری)</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[80px]"
                placeholder="می‌توانید توضیح متنی اضافه کنید"
              />
            </div>
            <button onClick={() => setMode('choice')} className="text-seraj-muted text-sm mt-4 underline">
              تغییر روش
            </button>
          </div>
        )}

        {mode === 'text' && (
          <div className="bg-seraj-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">نوشتن متن</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">عنوان (اختیاری)</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
                  placeholder="عنوان کوتاه نیاز"
                />
              </div>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">شرح نیاز</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[160px]"
                  placeholder="نیازتان را کامل توضیح دهید..."
                  required
                />
              </div>
            </div>
            <button onClick={() => setMode('choice')} className="text-seraj-muted text-sm mt-4 underline">
              تغییر روش
            </button>
          </div>
        )}

        {(mode === 'voice' || mode === 'text') && (
          <>
            {/* Contribution info */}
            <div className="bg-seraj-card rounded-2xl p-4 mt-4">
              <h3 className="font-bold text-sm mb-2">سهم مشارکت</h3>
              <p className="text-seraj-orange font-bold text-lg">{formatToman(contributionAmount)}</p>
              <p className="text-seraj-muted text-xs mt-1">
                این مشارکت، قدم اولیه شما برای آغاز و پیگیری فرایند تا پایان است.
              </p>
              <p className="text-seraj-muted text-xs mt-1">
                این پرداخت به منتور نیست و خرید مشاوره تخصصی محسوب نمی‌شود. به‌صورت کمک بلاعوض به صندوق پشتیبانی است.
              </p>
            </div>

            {/* Consent form */}
            <div className="bg-seraj-card rounded-2xl p-4 mt-4">
              <h3 className="font-bold text-sm mb-2">فرم رضایت آگاهانه</h3>
              <p className="text-seraj-muted text-sm leading-relaxed mb-3">{consentText}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={e => setConsentAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-seraj-orange"
                />
                <span className="text-sm">می‌پذیرم و تأیید می‌کنم</span>
              </label>
            </div>

            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold mt-4 disabled:opacity-50 touch-target"
            >
              {loading ? 'در حال ارسال...' : 'ارسال درخواست'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
