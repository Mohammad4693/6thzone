import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import client from '../api/client';

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [expertise, setExpertise] = useState('');
  const [capacity, setCapacity] = useState(5);

  useEffect(() => {
    loadMentors();
    loadUsers();
  }, []);

  const loadMentors = async () => {
    try {
      const res = await client.get('/admin/users?role=MENTOR');
      setMentors(res.data);
    } catch {}
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const res = await client.get('/admin/users?role=MEMBER');
      setUsers(res.data);
    } catch {}
  };

  const createMentor = async () => {
    if (!selectedUser) return;
    try {
      await client.post('/admin/mentors', {
        userId: selectedUser,
        expertise: expertise.split('،').map((s: string) => s.trim()).filter(Boolean),
        capacity,
      });
      setShowAdd(false);
      setSelectedUser('');
      setExpertise('');
      loadMentors();
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error);
    }
  };

  const updateCapacity = async (userId: string, cap: number) => {
    try {
      await client.put(`/admin/mentors/${userId}`, { capacity: cap });
      loadMentors();
    } catch {}
  };

  const verifyService = async (userId: string, status: string) => {
    try {
      await client.post(`/admin/verify-service/${userId}`, { status });
      loadMentors();
    } catch {}
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">مدیریت منتورها</h1>
          <button onClick={() => setShowAdd(true)} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold">
            افزودن منتور
          </button>
        </div>

        {loading ? (
          <p className="text-seraj-muted">در حال بارگذاری...</p>
        ) : mentors.length === 0 ? (
          <p className="text-seraj-muted">منتوری ثبت نشده</p>
        ) : (
          <div className="space-y-3">
            {mentors.map((m: any) => (
              <div key={m.id} className="bg-seraj-card rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-seraj-muted" dir="ltr">{m.phone}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-seraj-orange">{m.mentorProfile?.activeCount} / {m.mentorProfile?.capacity}</p>
                    <p className="text-xs text-seraj-muted">پرونده فعال</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div>
                    <label className="text-xs text-seraj-muted">ظرفیت:</label>
                    <input
                      type="number"
                      defaultValue={m.mentorProfile?.capacity}
                      onBlur={e => updateCapacity(m.id, parseInt(e.target.value))}
                      className="w-20 bg-seraj-bg border border-white/10 rounded-lg px-2 py-1 text-sm text-seraj-text"
                    />
                  </div>
                  <div className="flex gap-1">
                    {m.mentorProfile?.expertise?.map((exp: string, i: number) => (
                      <span key={i} className="text-xs bg-white/5 px-2 py-1 rounded">{exp}</span>
                    ))}
                  </div>
                </div>
                {m.profile && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-seraj-muted">احراز خدمتگزاری:</span>
                    {m.profile.verification === 'VERIFIED' ? (
                      <span className="text-xs text-green-400">✓ تأیید شده</span>
                    ) : (
                      <button onClick={() => verifyService(m.id, 'VERIFIED')} className="text-xs text-yellow-400 underline">
                        تأیید
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add mentor modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowAdd(false)}>
            <div className="bg-seraj-card rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold mb-4">افزودن منتور جدید</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-seraj-muted mb-1 block">انتخاب کاربر</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text"
                  >
                    <option value="">انتخاب کنید</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} - {u.phone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-seraj-muted mb-1 block">حوزه‌های تخصصی (با ویرگول جدا کنید)</label>
                  <input
                    type="text"
                    value={expertise}
                    onChange={e => setExpertise(e.target.value)}
                    className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text"
                    placeholder="حقوقی، سلامت"
                  />
                </div>
                <div>
                  <label className="text-sm text-seraj-muted mb-1 block">ظرفیت</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={e => setCapacity(parseInt(e.target.value) || 5)}
                    className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text"
                  />
                </div>
                <button onClick={createMentor} className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold">
                  ایجاد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
