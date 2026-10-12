import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import client from '../api/client';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

// جلسه آنلاین ۱۵ دقیقه‌ای: درخواست عضو → هماهنگی ادمین → زمان‌های خالی منتور
export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [availability, setAvailability] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState<Record<string, { scheduledAt: string; link: string }>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const dash = await client.get('/admin/dashboard');
    const list = dash.data.sessions || [];
    setSessions(list);
    const mentorIds = [...new Set(list.map((s: any) => s.request.assignment?.mentorId).filter(Boolean))];
    const av: Record<string, any[]> = {};
    await Promise.all(mentorIds.map(async (mid: any) => {
      try {
        const r = await client.get(`/admin/sessions/availability/${mid}`);
        av[mid] = r.data;
      } catch { av[mid] = []; }
    }));
    setAvailability(av);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const schedule = async (id: string) => {
    setMsg('');
    setError('');
    try {
      const f = form[id];
      if (!f?.scheduledAt) { setError('زمان جلسه را انتخاب کنید'); return; }
      await client.post(`/admin/sessions/${id}/schedule`, {
        scheduledAt: new Date(f.scheduledAt).toISOString(),
        link: f.link || undefined,
      });
      setMsg('✓ جلسه برنامه‌ریزی شد (۱۵ دقیقه)');
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا');
    }
  };

  const attendance = async (id: string, memberAttended: boolean, mentorAttended: boolean) => {
    try {
      await client.post(`/admin/sessions/${id}/attendance`, { memberAttended, mentorAttended, status: 'COMPLETED' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا');
    }
  };

  const fmtWindow = (a: any) => `${DAYS[a.dayOfWeek]} ${Math.floor(a.startMinute / 60)}:${String(a.startMinute % 60).padStart(2, '0')} تا ${Math.floor(a.endMinute / 60)}:${String(a.endMinute % 60).padStart(2, '0')}`;

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">جلسه‌های آنلاین (۱۵ دقیقه)</h1>
        <p className="text-sm text-seraj-muted mb-6">زمان جلسه باید داخل یکی از بازه‌های خالی منتور باشد و با جلسات دیگر تداخل نداشته باشد.</p>
        {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {sessions.length === 0 ? (
          <div className="bg-seraj-card rounded-2xl p-8 text-center">
            <p className="text-seraj-muted">جلسه‌ای در انتظار هماهنگی نیست</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s: any) => {
              const mentorId = s.request.assignment?.mentorId;
              const wins = availability[mentorId] || [];
              return (
                <div key={s.id} className="bg-seraj-card rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-sm">{s.request.user.firstName} {s.request.user.lastName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'REQUESTED' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {s.status === 'REQUESTED' ? 'درخواست‌شده' : 'برنامه‌ریزی‌شده'}
                    </span>
                  </div>
                  <p className="text-xs text-seraj-muted mb-3">منتور: {s.request.assignment?.mentor?.firstName} {s.request.assignment?.mentor?.lastName}</p>

                  {wins.length > 0 && (
                    <p className="text-xs text-seraj-muted mb-2">بازه‌های خالی منتور: {wins.map(fmtWindow).join(' • ')}</p>
                  )}
                  {wins.length === 0 && (
                    <p className="text-xs text-yellow-400 mb-2">این منتور هنوز بازه خالی ثبت نکرده است.</p>
                  )}

                  {s.status === 'REQUESTED' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="datetime-local"
                        onChange={e => setForm({ ...form, [s.id]: { ...(form[s.id] || { link: '' }), scheduledAt: e.target.value } })}
                        className="bg-seraj-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-seraj-text focus:border-seraj-orange focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="لینک جلسه (اختیاری)"
                        onChange={e => setForm({ ...form, [s.id]: { ...(form[s.id] || { scheduledAt: '' }), link: e.target.value } })}
                        className="flex-1 min-w-[160px] bg-seraj-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-seraj-text focus:border-seraj-orange focus:outline-none"
                      />
                      <button onClick={() => schedule(s.id)} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold">
                        ثبت جلسه
                      </button>
                    </div>
                  )}

                  {s.status === 'SCHEDULED' && s.scheduledAt && (
                    <p className="text-sm">زمان: {new Date(s.scheduledAt).toLocaleString('fa-IR')}</p>
                  )}
                  {s.status === 'SCHEDULED' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => attendance(s.id, true, true)} className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-xs">
                        ثبت حضور هر دو
                      </button>
                      <button onClick={() => attendance(s.id, false, true)} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs">
                        عدم حضور فرد
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
