import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('ORGANIZATION_ADMIN');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; traceId?: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError({ message: 'Email and password are required.' });
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        if (password !== confirmPassword) {
          setError({ message: 'Passwords do not match.' });
          setLoading(false);
          return;
        }
        const message = await signup(email.trim(), password, role);
        setError({ message: message }); // Hack: Using error state to show success message
        return; // Don't redirect, wait for user to verify email
      } else {
        await login(email.trim(), password);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, traceId: err.traceId });
      } else if (err instanceof Error) {
        setError({ message: err.message });
      } else {
        setError({ message: 'An unexpected error occurred.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Shield size={22} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Aegis<span style={{ color: 'var(--brand-primary)' }}>AI</span>
          </span>
        </div>

        <p className="login-title" style={{ fontSize: '1.125rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.25rem' }}>
          Sign in to your workspace
        </p>
        <p className="login-subtitle">
          Enterprise AI Security &amp; Governance Control Plane
        </p>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>
              <div>{error.message}</div>
              {error.traceId && (
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.7 }}>
                  Trace: {error.traceId}
                </div>
              )}
            </div>
          </div>
        )}

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
              aria-required="true"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
                aria-required="true"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {!isSignup && (
              <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                <a
                  href="/forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/forgot-password');
                  }}
                  style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 500 }}
                >
                  Forgot Password?
                </a>
              </div>
            )}
          </div>

          {isSignup && (
            <>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
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
                    aria-required="true"
                    style={{ paddingRight: '2.75rem' }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="role" className="form-label">Role</label>
                <select
                  id="role"
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                >
                  <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="SECURITY_AUDITOR">Security Auditor</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ marginTop: '0.5rem', height: '42px' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {isSignup ? 'Signing up…' : 'Signing in…'}</>
            ) : (
              isSignup ? 'Sign up' : 'Sign in'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          {isSignup ? (
            <>Already have an account? <button onClick={() => setIsSignup(false)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign in</button></>
          ) : (
            <>New visitor? <button onClick={() => setIsSignup(true)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign Up</button></>
          )}
        </p>

        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span style={{ fontSize: '1.1em' }}>&larr;</span> Back to Home
          </a>
        </p>

        {!isSignup && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
            Access is controlled by your organization administrator.
          </p>
        )}
      </div>
    </div>
  );
}
