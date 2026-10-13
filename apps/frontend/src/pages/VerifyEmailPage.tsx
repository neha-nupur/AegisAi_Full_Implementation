import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setSuccess(true);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to verify email. The link may be expired or invalid.');
        }
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="login-logo" style={{ justifyContent: 'center' }}>
          <div className="login-logo-icon">
            <Shield size={22} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Aegis<span style={{ color: 'var(--brand-primary)' }}>AI</span>
          </span>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '1rem' }}>
          Email Verification
        </h2>

        {loading ? (
          <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
            <p>Verifying your email address...</p>
          </div>
        ) : success ? (
          <div style={{ padding: '2rem 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Your email has been successfully verified! You can now sign in to your account.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <div style={{ padding: '2rem 0' }}>
            <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem', fontWeight: 500 }}>
              Verification Failed
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
