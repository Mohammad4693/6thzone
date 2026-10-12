import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

interface Brief {
  title: string;
  initialDesc: string;
  clarifiedProblem: string;
  desiredOutcome: string;
  constraints?: string | null;
  incompleteInfo?: string | null;
  nextStep?: string | null;
  mentorApproved: boolean;
  memberApproved?: boolean | null;
}

// Final brief — member view + approval + print/PDF. Members only ever reach
// this page with an admin-approved brief (the API returns null otherwise).
export default function BriefPage() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get(`/briefs/${requestId}`)
      .then((r) => setBrief(r.data))
      .catch(() => setError('برگه یافت نشد'))
      .finally(() => setLoading(false));
  }, [requestId]);

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await client.post(`/briefs/${requestId}/member-response`, { approved: true });
      setBrief(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'تأیید ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const res = await client.get(`/briefs/${requestId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      setError('دانلود ناموفق بود');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-seraj-bg flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }
  if (!brief) {
    return (
      <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6 text-center">
        <p className="text-seraj-muted mb-4">برگه هنوز تأیید نشده یا در دسترس شما نیست.</p>
        <Link to="/dashboard" className="text-seraj-orange underline touch-target">بازگشت</Link>
      </div>
    );
  }

  const isMember = user?.role === 'MEMBER';
  const canDownload = brief.mentorApproved && brief.memberApproved === true;
  const section = (label: string, value?: string | null) => (
    <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
      <p className="text-seraj-orange text-xs font-bold mb-2">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <Link to={isMember ? '/dashboard' : '/admin'} className="text-seraj-muted text-sm touch-target">بازگشت</Link>
        <h1 className="font-bold text-sm">برگه روشن نیاز</h1>
        <span className="w-12" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 flex flex-col gap-3">
        <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
          <p className="text-seraj-muted text-xs mb-1">عنوان</p>
          <p className="font-bold leading-relaxed">{brief.title || 'بدون عنوان'}</p>
          <p className="text-seraj-muted text-xs mt-3 mb-1">شرح اولیه</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{brief.initialDesc || '—'}</p>
        </div>
        {section('۱. مسئله', brief.clarifiedProblem)}
        {section('۲. نتیجه مطلوب', brief.desiredOutcome)}
        {section('۳. قیود و هزینه', brief.constraints)}
        {section('۴. منابع و اطلاعات', brief.incompleteInfo)}
        {section('۵. قدم بعدی', brief.nextStep)}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {isMember && brief.mentorApproved && brief.memberApproved !== true && (
          <button
            onClick={approve}
            disabled={busy}
            className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-50"
          >
            {busy ? '...' : 'برگه را تأیید می‌کنم'}
          </button>
        )}

        {canDownload && (
          <button
            onClick={download}
            className="w-full py-4 bg-seraj-card border border-seraj-orange rounded-xl font-bold text-seraj-orange touch-target"
          >
            دریافت نسخه PDF / چاپ
          </button>
        )}

        <p className="text-seraj-muted text-xs text-center leading-relaxed">
          نسخه PDF به‌صورت فایل آماده چاپ (فارسی و راست‌به‌چپ) باز می‌شود؛ با گزینه Save as PDF مرورگر ذخیره کنید.
        </p>
      </main>
    </div>
  );
}
