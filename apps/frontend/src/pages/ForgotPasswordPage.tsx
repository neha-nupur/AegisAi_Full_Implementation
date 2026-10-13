import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
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
          Reset your password
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Enter your email address and we'll send you a link to reset your password.
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
              If an account exists for <strong>{email}</strong>, you will receive a password reset email shortly.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary w-full"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                autoFocus
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ marginTop: '1rem', height: '42px' }}
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : (
                'Send Reset Link'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500
                }}
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
