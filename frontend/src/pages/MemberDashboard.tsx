import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

export default function MemberDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/requests').then(res => {
      setRequests(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabels: Record<string, string> = {
    DRAFT: 'پیش‌نویس',
    PENDING_REVIEW: 'در انتظار بررسی',
    APPROVED: 'پذیرفته شده',
    ASSIGNED: 'در حال پیگیری',
    CLOSED_EXPIRED: 'بسته شده (زمان پایان)',
    CLOSED_COMPLETED: 'تکمیل شده',
    CLOSED_INCOMPLETE: 'بسته شده (اطلاعات ناقص)',
    REJECTED: 'رد شده',
  };

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'text-yellow-400',
    APPROVED: 'text-blue-400',
    ASSIGNED: 'text-green-400',
    CLOSED_EXPIRED: 'text-gray-500',
    CLOSED_COMPLETED: 'text-green-500',
    CLOSED_INCOMPLETE: 'text-orange-400',
    REJECTED: 'text-red-400',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">درخواست‌های من</h1>
          <Link to="/new-request" className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl font-bold text-sm touch-target">
            درخواست جدید
          </Link>
        </div>

        {loading ? (
          <p className="text-seraj-muted">در حال بارگذاری...</p>
        ) : requests.length === 0 ? (
          <div className="bg-seraj-card rounded-2xl p-8 text-center">
            <p className="text-seraj-muted mb-4">هنوز درخواستی ثبت نکرده‌اید</p>
            <Link to="/new-request" className="text-seraj-orange underline">اولین درخواست خود را ثبت کنید</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <Link
                key={req.id}
                to={req.assignment ? `/chat/${req.id}` : `/brief/${req.id}`}
                className="block bg-seraj-card rounded-2xl p-4 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{req.title || req.description?.slice(0, 50) || 'بدون عنوان'}</p>
                    <p className={`text-sm ${statusColors[req.status] || 'text-seraj-muted'}`}>
                      {statusLabels[req.status] || req.status}
                    </p>
                    {req.assignment && req.assignment.status === 'ACTIVE' && (
                      <CountdownTimer expiresAt={req.assignment.expiresAt} />
                    )}
                    {req.assignment?.mentor && (
                      <p className="text-xs text-seraj-muted mt-1">
                        منتور: {req.assignment.mentor.firstName} {req.assignment.mentor.lastName}
                        {req.assignment.mentor.mentorProfile?.expertise?.length > 0 && ` — ${req.assignment.mentor.mentorProfile.expertise.join('، ')}`}
                      </p>
                    )}
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7AEA5" strokeWidth="2" className="flex-shrink-0">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('پایان یافته'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`زمان باقی‌مانده: ${h} ساعت و ${m} دقیقه`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <p className="text-xs text-seraj-orange mt-1">{remaining}</p>;
}
