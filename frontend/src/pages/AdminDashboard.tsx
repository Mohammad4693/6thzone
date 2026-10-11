import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import client from '../api/client';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/admin/dashboard').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;

  const cards = [
    { label: 'درخواست‌های جدید', value: data?.pendingRequests, color: 'text-yellow-400', link: '/admin/requests' },
    { label: 'پذیرفته شده', value: data?.approvedRequests, color: 'text-blue-400', link: '/admin/requests' },
    { label: 'در حال پیگیری', value: data?.activeRequests, color: 'text-green-400', link: '/admin/requests' },
    { label: 'بدون منتور', value: data?.unassigned, color: 'text-orange-400', link: '/admin/requests' },
    { label: 'نزدیک پایان', value: data?.nearExpiry, color: 'text-red-400', link: '/admin/requests' },
    { label: 'تکمیل شده', value: data?.closedCompleted, color: 'text-green-500', link: '/admin/reports' },
    { label: 'ناقص', value: data?.closedIncomplete, color: 'text-orange-400', link: '/admin/reports' },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">داشبورد مدیریت</h1>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {cards.map((card, i) => (
            <Link key={i} to={card.link} className="bg-seraj-card rounded-2xl p-4 hover:bg-white/5 transition">
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-seraj-muted mt-1">{card.label}</p>
            </Link>
          ))}
        </div>

        {/* Pilot metrics */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <h3 className="font-bold mb-3">معیارهای پایلوت</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-seraj-muted">ظرفیت (۵۰ نفر)</span>
              <span>{data?.pilotMetrics?.dataAvailable ? 'فعال' : 'داده کافی نیست'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-seraj-muted">رضایت (هدف: بالای ۷۰٪)</span>
              <span>{data?.pilotMetrics?.dataAvailable ? `${data.pilotMetrics.satisfactionRate}٪` : 'داده کافی نیست'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-seraj-muted">تعداد پاسخ‌دهندگان</span>
              <span>{data?.pilotMetrics?.totalFeedback || ۰}</span>
            </div>
          </div>
        </div>

        {/* Mentors */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">منتورهای فعال</h3>
            <Link to="/admin/mentors" className="text-seraj-orange text-sm">مدیریت</Link>
          </div>
          {data?.mentors?.length === 0 ? (
            <p className="text-seraj-muted text-sm">منتوری ثبت نشده</p>
          ) : (
            <div className="space-y-2">
              {data?.mentors?.map((m: any) => (
                <div key={m.id} className="flex justify-between text-sm">
                  <span>{m.user.firstName} {m.user.lastName}</span>
                  <span className="text-seraj-muted">{m.activeCount} / {m.capacity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-6">
          <h3 className="font-bold mb-3">جلسه‌ها</h3>
          {data?.sessions?.length === 0 ? (
            <p className="text-seraj-muted text-sm">جلسه‌ای در انتظار نیست</p>
          ) : (
            <div className="space-y-2">
              {data?.sessions?.map((s: any) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>{s.request.user.firstName} {s.request.user.lastName}</span>
                  <span className={s.status === 'REQUESTED' ? 'text-yellow-400' : 'text-blue-400'}>
                    {s.status === 'REQUESTED' ? 'درخواست شده' : 'برنامه‌ریزی شده'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/admin/requests" className="bg-seraj-card rounded-2xl p-4 text-center hover:bg-white/5">
            <p className="font-bold text-sm">صف درخواست‌ها</p>
          </Link>
          <Link to="/admin/mentors" className="bg-seraj-card rounded-2xl p-4 text-center hover:bg-white/5">
            <p className="font-bold text-sm">مدیریت منتورها</p>
          </Link>
          <Link to="/admin/reports" className="bg-seraj-card rounded-2xl p-4 text-center hover:bg-white/5">
            <p className="font-bold text-sm">گزارش‌ها</p>
          </Link>
          <Link to="/admin/settings" className="bg-seraj-card rounded-2xl p-4 text-center hover:bg-white/5">
            <p className="font-bold text-sm">تنظیمات</p>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
