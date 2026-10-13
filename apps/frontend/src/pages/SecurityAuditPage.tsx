import { useState, useEffect } from 'react';
import { ShieldAlert, BookOpen, RefreshCw } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { StatusBadge, LoadingState, ErrorState, EmptyState, Pagination } from '../components/shared';

interface SecurityEvent {
  id: string;
  organizationId?: string;
  eventType?: string;
  severity?: string;
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  description?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  createdAt?: string;
}

interface AuditEvent {
  id: string;
  traceId?: string;
  aiRequestId?: string;
  organizationId?: string;
  eventType?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface ListResult<T> {
  items: T[];
  nextCursor?: string | null;
}

/** Safely format a date string — returns '—' instead of crashing on undefined/invalid dates. */
function safeDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** Safely replace underscores with spaces */
function humanize(value?: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

export function SecurityAuditPage() {
  const [activeTab, setActiveTab] = useState<'SECURITY' | 'AUDIT'>('SECURITY');

  const [secEvents, setSecEvents] = useState<SecurityEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [secCursor, setSecCursor] = useState<string | undefined>();
  const [secStack, setSecStack] = useState<string[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | undefined>();
  const [auditStack, setAuditStack] = useState<string[]>([]);

  const fetchSecEvents = async (cursor?: string) => {
    try {
      const qs = buildQueryString({ limit: 20, cursor });
      const res = await api.get<ListResult<SecurityEvent>>(`/security-events${qs}`);
      setSecEvents(Array.isArray(res?.items) ? res.items : []);
      setSecCursor(res?.nextCursor ?? undefined);
    } catch (err) {
      console.error('[SecurityAuditPage] fetchSecEvents error:', err);
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load security events');
    }
  };

  const fetchAuditEvents = async (cursor?: string) => {
    try {
      const qs = buildQueryString({ limit: 20, cursor });
      const res = await api.get<ListResult<AuditEvent>>(`/audit-events${qs}`);
      setAuditEvents(Array.isArray(res?.items) ? res.items : []);
      setAuditCursor(res?.nextCursor ?? undefined);
    } catch (err) {
      console.error('[SecurityAuditPage] fetchAuditEvents error:', err);
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load audit events');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'SECURITY') {
        await fetchSecEvents(secStack[secStack.length - 1]);
      } else {
        await fetchAuditEvents(auditStack[auditStack.length - 1]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Security &amp; Audit Log</h1>
          <p className="page-subtitle">Immutable records of system activity and security alerts</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchData()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'SECURITY' ? 'active' : ''}`} onClick={() => setActiveTab('SECURITY')}>
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Security Events
        </button>
        <button className={`tab ${activeTab === 'AUDIT' ? 'active' : ''}`} onClick={() => setActiveTab('AUDIT')}>
          <BookOpen size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Audit Log
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : activeTab === 'SECURITY' ? (
        <>
          {secEvents.length === 0 ? (
            <EmptyState icon={<ShieldAlert size={32} />} title="No security events" />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Severity</th>
                    <th>Context</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {secEvents.map(evt => (
                    <tr key={evt.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{humanize(evt.eventType)}</td>
                      <td><StatusBadge status={evt.severity ?? 'UNKNOWN'} /></td>
                      <td>
                        {evt.actorId && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Actor: <code className="mono-value">{evt.actorId}</code></div>}
                        {evt.ipAddress && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>IP: {evt.ipAddress}</div>}
                        {evt.metadata?.findingTypes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(evt.metadata.findingTypes as string[]).join(', ')}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {evt.description && <div style={{ marginBottom: '4px' }}>{evt.description}</div>}
                        {evt.metadata && Object.keys(evt.metadata).length > 0 ? (
                          <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                            {Object.entries(evt.metadata).map(([k, v]) => (
                              <div key={k}><strong>{k}</strong>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                            ))}
                          </div>
                        ) : (
                          !evt.description ? '—' : null
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{safeDate(evt.timestamp ?? evt.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            hasNext={!!secCursor}
            hasPrev={secStack.length > 0}
            onNext={() => { setSecStack(p => [...p, secCursor!]); fetchSecEvents(secCursor); }}
            onPrev={() => { const s = [...secStack]; s.pop(); setSecStack(s); fetchSecEvents(s[s.length - 1]); }}
          />
        </>
      ) : (
        <>
          {auditEvents.length === 0 ? (
            <EmptyState icon={<BookOpen size={32} />} title="No audit events" />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Resource</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map(evt => (
                    <tr key={evt.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{humanize(evt.eventType)}</td>
                      <td><code className="mono-value" style={{ fontSize: '0.75rem' }}>{evt.metadata?.actorId ?? 'system'}</code></td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>{evt.aiRequestId ? 'AI_REQUEST' : (evt.traceId ? 'TRACE' : '—')}</div>
                        {evt.aiRequestId && <code className="mono-value" style={{ fontSize: '0.6875rem' }}>{evt.aiRequestId}</code>}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {evt.metadata ? (
                          <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                            {Object.entries(evt.metadata).map(([k, v]) => (
                              <div key={k}><strong>{k}</strong>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{safeDate(evt.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            hasNext={!!auditCursor}
            hasPrev={auditStack.length > 0}
            onNext={() => { setAuditStack(p => [...p, auditCursor!]); fetchAuditEvents(auditCursor); }}
            onPrev={() => { const s = [...auditStack]; s.pop(); setAuditStack(s); fetchAuditEvents(s[s.length - 1]); }}
          />
        </>
      )}
    </div>
  );
}
