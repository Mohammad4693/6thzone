import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [brandImage, setBrandImage] = useState('');
  const [consentText, setConsentText] = useState('');

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'MEMBER') navigate('/dashboard');
      else if (user.role === 'MENTOR') navigate('/mentor');
      else if (user.role === 'ADMIN') navigate('/admin');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    client.get('/settings').then(res => {
      setBrandImage(res.data.brandImage || '');
      setConsentText(res.data.consentText || '');
    }).catch(() => {});
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  }

  return (
    <div className="min-h-screen bg-seraj-bg flex flex-col">
      {/* Hero image */}
      {brandImage ? (
        <div className="relative h-48 sm:h-64 overflow-hidden">
          <img src={brandImage} alt="سراج" className="w-full h-full object-cover hero-image" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h1 className="text-3xl font-bold text-seraj-orange">سراج</h1>
          </div>
        </div>
      ) : (
        <div className="relative h-48 sm:h-64 bg-gradient-to-b from-gray-800 to-seraj-bg flex items-end overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="1">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            </svg>
          </div>
          <div className="relative p-6 w-full">
            <h1 className="text-3xl font-bold text-seraj-orange">سراج</h1>
            <p className="text-seraj-muted text-sm mt-1">فانوس روشن در مسیر تاریک</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-3">چه نیازی ذهنت را مشغول کرده؟</h2>
        <p className="text-seraj-muted text-center mb-8 leading-relaxed">
          با یک پیام صوتی شروع کن. منتور کمک می‌کند نیازت را روشن‌تر ببینی.
        </p>

        {/* Large oval mic button */}
        <Link to="/register" className="mb-4">
          <div className="w-28 h-28 rounded-full bg-seraj-card border-2 border-seraj-orange flex items-center justify-center hover:bg-seraj-orange/10 transition cursor-pointer touch-target">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
        </Link>

        <p className="text-seraj-muted text-sm mb-1">برای شروع ضبط، لمس کن</p>
        <p className="text-seraj-muted text-xs mb-6">قبل از ارسال، گوش بده و تأیید کن</p>

        <Link to="/register" className="text-seraj-orange text-sm underline mb-8">
          ترجیح می‌دهم بنویسم
        </Link>

        <p className="text-seraj-muted text-xs text-center leading-relaxed max-w-sm">
          پس از پذیرش درخواست، منتور همراهت معرفی می‌شود.
        </p>

        <div className="mt-8 flex gap-4">
          <Link to="/register" className="px-6 py-3 bg-seraj-orange text-seraj-bg rounded-xl font-bold touch-target text-center">
            ثبت‌نام / ورود
          </Link>
        </div>

        {consentText && (
          <details className="mt-6 text-xs text-seraj-muted max-w-sm">
            <summary className="cursor-pointer hover:text-seraj-text">متن رضایت آگاهانه</summary>
            <p className="mt-2 leading-relaxed">{consentText}</p>
          </details>
        )}
      </div>
    </div>
  );
}
