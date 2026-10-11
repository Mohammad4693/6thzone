import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import client from '../api/client';

// گزارش‌های پایلوت (پروپوزال v3، بند ۷): حضور، رضایت، ظرفیت منتورها،
// نقطه بازبینی پس از ۵ پرونده نخست، تأخیر نسبت به هدف ۲۴ ساعته و لاگ دسترسی.
export default function AdminReportsPage() {
  const [reports, setReports] = useState<any>(null);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/admin/reports'),
      client.get('/admin/access-logs').catch(() => ({ data: [] })),
    ]).then(([r, l]) => {
      setReports(r.data);
      setAccessLogs(l.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;
  if (!reports) return <Layout><div className="p-4 text-seraj-muted">داده‌ای یافت نشد</div></Layout>;

  const pct = (v: any) => (v === null || v === undefined ? 'داده کافی نیست' : `${v}٪`);

  const metric = (label: string, value: string, target: string, ok: boolean | null) => (
    <div className="bg-seraj-card rounded-2xl p-4">
      <p className="text-xs text-seraj-muted mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className={`text-xs mt-1 ${ok === null ? 'text-seraj-muted' : ok ? 'text-green-400' : 'text-red-400'}`}>
        {target}
        {ok !== null && (ok ? ' ✓' : ' ✗')}
      </p>
    </div>
  );

  const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const minuteToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">گزارش‌ها</h1>

        {/* نرخ حضور و رضایت */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {metric(
            'نرخ حضور (جلسات با حضور فرد ÷ جلسات با حضور منتور)',
            pct(reports.attendanceRate),
            'هدف: ≥۸۰٪',
            reports.attendanceRate === null ? null : reports.attendanceRate >= reports.attendanceTarget
          )}
          {metric(
            'رضایت (سهم امتیاز ۴ و ۵ از ۵)',
            pct(reports.satisfactionRate),
            `هدف: >۷۰٪ — ${reports.feedbackCount} پاسخ`,
            reports.satisfactionRate === null ? null : reports.satisfactionRate > reports.satisfactionTarget
          )}
        </div>
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <p className="text-xs text-seraj-muted">نرخ پاسخ فرم رضایت (پاسخ‌ها ÷ پرونده‌های بسته‌شده)</p>
          <p className="font-bold">{pct(reports.feedbackResponseRate)}</p>
        </div>

        {/* ظرفیت منتورها */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <h3 className="font-bold mb-3">ظرفیت منتورها</h3>
          {reports.mentorCapacity?.length === 0 ? (
            <p className="text-seraj-muted text-sm">منتوری ثبت نشده</p>
          ) : (
            <div className="space-y-2">
              {reports.mentorCapacity.map((m: any) => (
                <div key={m.userId} className="flex items-center justify-between text-sm">
                  <span>{m.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-seraj-orange" style={{ width: `${Math.min(100, (m.activeCount / m.capacity) * 100)}%` }} />
                    </div>
                    <span className={m.full ? 'text-red-400' : 'text-seraj-muted'}>{m.activeCount}/{m.capacity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* نقطه بازبینی پس از ۵ پرونده نخست */}
        <div className={`rounded-2xl p-4 mb-6 border ${reports.reviewCheckpoint?.reached ? 'bg-blue-500/10 border-blue-500/30' : 'bg-seraj-card border-transparent'}`}>
          <h3 className="font-bold mb-2">نقطه بازبینی پس از ۵ پرونده نخست</h3>
          <p className="text-sm text-seraj-muted mb-2">
            پرونده‌های بسته‌شده: {reports.reviewCheckpoint?.closedCases ?? 0} از ۵
            {reports.reviewCheckpoint?.reached && ' — زمان بازبینی فرا رسیده است'}
          </p>
          {(reports.reviewCheckpoint?.firstFive || []).map((c: any, i: number) => (
            <div key={c.id} className="flex justify-between text-xs text-seraj-muted py-1">
              <span>{i + 1}. {c.member}</span>
              <span>{c.status === 'CLOSED_COMPLETED' ? 'تکمیل' : 'ناقص'}{c.delayHours ? ` — تأخیر ${c.delayHours} ساعت` : ''}</span>
            </div>
          ))}
        </div>

        {/* تأخیر نسبت به هدف ۲۴ ساعته */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <h3 className="font-bold mb-2">تأخیر نسبت به هدف ۲۴ ساعته جمع‌بندی</h3>
          {reports.delays?.dataAvailable ? (
            <div className="text-sm space-y-1">
              <p>به‌موقع: {reports.delays.onTimeCount} — با تأخیر: {reports.delays.delayedCount}</p>
              <p>میانگین تأخیر: {reports.delays.avgDelayHours} ساعت</p>
            </div>
          ) : (
            <p className="text-seraj-muted text-sm">هنوز پرونده‌ای بسته نشده</p>
          )}
        </div>

        {/* لاگ دسترسی به پرونده‌ها */}
        <div className="bg-seraj-card rounded-2xl p-4">
          <h3 className="font-bold mb-3">لاگ دسترسی به پرونده‌ها (آخرین‌ها)</h3>
          {accessLogs.length === 0 ? (
            <p className="text-seraj-muted text-sm">دسترسی‌ای ثبت نشده</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {accessLogs.map((log: any) => (
                <div key={log.id} className="flex justify-between text-xs text-seraj-muted py-1">
                  <span>{log.actor?.firstName} {log.actor?.lastName} ({log.action === 'VIEW_CASE' ? 'مشاهده پرونده' : 'دانلود برگه'})</span>
                  <span>{new Date(log.createdAt).toLocaleString('fa-IR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
