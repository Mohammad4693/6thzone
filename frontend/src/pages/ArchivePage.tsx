import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

export default function ArchivePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/requests').then(res => {
      setRequests(res.data.filter((r: any) => r.status.startsWith('CLOSED')));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabels: Record<string, string> = {
    CLOSED_EXPIRED: 'بسته شده (زمان پایان)',
    CLOSED_COMPLETED: 'تکمیل شده',
    CLOSED_INCOMPLETE: 'بسته شده (اطلاعات ناقص)',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">آرشیو</h1>
        {loading ? (
          <p className="text-seraj-muted">در حال بارگذاری...</p>
        ) : requests.length === 0 ? (
          <p className="text-seraj-muted">پرونده بسته‌شده‌ای ندارید.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <Link
                key={req.id}
                to={`/brief/${req.id}`}
                className="block bg-seraj-card rounded-2xl p-4 hover:bg-white/5 transition"
              >
                <p className="font-bold truncate">{req.title || req.description?.slice(0, 50) || 'بدون عنوان'}</p>
                <p className="text-sm text-seraj-muted">{statusLabels[req.status] || req.status}</p>
                <p className="text-xs text-seraj-muted mt-1">
                  بسته شده در: {req.closedAt ? new Date(req.closedAt).toLocaleDateString('fa-IR') : '-'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
