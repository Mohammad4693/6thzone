import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = () => {
    if (!user) return [];
    if (user.role === 'MEMBER') return [
      { to: '/dashboard', label: 'درخواست‌ها' },
      { to: '/new-request', label: 'درخواست جدید' },
      { to: '/archive', label: 'آرشیو' },
      { to: '/profile', label: 'پروفایل' },
    ];
    if (user.role === 'MENTOR') return [
      { to: '/mentor', label: 'پرونده‌ها' },
      { to: '/profile', label: 'پروفایل' },
    ];
    if (user.role === 'ADMIN') return [
      { to: '/admin', label: 'داشبورد' },
      { to: '/admin/requests', label: 'درخواست‌ها' },
      { to: '/admin/mentors', label: 'منتورها' },
      { to: '/admin/reports', label: 'گزارش‌ها' },
      { to: '/admin/settings', label: 'تنظیمات' },
    ];
    return [];
  };

  const items = navItems();

  return (
    <div className="min-h-screen bg-seraj-bg text-seraj-text">
      {showNav && user && items.length > 0 && (
        <header className="sticky top-0 z-50 bg-seraj-bg/95 backdrop-blur border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <Link to="/" className="text-seraj-orange font-bold text-xl">سراج</Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {items.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="px-3 py-2 text-sm text-seraj-muted hover:text-seraj-text whitespace-nowrap rounded-lg hover:bg-white/5 transition"
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm text-seraj-muted hover:text-red-400 whitespace-nowrap rounded-lg hover:bg-white/5 transition"
              >
                خروج
              </button>
            </nav>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
