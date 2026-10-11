import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

export default function MentorDashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/mentor/dashboard').then(res => {
      setCases(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
      </div>
    </Layout>
  );
}
