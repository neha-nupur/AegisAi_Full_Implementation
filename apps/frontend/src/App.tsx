import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/shared';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { AiRequestsPage } from './pages/AiRequestsPage';
import { NewAiRequestPage } from './pages/NewAiRequestPage';
import { AiRequestDetailPage } from './pages/AiRequestDetailPage';
import { PrivacyScannerPage } from './pages/PrivacyScannerPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ModelsProvidersPage } from './pages/ModelsProvidersPage';
import { IdentityPage } from './pages/IdentityPage';
import { SecurityAuditPage } from './pages/SecurityAuditPage';
import { TracesPage, TraceDetailPage } from './pages/TracesPage';
import { LegacyPage } from './pages/LegacyPage';
import { SettingsPage } from './pages/SettingsPage';

import './index.css';

/**
 * Route wrapper that requires authentication.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingState /></div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            
            <Route path="/ai-requests" element={<ProtectedRoute><AiRequestsPage /></ProtectedRoute>} />
            <Route path="/ai-requests/new" element={<ProtectedRoute><NewAiRequestPage /></ProtectedRoute>} />
            <Route path="/ai-requests/:id" element={<ProtectedRoute><AiRequestDetailPage /></ProtectedRoute>} />
            
            <Route path="/privacy" element={<ProtectedRoute><PrivacyScannerPage /></ProtectedRoute>} />
            
            <Route path="/policies" element={<ProtectedRoute><PoliciesPage /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
            
            <Route path="/models" element={<ProtectedRoute><ModelsProvidersPage /></ProtectedRoute>} />
            <Route path="/providers" element={<ProtectedRoute><ModelsProvidersPage /></ProtectedRoute>} />
            
            <Route path="/users" element={<ProtectedRoute><IdentityPage /></ProtectedRoute>} />
            <Route path="/service-accounts" element={<ProtectedRoute><IdentityPage /></ProtectedRoute>} />
            
            <Route path="/security-events" element={<ProtectedRoute><SecurityAuditPage /></ProtectedRoute>} />
            <Route path="/audit-log" element={<ProtectedRoute><SecurityAuditPage /></ProtectedRoute>} />
            <Route path="/traces" element={<ProtectedRoute><TracesPage /></ProtectedRoute>} />
            <Route path="/traces/:id" element={<ProtectedRoute><TraceDetailPage /></ProtectedRoute>} />
            
            <Route path="/legacy" element={<ProtectedRoute><LegacyPage /></ProtectedRoute>} />
            
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
