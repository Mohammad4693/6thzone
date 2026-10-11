import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

// برگه نهایی: نیاز روشن، اولویت‌ها، اطلاعات ناقص، معیارهای انتخاب منابع، قدم بعدی
export default function BriefPage() {
  const { requestId } = useParams();
  const [brief, setBrief] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    client.get(`/briefs/${requestId}`).then(res => {
      setBrief(res.data);
      setLoading(false);
    }).catch(err => {
      setError(err.response?.data?.error || 'برگه یافت نشد');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [requestId]);

  const respond = async (approved: boolean) => {
    setMsg('');
    try {
      await client.post(`/briefs/${requestId}/member-response`, { approved, feedback: approved ? undefined : feedback });
      setMsg(approved ? '✓ تأیید شما ثبت شد' : 'بازخورد شما برای منتور ارسال شد');
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا');
    }
  };

  const download = async () => {
    try {
      const res = await client.get(`/briefs/${requestId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'seraj-brief.html';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'دانلود ممکن نشد');
    }
  };

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;
  if (!brief) return <Layout><div className="p-4 text-seraj-muted">{error || 'برگه‌ای برای این پرونده ثبت نشده است'}</div></Layout>;

  const bothApproved = brief.mentorApproved && brief.memberApproved === true;

  const sections = [
    { key: 'clarifiedProblem', label: 'نیاز روشن' },
    { key: 'priority', label: 'اولویت‌ها' },
    { key: 'incompleteInfo', label: 'اطلاعات ناقص' },
    { key: 'criteria', label: 'معیارهای انتخاب منابع' },
    { key: 'nextStep', label: 'قدم بعدی' },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">برگه نهایی</h1>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}

        <div className="bg-seraj-card rounded-2xl p-4 mb-4">
          <p className="font-bold mb-1">{brief.title || 'بدون عنوان'}</p>
          {brief.mentorName && <p className="text-xs text-seraj-muted">منتور: {brief.mentorName}</p>}
        </div>

        <div className="space-y-3 mb-4">
          {sections.map(s => (
            <div key={s.key} className="bg-seraj-card rounded-2xl p-4">
              <p className="text-seraj-orange text-xs font-bold mb-1">{s.label}</p>
              <p className="text-sm whitespace-pre-wrap">{brief[s.key] || '—'}</p>
            </div>
          ))}
        </div>

        {!brief.mentorApproved && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-sm text-yellow-400">
            برگه هنوز توسط منتور تأیید نشده است.
          </div>
        )}

        {brief.mentorApproved && brief.memberApproved !== true && (
          <div className="bg-seraj-card rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-sm mb-3">تأیید برگه توسط شما</h3>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="اگر تغییری لازم است، بنویسید (اختیاری)"
              className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[80px] mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => respond(true)} className="bg-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm touch-target">
                تأیید می‌کنم
              </button>
              <button onClick={() => respond(false)} disabled={!feedback.trim()} className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                نیاز به تغییر دارد
              </button>
            </div>
          </div>
        )}

        {bothApproved && (
          <button onClick={download} className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold touch-target">
            دانلود برگه نهایی
          </button>
        )}
      </div>
    </Layout>
  );
}
