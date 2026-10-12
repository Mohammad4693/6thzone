import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import ConsentGate from '../components/ConsentGate';

interface RequestRow {
  id: string;
  title?: string | null;
  description: string;
  status: string;
  createdAt: string;
  analysisStatus?: string | null;
  finalBrief?: { mentorApproved: boolean; memberApproved?: boolean | null } | null;
}

function statusLabel(r: RequestRow): string {
  if (r.status === 'PENDING_REVIEW') {
    if (r.analysisStatus === 'PENDING' || r.analysisStatus === null) return 'در حال تحلیل';
    return 'در بررسی ادمین';
  }
  const map: Record<string, string> = {
    APPROVED: 'در انتظار پاسخ شما',
    ASSIGNED: 'در جریان',
    CLOSED_EXPIRED: 'بسته‌شده',
    CLOSED_COMPLETED: 'بسته‌شده',
    CLOSED_INCOMPLETE: 'بسته‌شده',
    REJECTED: 'رد شده',
  };
  return map[r.status] || r.status;
}

// The member's next step, in plain Persian, per state (v4 §9).
function nextStep(r: RequestRow): string {
  if (r.status === 'PENDING_REVIEW') {
    if (r.analysisStatus === 'PENDING' || r.analysisStatus === null)
      return 'در حال تحلیل نیاز شما — صفحه را باز نگه دارید';
    return 'ادمین سراج سؤال‌ها را آماده می‌کند';
  }
  if (r.status === 'APPROVED') return 'سؤال جدید دارید — پاسخ بدهید';
  if (r.finalBrief?.mentorApproved && r.finalBrief.memberApproved === null)
    return 'برگه نهایی آماده است — ببینید و تأیید کنید';
  if (r.finalBrief?.mentorApproved && r.finalBrief.memberApproved === true)
    return 'پرونده کامل شد — نظرسنجی را فراموش نکنید';
  if (r.status.startsWith('CLOSED')) return 'این پرونده بسته شده است';
  if (r.status === 'REJECTED') return 'این پرونده پذیرفته نشده است';
  return 'در انتظار ادمین سراج';
}

function MemberContent() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await client.get('/requests');
        const rows: RequestRow[] = res.data;
        // Member API exposes only the analysis STATUS (never AI output)
        const withStatus = await Promise.all(
          rows.map(async (r) => {
            if (r.status !== 'PENDING_REVIEW') return r;
            try {
              const d = await client.get(`/requests/${r.id}`);
              return d.data as RequestRow;
            } catch {
              return r;
            }
          })
        );
        if (alive) {
          setRequests(withStatus);
          setLoaded(true);
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const openCase = (r: RequestRow) => navigate(`/case/${r.id}`);
  const openBrief = (r: RequestRow) => navigate(`/brief/${r.id}`);

  return (
    <div className="min-h-screen bg-seraj-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-seraj-bg z-10">
        <h1 className="font-bold text-seraj-orange">سراج</h1>
        <div className="flex items-center gap-3">
          <span className="text-seraj-muted text-sm">{user?.firstName}</span>
          <button onClick={logout} className="text-seraj-muted text-sm touch-target">خروج</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <button
            onClick={() => navigate('/new-request')}
            className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target"
          >
            ثبت نیاز جدید
          </button>
        </div>

        {loaded && requests.length === 0 ? (
          <div className="text-center text-seraj-muted py-12">
            <p className="mb-2">هنوز پرونده‌ای ندارید.</p>
            <p className="text-sm">قدم بعدی: با دکمه بالا اولین نیاز خود را ثبت کنید.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="w-full bg-seraj-card border border-gray-800 rounded-xl p-4"
                onClick={() => openCase(r)}
                role="button"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-seraj-muted">
                    {statusLabel(r)}
                  </span>
                  <span className="text-seraj-muted text-xs">
                    {new Date(r.createdAt).toLocaleDateString('fa-IR')}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">
                  {r.title || (r.description ? r.description.slice(0, 120) : 'بدون عنوان')}
                </p>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <p className="text-seraj-orange text-xs flex-1">{nextStep(r)}</p>
                  {r.finalBrief?.mentorApproved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openBrief(r);
                      }}
                      className="text-seraj-orange text-xs underline px-2 py-2 touch-target"
                    >
                      برگه نهایی
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MemberDashboard() {
  return (
    <ConsentGate>
      <MemberContent />
    </ConsentGate>
  );
}
