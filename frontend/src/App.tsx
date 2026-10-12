import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEffect, useState } from 'react';
import client from './api/client';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MemberLoginPage from './pages/MemberLoginPage';
import MemberDashboard from './pages/MemberDashboard';
import NewRequestPage from './pages/NewRequestPage';
import MemberCasePage from './pages/MemberCasePage';
import BriefPage from './pages/BriefPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminCasePage from './pages/AdminCasePage';
import AdminStatsPage from './pages/AdminStatsPage';
import './index.css';

// Legacy v3 pages (RegisterPage, VerifyPage, Mentor*, ChatPage, AdminSessions…)
// stay in the codebase but are no longer routed — v4 runs behind feature flags.

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function WakeOverlay() {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const id = 'seraj-wake';
    const handler = (on: boolean) => {
      setWaking(on);
      const el = document.getElementById(id);
      if (el) el.style.display = on ? 'flex' : 'none';
    };
    import('./api/client').then(({ setWakeListener }) => setWakeListener(handler));
    return () => {
      import('./api/client').then(({ setWakeListener }) => setWakeListener(null));
    };
  }, []);
  if (!waking) return null;
  return (
    <div
      id="seraj-wake"
      className="fixed inset-0 z-50 bg-seraj-bg/95 flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="w-10 h-10 border-2 border-seraj-orange border-t-transparent rounded-full animate-spin" />
      <p className="text-lg font-bold">سامانه در حال آماده‌سازی است</p>
      <p className="text-seraj-muted text-sm">چند لحظه صبر کنید — به‌صورت خودکار دوباره تلاش می‌کنیم.</p>
    </div>
  );
}

function FlagsGate({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<any>(null);
  useEffect(() => {
    client.get('/flags').then((r) => setFlags(r.data)).catch(() => setFlags({}));
    (window as any).__serajFlags = flags;
  }, [flags]);
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WakeOverlay />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/m/:token" element={<MemberLoginPage />} />

          {/* Member routes */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['MEMBER']}><MemberDashboard /></ProtectedRoute>} />
          <Route path="/new-request" element={<ProtectedRoute roles={['MEMBER']}><NewRequestPage /></ProtectedRoute>} />
          <Route path="/case/:requestId" element={<ProtectedRoute roles={['MEMBER']}><MemberCasePage /></ProtectedRoute>} />
          <Route path="/brief/:requestId" element={<ProtectedRoute roles={['MEMBER', 'ADMIN']}><BriefPage /></ProtectedRoute>} />

          {/* Admin (reviewer) routes */}
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/case/:requestId" element={<ProtectedRoute roles={['ADMIN']}><AdminCasePage /></ProtectedRoute>} />
          <Route path="/admin/stats" element={<ProtectedRoute roles={['ADMIN']}><AdminStatsPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
