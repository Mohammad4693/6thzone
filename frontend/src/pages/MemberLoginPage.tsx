import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

// Member personal login link: /m/<token> — exchanges the one-time token for
// a 30-day session. Revoked/used/expired tokens show a clear error.
export default function MemberLoginPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await client.post('/auth/link-login', { token });
        if (cancelled) return;
        login(res.data.token, res.data.user);
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'این لینک ورود معتبر نیست');
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-seraj-bg flex flex-col items-center justify-center px-6 text-center">
      {busy ? (
        <>
          <div className="w-10 h-10 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-seraj-muted">در حال ورود...</p>
        </>
      ) : (
        <>
          <p className="text-red-400 mb-4 leading-relaxed">{error}</p>
          <a href="/" className="text-seraj-orange underline touch-target">صفحه اصلی</a>
        </>
      )}
    </div>
  );
}
