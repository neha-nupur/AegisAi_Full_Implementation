import { useState, type FormEvent } from 'react';
import { Loader2, ScanSearch, AlertCircle, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface Finding {
  type: string;
  location: { field: string; start: number; end: number };
  action: string;
  confidence: number;
}

interface ScanResult {
  detected: boolean;
  findingCount: number;
  findingTypes: string[];
  findings: Finding[];
  maskedText: string;
}

export function PrivacyScannerPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call the real Privacy Scanner Service endpoint
      const res = await api.post<ScanResult>('/privacy/scan', { text: input.trim() });
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Privacy scan failed. Please try again.');
      } else {
        setError('Privacy scan failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const actionBadgeClass = (action: string) => {
    if (action === 'BLOCK') return 'badge-danger';
    if (action === 'REQUIRE_APPROVAL') return 'badge-warning';
    if (action === 'MASK') return 'badge-info';
    return 'badge-secondary';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-heading">Privacy Scanner Sandbox</h1>
          <p className="page-subtitle">Test AegisAI's deterministic PII and secret detection capabilities</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)' }}>
          <ShieldAlert size={24} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>How it works:</strong> This sandbox calls the real AegisAI Privacy Scanner Service — the same engine used
            in the AI Request Gateway pipeline. Enter any text to detect sensitive entities (Emails, Phone Numbers, PAN,
            Aadhaar, API Keys, Passwords) and see the suggested action (MASK, BLOCK, REQUIRE_APPROVAL) plus the redacted output.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="scan-input" className="form-label">Text to scan</label>
            <textarea
              id="scan-input"
              className="form-input"
              rows={6}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="e.g. My email is john.doe@example.com, phone: 9876543210, PAN: ABCDE1234F"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            style={{ minWidth: 160 }}
          >
            {loading ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scanning…</>
            ) : (
              <><ScanSearch size={16} /> Run Scanner</>
            )}
          </button>
        </form>
      </div>

      {result && (
        <div className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Scan Results</h2>

          {!result.detected ? (
            <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} />
              <span>No sensitive information or PII detected in this input.</span>
            </div>
          ) : (
            <>
              <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldX size={18} />
                <span>
                  Detected <strong>{result.findingCount}</strong> sensitive finding{result.findingCount !== 1 ? 's' : ''}: {result.findingTypes.join(', ')}
                </span>
              </div>

              <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Suggested Action</th>
                      <th>Location (chars)</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.findings.map((f, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{f.type}</td>
                        <td>
                          <span className={`badge ${actionBadgeClass(f.action)}`}>
                            {f.action}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {f.location.start} – {f.location.end}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{Math.round(f.confidence * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div className="form-label" style={{ marginBottom: '0.5rem' }}>Masked Output</div>
                <pre className="code-block" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                  {result.maskedText}
                </pre>
              </div>
            </>
          )}

          <div>
            <div className="form-label" style={{ marginBottom: '0.5rem' }}>Raw JSON Response</div>
            <pre className="code-block" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
