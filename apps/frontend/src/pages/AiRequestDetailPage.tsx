import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { StatusBadge, LoadingState, ErrorState } from '../components/shared';

interface AiRequestDetail {
  id: string;
  status: string;
  model?: string;
  provider?: string;
  modelId?: string;
  providerId?: string;
  modelName?: string;
  providerName?: string;
  traceId: string;
  policyId?: string;
  policyDecision?: string;
  privacyResult?: string;
  requesterId?: string;
  organizationId: string;
  output?: string;
  errorMessage?: string;
  approvalId?: string;
  createdAt: string;
  updatedAt: string;
}

function Field({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-muted" style={{ marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      {mono ? (
        <code className="mono-value" style={{ fontSize: '0.8125rem', display: 'block', wordBreak: 'break-all' }}>{value}</code>
      ) : (
        <div className="text-sm">{value}</div>
      )}
    </div>
  );
}

const LIFECYCLE_STEPS = [
  'RECEIVED',
  'VALIDATED',
  'PRIVACY_SCAN',
  'POLICY_EVALUATION',
  'ROUTING',
  'PROVIDER_CALL',
  'COMPLETED',
];

function LifecycleBar({ status }: { status: string }) {
  const currentIndex = LIFECYCLE_STEPS.indexOf(status);
  const isBlocked = ['BLOCKED', 'FAILED', 'REJECTED'].includes(status);
  const isApproval = ['APPROVAL_REQUIRED', 'APPROVED'].includes(status);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="form-label">Request Lifecycle</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {LIFECYCLE_STEPS.map((step, idx) => {
          let dotColor = 'var(--text-muted)';
          if (isBlocked && idx >= currentIndex) dotColor = 'var(--status-danger)';
          else if (idx < currentIndex) dotColor = 'var(--status-success)';
          else if (idx === currentIndex) dotColor = isBlocked ? 'var(--status-danger)' : 'var(--brand-primary)';

          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 80,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', background: dotColor,
                  border: idx === currentIndex ? `2px solid ${dotColor}` : 'none',
                  boxShadow: idx === currentIndex ? `0 0 6px ${dotColor}` : 'none',
                  transition: 'all 0.2s',
                }} />
                <div style={{ fontSize: '0.625rem', color: idx === currentIndex ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: idx === currentIndex ? 700 : 400, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {step.replace(/_/g, ' ')}
                </div>
              </div>
              {idx < LIFECYCLE_STEPS.length - 1 && (
                <div style={{ width: 24, height: 1, background: idx < currentIndex ? 'var(--status-success)' : 'var(--border-light)', marginBottom: '1.125rem' }} />
              )}
            </div>
          );
        })}
        {(isBlocked || isApproval) && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 24, height: 1, background: 'var(--border-light)', marginBottom: '1.125rem' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 80 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: isBlocked ? 'var(--status-danger)' : 'var(--status-warning)',
                boxShadow: `0 0 6px ${isBlocked ? 'var(--status-danger)' : 'var(--status-warning)'}`,
              }} />
              <div style={{ fontSize: '0.625rem', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {status.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AiRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [req, setReq] = useState<AiRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const requestData = await api.get<AiRequestDetail>(`/ai-requests/${id}`);
      
      // Use the enriched names from the API response directly, falling back to trace events
      let model = requestData.modelName || requestData.model;
      let provider = requestData.providerName || requestData.provider;
      let policyDecision = requestData.policyDecision;
      let privacyResult = requestData.privacyResult;

      if (requestData.traceId) {
        try {
          // Fetch trace to augment details (see docs/api-conventions.md: traces hold lifecycle metadata)
          const traceData = await api.get<any>(`/traces/${requestData.traceId}`);
          const events = traceData.events || [];
          
          const routingEvent = events.find((e: any) => e.eventType === 'MODEL_ROUTING_STARTED' || e.eventType === 'PROVIDER_CALL_STARTED');
          if (routingEvent?.metadata) {
            model = routingEvent.metadata.modelName || routingEvent.metadata.modelId || model;
            provider = routingEvent.metadata.providerName || routingEvent.metadata.providerId || provider;
          }

          const policyEvent = events.find((e: any) => e.eventType === 'POLICY_EVALUATED');
          if (policyEvent?.metadata) {
            policyDecision = policyEvent.metadata.action || policyDecision;
          }

          const privacyEvent = events.find((e: any) => e.eventType === 'PRIVACY_SCAN_COMPLETED');
          if (privacyEvent?.metadata) {
            if (privacyEvent.metadata.detected) {
              const types = privacyEvent.metadata.findingTypes?.join(', ');
              privacyResult = `PII detected — ${types || 'UNKNOWN'}`;
            } else {
              privacyResult = 'No PII detected';
            }
          }
        } catch (err) {
          console.warn('Failed to load trace for detail augmentation', err);
        }
      }

      setReq({ ...requestData, model, provider, policyDecision, privacyResult });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchDetails} />;
  if (!req) return <ErrorState message="Request not found" />;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn-icon" onClick={() => navigate('/ai-requests')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-heading" style={{ fontSize: '1.25rem', marginBottom: 0 }}>AI Request</h1>
            <StatusBadge status={req.status} />
          </div>
          <code className="mono-value" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{req.id}</code>
        </div>
      </div>

      <div className="card">
        <LifecycleBar status={req.status} />

        <div className="divider" style={{ margin: '1.5rem 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
          <Field label="Request ID" value={req.id} mono />
          <Field label="Trace ID" value={req.traceId} mono />
          <Field label="Model" value={req.model ?? '—'} />
          <Field label="Provider" value={req.provider ?? '—'} />
          <Field label="Policy Decision" value={req.policyDecision ?? '—'} />
          <Field label="Privacy Result" value={req.privacyResult ?? '—'} />
          <Field label="Requester" value={req.requesterId ?? '—'} mono />
          <Field label="Organization" value={req.organizationId} mono />
          <Field label="Created" value={new Date(req.createdAt).toLocaleString()} />
          <Field label="Updated" value={new Date(req.updatedAt).toLocaleString()} />
        </div>

        {req.output && (
          <>
            <div className="divider" />
            <div>
              <div className="form-label">AI Response</div>
              <pre className="code-block">{req.output}</pre>
            </div>
          </>
        )}

        {req.errorMessage && (
          <>
            <div className="divider" />
            <div className="alert alert-error">
              <strong>Error:</strong> {req.errorMessage}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          {req.traceId && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/traces/${req.traceId}`)}>
              <ExternalLink size={14} /> View Trace
            </button>
          )}
          {req.approvalId && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/approvals')}>
              Manage Approval
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
