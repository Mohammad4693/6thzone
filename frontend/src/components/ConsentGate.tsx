import { useEffect, useState } from 'react';
import client from '../api/client';

const CONSENT_TEXT =
  'متن و صدای من برای تحلیل به سرویس هوش مصنوعی ارسال می‌شود و فقط ادمین سراج به پرونده من دسترسی دارد.';
const CONSENT_WARNING = 'لطفاً کد ملی و شماره حساب ننویسید.';

// First-login consent gate (v4 §5.1). Server stores the record; the server
// also blocks request creation without it.
export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'needed' | 'done'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/requests/consent-status')
      .then((r) => setState(r.data.accepted ? 'done' : 'needed'))
      .catch(() => setState('needed'));
  }, []);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await client.post('/requests/consent', { accepted: true });
      setState('done');
    } catch (e: any) {
      setError(e.response?.data?.error || 'ثبت رضایت ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }

  if (state === 'done') return <>{children}</>;

  return (
    <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-seraj-card border border-gray-800 rounded-2xl p-6">
        <h1 className="text-xl font-bold mb-4">رضایت شما</h1>
        <p className="leading-relaxed mb-4">{CONSENT_TEXT}</p>
        <p className="text-seraj-orange text-sm leading-relaxed mb-6">{CONSENT_WARNING}</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          onClick={accept}
          disabled={busy}
          className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-50"
        >
          {busy ? '...' : 'می‌پذیرم'}
        </button>
      </div>
    </div>
  );
}
