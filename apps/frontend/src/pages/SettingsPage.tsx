import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, Save, Settings2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/shared';

interface OrganizationSettings {
  defaultModelPreference: string;
  defaultPolicyName: string | null;
  sessionTimeoutMinutes: number;
  requireApprovalForSensitive: boolean;
  privacyScanningEnabled: boolean;
  autoMaskingEnabled: boolean;
  requestTimeoutMs: number;
  maxInputLength: number;
  requestsPerMinute: number;
  auditLoggingEnabled: boolean;
}

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<OrganizationSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ data: OrganizationSettings }>('/settings');
      setSettings(res.data);
      setFormData(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load organization settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Filter out unchanged fields to send a true PATCH
    const patch: Partial<OrganizationSettings> = {};
    for (const key in formData) {
      const k = key as keyof OrganizationSettings;
      if (formData[k] !== settings?.[k]) {
        // We know they match the type dynamically
        (patch as any)[k] = formData[k];
      }
    }

    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      return;
    }

    try {
      const res = await api.patch<{ data: OrganizationSettings }>('/settings', patch);
      setSettings(res.data);
      setFormData(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update organization settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading settings..." />;
  }

  if (error && !settings) {
    return (
      <div className="alert alert-error">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  const isAdmin = user?.role === 'ORGANIZATION_ADMIN';

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-heading">Organization Settings</h1>
          <p className="page-subtitle">Configure operational defaults, security policies, and privacy constraints.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
          <Settings2 size={24} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Configuration:</strong> These settings apply to all API requests and user sessions across the organization.
            {!isAdmin && (
              <div style={{ marginTop: '0.5rem', color: 'var(--color-warning)' }}>
                You have read-only access. Only an Organization Administrator can modify these settings.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} />
            <span>Settings successfully updated. Audit event recorded.</span>
          </div>
        )}

        {formData && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Account Security Settings */}
            <section>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Account Security</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '400px' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Change your password. You will be required to sign in again after changing your password.
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-input"
                    id="currentPassword"
                    disabled={saving}
                    placeholder="••••••••"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    id="newPassword"
                    disabled={saving}
                    placeholder="••••••••"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    id="confirmNewPassword"
                    disabled={saving}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={async () => {
                      const current = (document.getElementById('currentPassword') as HTMLInputElement).value;
                      const newPass = (document.getElementById('newPassword') as HTMLInputElement).value;
                      const confirm = (document.getElementById('confirmNewPassword') as HTMLInputElement).value;

                      if (!current || !newPass || !confirm) {
                        alert('Please fill in all password fields.');
                        return;
                      }
                      if (newPass !== confirm) {
                        alert('New passwords do not match.');
                        return;
                      }

                      try {
                        const { api } = await import('../lib/api');
                        await api.post('/auth/change-password', {
                          currentPassword: current,
                          newPassword: newPass
                        });
                        alert('Password changed successfully. Please sign in again.');
                        window.location.href = '/login';
                      } catch (err: any) {
                        alert(err.message || 'Failed to change password.');
                      }
                    }}
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </section>

            {/* General Settings */}
            <section>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>General</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Default Model Preference</label>
                  <select 
                    className="form-input" 
                    value={formData.defaultModelPreference}
                    onChange={e => setFormData({ ...formData, defaultModelPreference: e.target.value })}
                    disabled={!isAdmin || saving}
                  >
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gpt-4o">GPT-4o</option>
                  </select>
                  <div className="form-hint">Used if no modelPreference is specified in API requests.</div>
                </div>
              </div>
            </section>

            {/* Privacy & Security Settings */}
            <section>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Privacy & Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.privacyScanningEnabled}
                    onChange={e => setFormData({ ...formData, privacyScanningEnabled: e.target.checked })}
                    disabled={!isAdmin || saving}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>Enable Privacy Scanning</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan all incoming AI requests for PII and secrets before routing to providers.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.autoMaskingEnabled}
                    onChange={e => setFormData({ ...formData, autoMaskingEnabled: e.target.checked })}
                    disabled={!isAdmin || saving}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>Enable Auto-Masking</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically redact detected sensitive entities before forwarding. If disabled, requests containing BLOCK/REQUIRE_APPROVAL findings will fail instead.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.requireApprovalForSensitive}
                    onChange={e => setFormData({ ...formData, requireApprovalForSensitive: e.target.checked })}
                    disabled={!isAdmin || saving}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>Require Approval for Sensitive Requests</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Intercept requests flagged with REQUIRE_APPROVAL instead of outright blocking them.</div>
                  </div>
                </label>
              </div>
            </section>

            {/* Gateway Limits */}
            <section>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Gateway Limits</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Global Request Timeout (ms)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.requestTimeoutMs}
                    onChange={e => setFormData({ ...formData, requestTimeoutMs: parseInt(e.target.value) || 30000 })}
                    disabled={!isAdmin || saving}
                    min={1000}
                    max={120000}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Input Length (chars)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.maxInputLength}
                    onChange={e => setFormData({ ...formData, maxInputLength: parseInt(e.target.value) || 8000 })}
                    disabled={!isAdmin || saving}
                    min={100}
                    max={100000}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate Limit (requests per minute)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.requestsPerMinute}
                    onChange={e => setFormData({ ...formData, requestsPerMinute: parseInt(e.target.value) || 100 })}
                    disabled={!isAdmin || saving}
                    min={1}
                    max={10000}
                  />
                </div>
              </div>
            </section>

            {/* Audit */}
            <section>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Audit & Observability</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.auditLoggingEnabled}
                    onChange={e => setFormData({ ...formData, auditLoggingEnabled: e.target.checked })}
                    disabled={!isAdmin || saving}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>Enable Comprehensive Audit Logging</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Record all settings changes, policy updates, and security events. Note: PII is never stored in audit logs regardless of this setting.</div>
                  </div>
                </label>
              </div>
            </section>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ minWidth: 140 }}
                >
                  {saving ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                  ) : (
                    <><Save size={16} /> Save Settings</>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
