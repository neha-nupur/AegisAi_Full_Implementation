import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card animate-fade-in" style={{ textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Invalid Request</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            No reset token was provided. Please use the link sent to your email.
          </p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to reset password. The link may have expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="login-logo" style={{ justifyContent: 'center' }}>
          <div className="login-logo-icon">
            <Shield size={22} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Aegis<span style={{ color: 'var(--brand-primary)' }}>AI</span>
          </span>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, textAlign: 'center', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          Choose a new password
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Must be at least 8 characters long.
        </p>

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
              Your password has been successfully reset!
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary w-full"
            >
              Sign In with New Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="password" className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                  }}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                  style={{ paddingRight: '2.75rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ marginTop: '1.5rem', height: '42px' }}
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Resetting...</>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
