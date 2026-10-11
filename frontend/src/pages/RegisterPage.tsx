import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/register', { firstName, lastName, phone });
      // Store phone and userId for verification
      sessionStorage.setItem('seraj_pending_phone', res.data.phone || phone);
      sessionStorage.setItem('seraj_pending_userId', res.data.userId);
      navigate('/verify');
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Already registered — go to verify for login
        sessionStorage.setItem('seraj_pending_phone', phone);
        try {
          const res = await client.post('/auth/send-code', { phone });
          sessionStorage.setItem('seraj_pending_userId', res.data.userId);
          navigate('/verify');
        } catch (e2: any) {
          setError(e2.response?.data?.error || 'خطا در ارسال کد');
        }
      } else {
        setError(err.response?.data?.error || 'خطا در ثبت‌نام');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-seraj-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-seraj-orange font-bold text-2xl block text-center mb-8">سراج</Link>
        <div className="bg-seraj-card rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">ثبت‌نام / ورود</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-seraj-muted mb-1 block">نام</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
                placeholder="نام"
                required
              />
            </div>
            <div>
              <label className="text-sm text-seraj-muted mb-1 block">نام خانوادگی</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
                placeholder="نام خانوادگی"
                required
              />
            </div>
            <div>
              <label className="text-sm text-seraj-muted mb-1 block">شماره موبایل</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
                placeholder="09xxxxxxxxx"
                required
                dir="ltr"
              />
              <p className="text-xs text-seraj-muted mt-1">فرمت: 09xxxxxxxxx (ایران)</p>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold disabled:opacity-50 touch-target"
            >
              {loading ? 'در حال ارسال...' : 'ارسال کد تأیید'}
            </button>
          </form>
          <p className="text-xs text-seraj-muted mt-4 text-center">
            کد یک‌بارمصرف به شماره شما ارسال می‌شود.
          </p>
        </div>
      </div>
    </div>
  );
}
