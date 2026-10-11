import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import VerifyPage from './pages/VerifyPage';
import MemberDashboard from './pages/MemberDashboard';
import NewRequestPage from './pages/NewRequestPage';
import ChatPage from './pages/ChatPage';
import ArchivePage from './pages/ArchivePage';
import ProfilePage from './pages/ProfilePage';
import MentorDashboard from './pages/MentorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminRequestsPage from './pages/AdminRequestsPage';
import AdminMentorsPage from './pages/AdminMentorsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminSessionsPage from './pages/AdminSessionsPage';
import MentorCasePage from './pages/MentorCasePage';
import BriefPage from './pages/BriefPage';
import './index.css';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-seraj-muted">در حال بارگذاری...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />

          {/* Member routes */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['MEMBER']}><MemberDashboard /></ProtectedRoute>} />
          <Route path="/new-request" element={<ProtectedRoute roles={['MEMBER']}><NewRequestPage /></ProtectedRoute>} />
          <Route path="/chat/:requestId" element={<ProtectedRoute roles={['MEMBER','MENTOR']}><ChatPage /></ProtectedRoute>} />
          <Route path="/archive" element={<ProtectedRoute roles={['MEMBER']}><ArchivePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/brief/:requestId" element={<ProtectedRoute><BriefPage /></ProtectedRoute>} />

          {/* Mentor routes */}
          <Route path="/mentor" element={<ProtectedRoute roles={['MENTOR']}><MentorDashboard /></ProtectedRoute>} />
          <Route path="/mentor/case/:requestId" element={<ProtectedRoute roles={['MENTOR']}><MentorCasePage /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/requests" element={<ProtectedRoute roles={['ADMIN']}><AdminRequestsPage /></ProtectedRoute>} />
          <Route path="/admin/mentors" element={<ProtectedRoute roles={['ADMIN']}><AdminMentorsPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['ADMIN']}><AdminSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/sessions" element={<ProtectedRoute roles={['ADMIN']}><AdminSessionsPage /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['ADMIN']}><AdminReportsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
