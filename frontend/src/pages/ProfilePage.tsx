import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [serviceGroup, setServiceGroup] = useState('');
  const [activityDesc, setActivityDesc] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setServiceGroup(user.profile.serviceGroup || '');
      setActivityDesc(user.profile.activityDesc || '');
    }
  }, [user]);

  const handleSave = async () => {
    try {
      // Update profile via admin API? No, members should update their own profile.
      // We need a profile update endpoint. For now, use the profile route.
      await client.put('/profile', { serviceGroup, activityDesc });
      setSaved(true);
      refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">پروفایل</h1>
        <div className="bg-seraj-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-seraj-muted mb-1 block">نام</label>
            <p className="text-seraj-text">{user?.firstName} {user?.lastName}</p>
          </div>
          <div>
            <label className="text-sm text-seraj-muted mb-1 block">شماره موبایل</label>
            <p className="text-seraj-text" dir="ltr">{user?.phone}</p>
          </div>
          <div>
            <label className="text-sm text-seraj-muted mb-1 block">نقش</label>
            <p className="text-seraj-text">{user?.role === 'MEMBER' ? 'عضو' : user?.role === 'MENTOR' ? 'منتور' : 'ادمین'}</p>
          </div>

          {user?.role === 'MEMBER' && (
            <>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">گروه خدمتگزاری</label>
                <input
                  type="text"
                  value={serviceGroup}
                  onChange={e => setServiceGroup(e.target.value)}
                  className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">شرح کوتاه فعالیت</label>
                <textarea
                  value={activityDesc}
                  onChange={e => setActivityDesc(e.target.value)}
                  className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">وضعیت احراز</label>
                <p className={`text-sm ${user?.profile?.verification === 'VERIFIED' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {user?.profile?.verification === 'VERIFIED' ? 'تأیید شده' : 'در انتظار تأیید'}
                </p>
              </div>
              <button
                onClick={handleSave}
                className="bg-seraj-orange text-seraj-bg rounded-xl py-3 px-6 font-bold touch-target"
              >
                {saved ? '✓ ذخیره شد' : 'ذخیره'}
              </button>
            </>
          )}

          {user?.role === 'MENTOR' && user?.mentorProfile && (
            <>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">حوزه‌های تخصصی</label>
                <p className="text-seraj-text">{user.mentorProfile.expertise?.join('، ') || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-seraj-muted mb-1 block">ظرفیت</label>
                <p className="text-seraj-text">{user.mentorProfile.activeCount} / {user.mentorProfile.capacity} پرونده فعال</p>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
