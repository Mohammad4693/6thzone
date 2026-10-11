import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export default function MentorDashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [windows, setWindows] = useState<any[]>([]);
  const [newWin, setNewWin] = useState({ dayOfWeek: 0, start: '10:00', end: '10:30' });
  const [showAvail, setShowAvail] = useState(false);

  useEffect(() => {
    client.get('/mentor/dashboard').then(res => {
      setCases(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
    client.get('/mentor/availability').then(res => setWindows(res.data)).catch(() => {});
  }, []);

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const addWindow = async () => {
    const startMinute = toMinutes(newWin.start);
    const endMinute = toMinutes(newWin.end);
    if (endMinute - startMinute < 15) {
      alert('هر بازه باید حداقل ۱۵ دقیقه باشد');
      return;
    }
    const next = [...windows, { dayOfWeek: newWin.dayOfWeek, startMinute, endMinute }];
    try {
      const res = await client.put('/mentor/availability', { windows: next });
      setWindows(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  const removeWindow = async (idx: number) => {
    const next = windows.filter((_, i) => i !== idx);
    try {
      const res = await client.put('/mentor/availability', { windows: next });
      setWindows(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  const fmt = (w: any) => `${DAYS[w.dayOfWeek]} ${Math.floor(w.startMinute / 60)}:${String(w.startMinute % 60).padStart(2, '0')} تا ${Math.floor(w.endMinute / 60)}:${String(w.endMinute % 60).padStart(2, '0')}`;

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return 'پایان یافته';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}س ${m}د`;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">پرونده‌های تخصیص‌یافته</h1>
        {loading ? (
          <p className="text-seraj-muted">در حال بارگذاری...</p>
        ) : cases.length === 0 ? (
          <div className="bg-seraj-card rounded-2xl p-8 text-center">
            <p className="text-seraj-muted">پرونده فعالی ندارید</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c: any) => (
              <Link
                key={c.id}
                to={`/mentor/case/${c.requestId}`}
                className="block bg-seraj-card rounded-2xl p-4 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">
                      {c.request.user?.firstName} {c.request.user?.lastName}
                    </p>
                    <p className="text-sm text-seraj-muted truncate">
                      {c.request.title || c.request.description?.slice(0, 50) || 'بدون عنوان'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-seraj-orange">{formatRemaining(c.timeRemaining)}</span>
                      {c.request.newDrafts > 0 && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                          {c.request.newDrafts} پیش‌نویس جدید
                        </span>
                      )}
                      {c.request.pendingSessions > 0 && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                          {c.request.pendingSessions} جلسه
                        </span>
                      )}
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7AEA5" strokeWidth="2" className="flex-shrink-0">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* بازه‌های خالی برای جلسه ۱۵ دقیقه‌ای */}
        <div className="bg-seraj-card rounded-2xl p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">بازه‌های خالی من (برای جلسه ۱۵ دقیقه‌ای)</h3>
            <button onClick={() => setShowAvail(!showAvail)} className="text-seraj-orange text-sm">
              {showAvail ? 'بستن' : 'ویرایش'}
            </button>
          </div>
          {windows.length === 0 && !showAvail && (
            <p className="text-seraj-muted text-sm">بازه‌ای ثبت نکرده‌اید — ادمین برای هماهنگی جلسه به آن نیاز دارد</p>
          )}
          <div className="space-y-1">
            {windows.map((w, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>{fmt(w)}</span>
                {showAvail && (
                  <button onClick={() => removeWindow(i)} className="text-red-400 text-xs">حذف</button>
                )}
              </div>
            ))}
          </div>
          {showAvail && (
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <select
                value={newWin.dayOfWeek}
                onChange={e => setNewWin({ ...newWin, dayOfWeek: parseInt(e.target.value) })}
                className="bg-seraj-bg border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-seraj-orange focus:outline-none"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newWin.start} onChange={e => setNewWin({ ...newWin, start: e.target.value })}
                className="bg-seraj-bg border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-seraj-orange focus:outline-none" />
              <input type="time" value={newWin.end} onChange={e => setNewWin({ ...newWin, end: e.target.value })}
                className="bg-seraj-bg border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-seraj-orange focus:outline-none" />
              <button onClick={addWindow} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold">افزودن</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
