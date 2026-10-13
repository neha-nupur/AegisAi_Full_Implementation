import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GitBranch, RefreshCw, ChevronRight, ArrowLeft } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { LoadingState, ErrorState, EmptyState, Pagination } from '../components/shared';

interface AuditEvent {
  id: string;
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  eventType: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface Trace {
  id: string;
  aiRequestId: string;
  organizationId: string;
  requesterId: string;
  events?: AuditEvent[];
  startedAt: string;
  completedAt: string | null;
}

interface TraceListResult {
  items: Trace[];
  nextCursor?: string;
}

export function TracesPage() {
  const navigate = useNavigate();

  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const fetchTraces = async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString({ limit: 20, cursor });
      const res = await api.get<TraceListResult>(`/traces${qs}`);
      setTraces(res.items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load traces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCursorStack([]);
    setNextCursor(undefined);
    fetchTraces();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Request Traces</h1>
          <p className="page-subtitle">Distributed execution paths for AI gateway requests</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchTraces()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchTraces(cursorStack[cursorStack.length - 1])} />
      ) : traces.length === 0 ? (
        <EmptyState icon={<GitBranch size={32} />} title="No traces found" />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Trace ID</th>
                  <th>Events</th>
                  <th>AI Request</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => {
                  let durationMs = 0;
                  if (t.completedAt && t.startedAt) {
                    durationMs = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
                  }
                  
                  // check if any event has error status
                  const hasError = t.events?.some(e => e.eventType.includes('ERROR') || e.eventType.includes('FAIL')) ?? false;
                  
                  const eventCount = t.events?.length ?? 0;

                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/traces/${t.id}`)}>
                      <td>
                        <code className="mono-value" style={{ fontSize: '0.8125rem', color: hasError ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                          {t.id}
                        </code>
                      </td>
                      <td>{eventCount === 0 ? '—' : `${eventCount} events`}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.aiRequestId ?? '—'}</td>
                      <td>{durationMs > 0 ? `${durationMs}ms` : '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(t.startedAt).toLocaleString()}</td>
                      <td>
                        <button className="btn-icon">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            hasNext={!!nextCursor}
            hasPrev={cursorStack.length > 0}
            onNext={() => { setCursorStack(p => [...p, nextCursor!]); fetchTraces(nextCursor); }}
            onPrev={() => { const s = [...cursorStack]; s.pop(); setCursorStack(s); fetchTraces(s[s.length - 1]); }}
          />
        </>
      )}
    </div>
  );
}

export function TraceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Trace>(`/traces/${id}`)
      .then(setTrace)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setError(null); api.get<Trace>(`/traces/${id}`).then(setTrace).catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false)); }} />;
  if (!trace) return <ErrorState message="Trace not found" />;

  const sortedEvents = (trace.events || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn-icon" onClick={() => navigate('/traces')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-heading" style={{ fontSize: '1.25rem', marginBottom: 0 }}>Trace Details</h1>
          <code className="mono-value" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{trace.id}</code>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4, textTransform: 'uppercase' }}>AI Request ID</div>
            <div className="font-semibold">{trace.aiRequestId ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4, textTransform: 'uppercase' }}>Total Events</div>
            <div className="font-semibold">{trace.events?.length ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4, textTransform: 'uppercase' }}>Started</div>
            <div className="text-sm">{new Date(trace.startedAt).toLocaleString()}</div>
          </div>
        </div>

        <h3 className="card-title">Execution Timeline</h3>
        <div className="trace-timeline" style={{ marginTop: '1rem' }}>
          {sortedEvents.map(event => {
            const isError = event.eventType.includes('ERROR') || event.eventType.includes('FAIL');
            return (
              <div key={event.id} className="trace-event">
                <div className={`trace-event-dot ${isError ? 'error' : 'success'}`} />
                <div className="trace-event-header">
                  <span className="trace-event-name" style={{ color: isError ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                    {event.eventType}
                  </span>
                  <span className="trace-event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Event ID: {event.id}
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="trace-event-detail">
                    {JSON.stringify(event.metadata, null, 2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
