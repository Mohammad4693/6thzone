import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import { REQUEST_STATUS_FA } from '../lib/labels';

interface NeedsAction {
  id: string;
  member: string;
  phone: string;
  status: string;
  reason: string;
  updatedAt: string;
}

interface RequestRow {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; phone: string };
  finalBrief?: { mentorApproved: boolean; memberApproved?: boolean | null } | null;
}

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  requestCount: number;
  linkActive: boolean;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [needsAction, setNeedsAction] = useState<NeedsAction[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [created, setCreated] = useState<{ loginUrl: string; whatsappText: string } | null>(null);
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [na, rq, mb] = await Promise.all([
          client.get('/cases/needs-action/all'),
          client.get('/requests'),
          client.get('/admin/members'),
        ]);
        if (!alive) return;
        setNeedsAction(na.data);
        setRequests(rq.data);
        setMembers(mb.data);
      } catch {}
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2000);
    }
  };

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setCreateError('');
    setCreated(null);
    try {
      const res = await client.post('/admin/members', { firstName, lastName, phone });
      setCreated(res.data);
      setFirstName('');
      setLastName('');
      setPhone('');
      const mb = await client.get('/admin/members');
      setMembers(mb.data);
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'ساخت عضو ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const relink = async (id: string) => {
    try {
      const res = await client.post(`/admin/members/${id}/relink`);
      setCreated(res.data);
    } catch {}
  };

  const revoke = async (id: string) => {
    try {
      await client.post(`/admin/members/${id}/revoke`);
      const mb = await client.get('/admin/members');
      setMembers(mb.data);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <h1 className="font-bold text-seraj-orange">پنل ادمین سراج</h1>
        <div className="flex items-center gap-3">
          <Link to="/admin/stats" className="text-seraj-muted text-sm touch-target">آمار</Link>
          <span className="text-seraj-muted text-sm">{user?.firstName}</span>
          <button onClick={logout} className="text-seraj-muted text-sm touch-target">خروج</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 flex flex-col gap-8">
        {/* Needs-action queue — always on top */}
        <section>
          <h2 className="font-bold mb-3">نیازمند بررسی ({needsAction.length})</h2>
          {needsAction.length === 0 ? (
            <p className="text-seraj-muted text-sm">پرونده‌ای منتظر اقدام شما نیست.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {needsAction.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate(`/admin/case/${n.id}`)}
                  className="w-full text-right bg-seraj-card border border-seraj-orange/40 rounded-xl p-4 touch-target"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-sm">{n.member}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-seraj-orange/20 text-seraj-orange">
                      {REQUEST_STATUS_FA[n.status] || n.status}
                    </span>
                  </div>
                  <p className="text-seraj-orange text-xs">{n.reason}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Member management */}
        <section>
          <h2 className="font-bold mb-3">اعضا</h2>
          <form onSubmit={createMember} className="bg-seraj-card border border-gray-800 rounded-xl p-4 flex flex-col gap-3 mb-4">
            <p className="text-sm text-seraj-muted">ساخت عضو جدید</p>
            <div className="flex gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="نام"
                className="flex-1 px-3 py-3 bg-black/30 border border-gray-700 rounded-xl touch-target"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="نام خانوادگی"
                className="flex-1 px-3 py-3 bg-black/30 border border-gray-700 rounded-xl touch-target"
              />
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="شماره تلفن (مثلاً 09123456789)"
              dir="ltr"
              className="w-full px-3 py-3 bg-black/30 border border-gray-700 rounded-xl touch-target"
            />
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={busy || !firstName || !lastName || !phone}
              className="w-full py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-40"
            >
              ساخت عضو و لینک ورود
            </button>
          </form>

          {created && (
            <div className="bg-seraj-card border border-seraj-orange rounded-xl p-4 mb-4 flex flex-col gap-3">
              <p className="text-seraj-orange text-sm font-bold">لینک ورود ساخته شد — فقط این بار نمایش داده می‌شود</p>
              <p dir="ltr" className="text-xs break-all bg-black/30 rounded-lg p-3">{created.loginUrl}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copy(created.loginUrl, 'link')}
                  className="flex-1 py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold text-sm touch-target"
                >
                  {copied === 'link' ? 'کپی شد ✓' : 'کپی لینک'}
                </button>
                <button
                  onClick={() => copy(created.whatsappText, 'wa')}
                  className="flex-1 py-3 bg-seraj-card border border-seraj-orange rounded-xl font-bold text-sm text-seraj-orange touch-target"
                >
                  {copied === 'wa' ? 'کپی شد ✓' : 'کپی پیام واتس‌اپ'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className="bg-seraj-card border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm">{m.firstName} {m.lastName}</span>
                  <span className="text-seraj-muted text-xs" dir="ltr">{m.phone}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-seraj-muted text-xs">
                    {m.requestCount} پرونده — لینک: {m.linkActive ? 'فعال' : 'ندارد'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => relink(m.id)}
                      className="text-seraj-orange text-xs underline px-2 py-2 touch-target"
                    >
                      لینک جدید
                    </button>
                    {m.linkActive && (
                      <button
                        onClick={() => revoke(m.id)}
                        className="text-red-400 text-xs underline px-2 py-2 touch-target"
                      >
                        باطل‌کردن لینک
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All cases */}
        <section>
          <h2 className="font-bold mb-3">همه پرونده‌ها ({requests.length})</h2>
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/admin/case/${r.id}`)}
                className="w-full text-right bg-seraj-card border border-gray-800 rounded-xl p-4 touch-target"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">
                    {r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-seraj-muted">
                    {REQUEST_STATUS_FA[r.status] || r.status}
                  </span>
                </div>
                <p className="text-seraj-muted text-xs line-clamp-1">{r.description.slice(0, 80)}</p>
                {r.finalBrief && (
                  <p className="text-seraj-muted text-xs mt-1">
                    برگه: ادمین {r.finalBrief.mentorApproved ? 'تأیید' : 'در جریان'} / عضو{' '}
                    {r.finalBrief.memberApproved === true ? 'تأیید' : r.finalBrief.memberApproved === false ? 'رد' : '—'}
                  </p>
                )}
              </button>
            ))}
            {requests.length === 0 && <p className="text-seraj-muted text-sm">هنوز پرونده‌ای ثبت نشده است.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
