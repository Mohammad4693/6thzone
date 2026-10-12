import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await client.post('/auth/admin-login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'ورود ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-seraj-orange mb-1 text-center">ورود ادمین</h1>
        <p className="text-seraj-muted text-sm text-center mb-8">بازبین سراج</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ایمیل"
            className="w-full px-4 py-3 bg-seraj-card border border-gray-700 rounded-xl text-seraj-text touch-target"
            autoComplete="username"
          />
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز"
            className="w-full px-4 py-3 bg-seraj-card border border-gray-700 rounded-xl text-seraj-text touch-target"
            autoComplete="current-password"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target disabled:opacity-50"
          >
            {busy ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        <Link to="/" className="block text-center text-seraj-muted text-sm underline mt-6 touch-target">
          بازگشت
        </Link>
      </div>
    </div>
  );
}
