import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import client from '../api/client';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [mentors, setMentors] = useState<any[]>([]);

  useEffect(() => {
    loadRequests();
    loadMentors();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const url = filter ? `/admin/requests?status=${filter}` : '/admin/requests';
      const res = await client.get(url);
      setRequests(res.data);
    } catch {}
    setLoading(false);
  };

  const loadMentors = async () => {
    try {
      const res = await client.get('/admin/users?role=MENTOR');
      setMentors(res.data);
    } catch {}
  };

  const approve = async (id: string) => {
    try {
      await client.post(`/admin/requests/${id}/approve`);
      loadRequests();
      setSelected(null);
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const reject = async (id: string) => {
    const reason = prompt('دلیل رد:');
    if (!reason) return;
    try {
      await client.post(`/admin/requests/${id}/reject`, { reason });
      loadRequests();
      setSelected(null);
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const assign = async (id: string, mentorId: string) => {
    try {
      await client.post(`/admin/requests/${id}/assign`, { mentorId });
      loadRequests();
      setSelected(null);
      alert('منتور تخصیص یافت');
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const closeRequest = async (id: string, type: string) => {
    try {
      await client.post(`/admin/requests/${id}/close`, { type });
      loadRequests();
      setSelected(null);
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const confirmContribution = async (requestId: string) => {
    try {
      await client.post(`/admin/contribution/${requestId}/confirm`);
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'در انتظار بررسی',
    APPROVED: 'پذیرفته شده',
    ASSIGNED: 'در حال پیگیری',
    CLOSED_EXPIRED: 'بسته (زمان)',
    CLOSED_COMPLETED: 'تکمیل شده',
    CLOSED_INCOMPLETE: 'بسته (ناقص)',
    REJECTED: 'رد شده',
  };

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'bg-yellow-500/20 text-yellow-400',
    APPROVED: 'bg-blue-500/20 text-blue-400',
    ASSIGNED: 'bg-green-500/20 text-green-400',
    CLOSED_EXPIRED: 'bg-gray-500/20 text-gray-400',
    CLOSED_COMPLETED: 'bg-green-500/20 text-green-500',
    CLOSED_INCOMPLETE: 'bg-orange-500/20 text-orange-400',
    REJECTED: 'bg-red-500/20 text-red-400',
  };

  const filters = ['', 'PENDING_REVIEW', 'APPROVED', 'ASSIGNED', 'CLOSED_COMPLETED', 'CLOSED_INCOMPLETE'];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">درخواست‌ها</h1>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap ${filter === f ? 'bg-seraj-orange text-seraj-bg' : 'bg-seraj-card text-seraj-muted'}`}
            >
              {f ? statusLabels[f] : 'همه'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-seraj-muted">در حال بارگذاری...</p>
        ) : requests.length === 0 ? (
          <p className="text-seraj-muted">درخواستی یافت نشد</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <div
                key={req.id}
                className="bg-seraj-card rounded-2xl p-4 cursor-pointer hover:bg-white/5"
                onClick={() => setSelected(req)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{req.user?.firstName} {req.user?.lastName}</p>
                    <p className="text-sm text-seraj-muted truncate">{req.title || req.description?.slice(0, 60)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[req.status]}`}>
                        {statusLabels[req.status]}
                      </span>
                      {req.contribution && (
                        <span className={`text-xs ${req.contribution.status === 'CONFIRMED' ? 'text-green-400' : 'text-yellow-400'}`}>
                          مشارکت: {req.contribution.status === 'CONFIRMED' ? 'تأیید شده' : req.contribution.status === 'PENDING' ? 'در انتظار' : req.contribution.status === 'SUBMITTED' ? 'ارسال شده' : 'معاف'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
            <div className="bg-seraj-card rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold mb-2">{selected.user?.firstName} {selected.user?.lastName}</h3>
              <p className="text-xs text-seraj-muted mb-3" dir="ltr">{selected.user?.phone}</p>
              <div className="bg-seraj-bg rounded-xl p-3 mb-3">
                <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.user?.profile && (
                <div className="mb-3 text-sm">
                  <p className="text-seraj-muted">گروه: {selected.user.profile.serviceGroup || '-'}</p>
                  <p className="text-seraj-muted">احراز: {selected.user.profile.verification === 'VERIFIED' ? '✓ تأیید' : 'در انتظار'}</p>
                </div>
              )}

              {selected.contribution && (
                <div className="bg-seraj-bg rounded-xl p-3 mb-3">
                  <p className="text-sm">مبلغ: {selected.contribution.amount?.toLocaleString('fa-IR')} تومان</p>
                  <p className="text-sm text-seraj-muted">وضعیت: {selected.contribution.status}</p>
                  {selected.contribution.status !== 'CONFIRMED' && selected.contribution.status !== 'EXEMPT' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => confirmContribution(selected.id)} className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-sm">
                        تأیید رسید
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {selected.status === 'PENDING_REVIEW' && (
                  <div className="flex gap-2">
                    <button onClick={() => approve(selected.id)} className="flex-1 bg-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm font-bold">
                      پذیرش
                    </button>
                    <button onClick={() => reject(selected.id)} className="flex-1 bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-bold">
                      رد
                    </button>
                  </div>
                )}

                {selected.status === 'APPROVED' && (
                  <div>
                    <label className="text-sm text-seraj-muted mb-1 block">انتخاب منتور:</label>
                    <select
                      id="mentor-select"
                      className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text mb-2"
                      defaultValue=""
                    >
                      <option value="" disabled>انتخاب کنید</option>
                      {mentors.filter(m => m.mentorProfile?.activeCount < m.mentorProfile?.capacity).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName} ({m.mentorProfile?.activeCount}/{m.mentorProfile?.capacity})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        const select = document.getElementById('mentor-select') as HTMLSelectElement;
                        if (select.value) assign(selected.id, select.value);
                      }}
                      className="w-full bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold"
                    >
                      تخصیص منتور
                    </button>
                  </div>
                )}

                {selected.status === 'ASSIGNED' && (
                  <div className="flex gap-2">
                    <button onClick={() => closeRequest(selected.id, 'completed')} className="flex-1 bg-green-500/20 text-green-400 px-3 py-2 rounded-xl text-sm">
                      بستن (تکمیل)
                    </button>
                    <button onClick={() => closeRequest(selected.id, 'incomplete')} className="flex-1 bg-orange-500/20 text-orange-400 px-3 py-2 rounded-xl text-sm">
                      بستن (ناقص)
                    </button>
                  </div>
                )}

                {selected.assignment && (
                  <p className="text-xs text-seraj-muted mt-2">
                    منتور فعلی: {selected.assignment.mentor?.firstName} {selected.assignment.mentor?.lastName}
                  </p>
                )}
              </div>

              <button onClick={() => setSelected(null)} className="w-full text-seraj-muted text-sm mt-4">بستن</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
