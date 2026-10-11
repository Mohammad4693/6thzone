import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [devCode, setDevCode] = useState('');
  const [smsNote, setSmsNote] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const p = sessionStorage.getItem('seraj_pending_phone');
    if (!p) {
      navigate('/register');
      return;
    }
    setPhone(p);
    // Try to get the dev code that was returned during registration
    // It's stored in session by register page if we passed it
    const dc = sessionStorage.getItem('seraj_dev_code');
    if (dc) {
      setDevCode(dc);
      setSmsNote('اتصال پیامک تکمیل نشده. کد توسعه نمایش داده شده است.');
    }
  }, [navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/verify', { phone, code });
      login(res.data.token, res.data.user);
      sessionStorage.removeItem('seraj_pending_phone');
      sessionStorage.removeItem('seraj_pending_userId');
      sessionStorage.removeItem('seraj_dev_code');
      const role = res.data.user.role;
      if (role === 'MEMBER') navigate('/dashboard');
      else if (role === 'MENTOR') navigate('/mentor');
      else if (role === 'ADMIN') navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'کد نادرست');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError('');
    try {
      const res = await client.post('/auth/send-code', { phone });
      if (res.data.devCode) {
        setDevCode(res.data.devCode);
        setSmsNote('اتصال پیامک تکمیل نشده. کد توسعه نمایش داده شده است.');
      }
      setResendTimer(120);
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ارسال مجدد');
    }
  };

  return (
    <div className="min-h-screen bg-seraj-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-seraj-orange font-bold text-2xl text-center mb-8">سراج</h1>
        <div className="bg-seraj-card rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-2">تأیید شماره موبایل</h2>
          <p className="text-seraj-muted text-sm mb-4" dir="ltr">{phone}</p>

          {smsNote && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
              <p className="text-yellow-400 text-xs">{smsNote}</p>
            </div>
          )}

          {devCode && (
            <div className="bg-seraj-bg border border-white/10 rounded-xl p-3 mb-4 text-center">
              <p className="text-seraj-muted text-xs mb-1">کد توسعه (آزمایشی):</p>
              <p className="text-seraj-orange text-2xl font-bold tracking-widest" dir="ltr">{devCode}</p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-sm text-seraj-muted mb-1 block">کد تأیید</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text text-center text-2xl tracking-widest focus:border-seraj-orange focus:outline-none"
                placeholder="------"
                required
                dir="ltr"
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold disabled:opacity-50 touch-target"
            >
              {loading ? 'در حال بررسی...' : 'تأیید و ورود'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="w-full text-seraj-muted text-sm mt-4 hover:text-seraj-text disabled:opacity-50"
          >
            {resendTimer > 0 ? `ارسال مجدد (${resendTimer}s)` : 'ارسال مجدد کد'}
          </button>
        </div>
      </div>
    </div>
  );
}
