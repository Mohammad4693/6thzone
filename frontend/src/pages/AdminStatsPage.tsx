import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface Stats {
  totalRequests: number;
  finalBriefs: number;
  avgHoursToBrief: number | null;
  avgMinutesToBrief: number | null;
  satisfaction: { distribution: Record<string, number>; respondents: number };
  aiQuestions: {
    total: number;
    approvedWithoutEdit: number;
    approvedWithoutEditPct: number | null;
    edited: number;
    editedPct: number | null;
    deleted: number;
    deletedPct: number | null;
  };
  aiCost: { calls: number; totalUsd: number; tokensIn: number; tokensOut: number };
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/admin/stats')
      .then((r) => setStats(r.data))
      .catch(() => setError('بارگذاری آمار ناموفق بود'));
  }, []);

  const card = (label: string, value: string | number) => (
    <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
      <p className="text-seraj-muted text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <Link to="/admin" className="text-seraj-muted text-sm touch-target">بازگشت</Link>
        <h1 className="font-bold text-sm">آمار سراج</h1>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!stats && !error && <p className="text-seraj-muted">در حال بارگذاری...</p>}

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {card('نیازهای ثبت‌شده', stats.totalRequests)}
              {card('برگه‌های نهایی', stats.finalBriefs)}
              {card(
                'میانگین زمان تا برگه نهایی',
                stats.avgHoursToBrief === null
                  ? '—'
                  : `${stats.avgMinutesToBrief} دقیقه`
              )}
              {card('هزینه کل AI', `$${stats.aiCost.totalUsd} (${stats.aiCost.calls} فراخوانی)`)}
            </div>

            <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
              <p className="font-bold text-sm mb-3">توزیع امتیاز رضایت</p>
              {stats.satisfaction.respondents === 0 ? (
                <p className="text-seraj-muted text-sm">هنوز پاسخی ثبت نشده است.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-seraj-muted text-xs mb-1">
                    تعداد پاسخ‌دهنده: {stats.satisfaction.respondents}
                  </p>
                  {['5', '4', '3', '2', '1'].map((n) => {
                    const count = stats.satisfaction.distribution[n] || 0;
                    const pct = stats.satisfaction.respondents
                      ? Math.round((count / stats.satisfaction.respondents) * 100)
                      : 0;
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span className="w-6 text-sm">{n}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-seraj-orange" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-seraj-muted text-xs w-8 text-left">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-seraj-card border border-gray-800 rounded-xl p-4">
              <p className="font-bold text-sm mb-3">سؤال‌های پیشنهادی AI</p>
              {stats.aiQuestions.total === 0 ? (
                <p className="text-seraj-muted text-sm">هنوز سؤالی تولید نشده است.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-seraj-orange text-lg font-bold">{stats.aiQuestions.approvedWithoutEditPct ?? 0}%</p>
                    <p className="text-seraj-muted mt-1">تأیید بدون ویرایش</p>
                    <p className="text-seraj-muted">({stats.aiQuestions.approvedWithoutEdit})</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-seraj-orange text-lg font-bold">{stats.aiQuestions.editedPct ?? 0}%</p>
                    <p className="text-seraj-muted mt-1">ویرایش‌شده</p>
                    <p className="text-seraj-muted">({stats.aiQuestions.edited})</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-seraj-orange text-lg font-bold">{stats.aiQuestions.deletedPct ?? 0}%</p>
                    <p className="text-seraj-muted mt-1">حذف‌شده</p>
                    <p className="text-seraj-muted">({stats.aiQuestions.deleted})</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
