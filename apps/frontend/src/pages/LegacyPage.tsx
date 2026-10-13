import { useState, type FormEvent } from 'react';
import { Plug, Loader2, AlertCircle, CheckCircle2, UserX } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface LegacyEmployee {
  employeeId: string;
  exists: boolean;
  fullName: string | null;
  department: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND';
}

interface LegacyResponse {
  data: LegacyEmployee;
  traceId: string;
}

export function LegacyPage() {
  const [empId, setEmpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LegacyEmployee | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = empId.trim().split(' ')[0];
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setTraceId(null);

    try {
      // Calls GET /v1/legacy-employees/:employeeId
      // Backend makes a real SOAP call to the soap-mock server via the
      // LegacyEmployeeClient (cockatiel timeout/retry/circuit-breaker),
      // which reads the WSDL and invokes CheckLegacyEmployee.
      const res = await api.get<LegacyResponse>(`/legacy-employees/${trimmed}`);
      setResult(res.data);
      setTraceId(res.traceId ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError(`Employee "${trimmed}" not found in legacy system.`);
        else if (err.status === 504) setError('The legacy system did not respond in time. Please try again.');
        else if (err.status === 503) setError('The legacy SOAP service is temporarily unavailable.');
        else setError(err.message || 'Failed to query legacy SOAP service.');
      } else {
        setError('Failed to query legacy SOAP service. Is the soap-mock running?');
      }
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status?: string) => {
    if (status === 'ACTIVE') return 'var(--color-success, #22c55e)';
    if (status === 'INACTIVE') return 'var(--color-warning, #f59e0b)';
    return 'var(--text-muted)';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-heading">Legacy Integrations</h1>
          <p className="page-subtitle">Interact with bridged legacy systems via the AegisAI Control Plane</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)' }}>
          <Plug size={24} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>SOAP Bridge:</strong> Demonstrates a real WSDL-backed SOAP call through the AegisAI Control Plane.
            React → REST API → Identity Service → <code>LegacyEmployeeClient</code> → WSDL → <code>CheckLegacyEmployee</code> SOAP operation → soap-mock → response.
            <br />
            <span style={{ marginTop: '0.25rem', display: 'block' }}>
              Try: <code>E1001</code> (Priya Sharma, Finance) · <code>E1002</code> (Rahul Verma, Engineering) · <code>E1003</code> (Anjali Mehta, Sales, INACTIVE) · any other ID (NOT_FOUND)
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="empId" className="form-label">Employee ID</label>
            <input
              id="empId"
              type="text"
              className="form-input"
              value={empId}
              onChange={e => setEmpId(e.target.value)}
              placeholder="e.g. E1001, E1002, E1003"
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
            disabled={loading || !empId.trim()}
          >
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Querying SOAP…</>
              : 'Query Legacy System'
            }
          </button>
        </form>
      </div>

      {result && (
        <div className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>SOAP Response</h2>

          {!result.exists ? (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserX size={18} />
              <span>Employee <strong>{result.employeeId}</strong> was not found in the legacy HR directory.</span>
            </div>
          ) : (
            <>
              <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <CheckCircle2 size={18} />
                <span>Employee found via <strong>CheckLegacyEmployee</strong> SOAP operation.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Employee ID</div>
                  <div style={{ fontWeight: 500 }}><code>{result.employeeId}</code></div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Full Name</div>
                  <div style={{ fontWeight: 500 }}>{result.fullName ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Department</div>
                  <div style={{ fontWeight: 500 }}>{result.department ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                  <div style={{ fontWeight: 600, color: statusColor(result.status) }}>{result.status}</div>
                </div>
              </div>
            </>
          )}

          {traceId && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              Correlation ID: <code>{traceId}</code>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <div className="form-label" style={{ marginBottom: '0.5rem' }}>Raw SOAP Response (JSON)</div>
            <pre className="code-block" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
