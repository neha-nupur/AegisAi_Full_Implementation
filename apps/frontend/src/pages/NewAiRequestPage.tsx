import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { StatusBadge } from '../components/shared';

interface ModelOption {
  id: string;
  name: string;
  active: boolean;
  capabilities: string[];
  configuration?: Record<string, any>;
  providerId?: string;
}

interface AiRequestResult {
  id: string;
  status: string;
  model?: string;
  provider?: string;
  traceId: string;
  policyId?: string;
  output?: string;
  policyDecision?: string;
  privacyResult?: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  approvalId?: string;
}

export function NewAiRequestPage() {
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [modelPreference, setModelPreference] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiRequestResult | null>(null);
  const [error, setError] = useState<{ message: string; code?: string; traceId?: string } | null>(null);

  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ items: ModelOption[] }>('/model-provider/models');
        const models = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setAvailableModels(models.filter(m => m.active));
      } catch {
        // silently fail — user can still type manually
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const generateIdempotencyKey = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!input.trim()) {
      setError({ message: 'Input is required.' });
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const payload: Record<string, unknown> = { input: input.trim() };
      if (modelPreference.trim()) payload.modelPreference = modelPreference.trim();
      if (policyId.trim()) payload.policyId = policyId.trim();

      const req = await api.post<AiRequestResult>('/ai-requests', payload, {
        'Idempotency-Key': idempotencyKey,
      });
      setResult(req);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, code: err.code, traceId: err.traceId });
      } else if (err instanceof Error) {
        setError({ message: err.message });
      } else {
        setError({ message: 'An unexpected error occurred' });
      }
    } finally {
      setLoading(false);
    }
  };

  const getResultStyle = (status: string) => {
    if (['COMPLETED', 'APPROVED'].includes(status)) return 'alert-success';
    if (['FAILED', 'BLOCKED', 'REJECTED'].includes(status)) return 'alert-error';
    if (['APPROVAL_REQUIRED'].includes(status)) return 'alert-warning';
    return 'alert-info';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn-icon" onClick={() => navigate('/ai-requests')} aria-label="Back to AI Requests">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-heading">New AI Request</h1>
          <p className="page-subtitle">Submit a request through the AegisAI gateway pipeline</p>
        </div>
      </div>

      {/* Pipeline explanation */}
      <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {['Auth', 'Validate', 'Privacy Scan', 'Policy Eval', 'Model Route', 'Provider Call', 'Audit'].map((step, i, arr) => (
            <span key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{step}</span>
              {i < arr.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="ai-input" className="form-label">
              Input <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <textarea
              id="ai-input"
              className="form-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter your AI prompt or message…"
              rows={6}
              disabled={loading}
              required
              aria-required="true"
            />
            <p className="form-hint">
              Your input will be scanned for PII/secrets and evaluated against organizational policies before being sent to the AI provider.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="model-pref" className="form-label">Model Preference</label>
              <select
                id="model-pref"
                className="form-input"
                value={modelPreference}
                onChange={e => setModelPreference(e.target.value)}
                disabled={loading}
              >
                <option value="">Auto (default routing)</option>
                {modelsLoading ? (
                  <option disabled>Loading models…</option>
                ) : (
                  availableModels.map(m => (
                    <option key={m.id} value={(m.configuration as any)?.apiModelName ?? m.name}>
                      {m.name}{(m.configuration as any)?.apiModelName && (m.configuration as any).apiModelName !== m.name ? ` (${(m.configuration as any).apiModelName})` : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="form-hint">Select a model or leave on auto for default routing.</p>
            </div>

            <div className="form-group">
              <label htmlFor="policy-id" className="form-label">Policy ID</label>
              <input
                id="policy-id"
                type="text"
                className="form-input"
                value={policyId}
                onChange={e => setPolicyId(e.target.value)}
                placeholder="Policy UUID (optional)"
                disabled={loading}
              />
              <p className="form-hint">Override the default policy for this request.</p>
            </div>
          </div>

          {error && (
            <div className={`alert ${error.code === 'RATE_LIMIT_EXCEEDED' ? 'alert-warning' : 'alert-error'}`} role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600 }}>{error.code?.replace(/_/g, ' ') ?? 'Error'}</div>
                <div>{error.message}</div>
                {error.traceId && (
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.7 }}>
                    Trace: {error.traceId}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            aria-busy={loading}
            style={{ width: '100%', height: 42 }}
          >
            {loading ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
            ) : (
              <><Send size={16} /> Submit AI Request</>
            )}
          </button>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Request Result</h2>
            <StatusBadge status={result.status} />
          </div>

          <div className={`alert ${getResultStyle(result.status)}`}>
            {result.status === 'COMPLETED' && <CheckCircle size={16} style={{ flexShrink: 0 }} />}
            {['FAILED', 'BLOCKED', 'REJECTED'].includes(result.status) && <XCircle size={16} style={{ flexShrink: 0 }} />}
            {result.status === 'APPROVAL_REQUIRED' && <Clock size={16} style={{ flexShrink: 0 }} />}
            <div>
              {result.status === 'COMPLETED' && 'Request completed successfully through the AI provider.'}
              {result.status === 'BLOCKED' && 'Request was blocked by policy evaluation.'}
              {result.status === 'FAILED' && (result.errorMessage ?? 'Request failed during processing.')}
              {result.status === 'APPROVAL_REQUIRED' && 'Request requires human approval before proceeding.'}
              {!['COMPLETED','BLOCKED','FAILED','APPROVAL_REQUIRED'].includes(result.status) && `Status: ${result.status}`}
            </div>
          </div>

          {result.output && (
            <div style={{ marginTop: '1rem' }}>
              <div className="form-label">AI Response</div>
              <pre className="code-block">{result.output}</pre>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {[
              ['Request ID', result.id],
              ['Trace ID', result.traceId],
              ['Model', result.model ?? '—'],
              ['Provider', result.provider ?? '—'],
              ['Policy Decision', result.policyDecision ?? '—'],
              ['Privacy Result', result.privacyResult ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted" style={{ marginBottom: '0.25rem' }}>{label}</div>
                <code className="mono-value" style={{ fontSize: '0.75rem', display: 'block', overflowX: 'auto' }}>{value}</code>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/ai-requests/${result.id}`)}>
              View Full Details
            </button>
            {result.traceId && (
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/traces/${result.traceId}`)}>
                View Trace
              </button>
            )}
            {result.approvalId && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/approvals')}>
                Go to Approvals
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
