import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'MEMBER') navigate('/dashboard');
      else if (user.role === 'ADMIN') navigate('/admin');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }

  return (
    <div className="min-h-screen bg-seraj-bg flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full text-center">
        <div className="w-20 h-20 rounded-full bg-seraj-card border-2 border-seraj-orange flex items-center justify-center mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="1.5">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-seraj-orange mb-2">سراج</h1>
        <p className="text-seraj-muted mb-10 leading-relaxed">
          فانوس روشن در مسیر تاریک — کمک به روشن‌شدن نیاز شما
        </p>

        <div className="w-full flex flex-col gap-4">
          <Link
            to="/login"
            className="w-full py-4 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target text-center"
          >
            ورود ادمین (بازبین)
          </Link>
          <p className="text-seraj-muted text-sm leading-relaxed">
            اعضا با لینک ورود اختصاصی وارد می‌شوند. اگر لینک ندارید، از ادمین سراج بگیرید.
          </p>
        </div>
      </div>
    </div>
  );
}
