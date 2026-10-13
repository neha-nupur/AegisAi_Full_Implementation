import { useEffect, useState } from 'react';
import { Zap, Shield, CheckSquare, AlertTriangle, Activity, TrendingUp, Clock } from 'lucide-react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge, LoadingState, ErrorState } from '../components/shared';

/* ── GraphQL Query ── */
const GET_AI_REQUESTS = gql`
  query GetAiRequests($limit: Int) {
    aiRequests(limit: $limit) {
      items {
        id
        status
        model
        provider
        traceId
        createdAt
        requesterId
      }
      nextCursor
    }
  }
`;

/* ── Types matching the backend response envelopes ── */
interface AiRequestSummary {
  id: string;
  status: string;
  model?: string;
  provider?: string;
  traceId: string;
  createdAt: string;
  requesterId?: string;
}

interface AiRequestListResult {
  items: AiRequestSummary[];
  nextCursor?: string;
  total?: number;
}

interface ApprovalSummary {
  id: string;
  aiRequestId: string;
  status: string;
  reason?: string;
  createdAt: string;
}

interface ApprovalListResult {
  items: ApprovalSummary[];
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  actorId?: string;
  createdAt: string;
  description?: string;
}

interface SecurityEventListResult {
  items: SecurityEvent[];
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  loading?: boolean;
}

function StatCard({ label, value, icon, color = 'var(--brand-primary)', loading }: StatCardProps) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card-title" style={{ marginBottom: '0.3rem' }}>{label}</div>
        {loading ? (
          <div className="skeleton skeleton-title" style={{ width: 60 }} />
        ) : (
          <div className="stat-value">{value}</div>
        )}
      </div>
    </div>
  );
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function DashboardPage() {
  const { user } = useAuth();

  // Use Apollo GraphQL for AI Requests
  const { data: gqlData, loading: loadingRequests, error: gqlError } = useQuery<{ aiRequests: AiRequestListResult }>(GET_AI_REQUESTS, {
    variables: { limit: 20 },
    fetchPolicy: 'network-only'
  });

  const [approvals, setApprovals] = useState<ApprovalListResult | null>(null);
  const [secEvents, setSecEvents] = useState<SecurityEventListResult | null>(null);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [loadingSecEvents, setLoadingSecEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gqlError) {
      setError(gqlError.message);
    }
  }, [gqlError]);

  useEffect(() => {
    // Fetch approvals (keeping REST as per requirements, we only need to integrate ONE dashboard usecase via GraphQL)
    api.get<ApprovalListResult>('/approvals?limit=20')
      .then(setApprovals)
      .catch(() => setApprovals({ items: [] }))
      .finally(() => setLoadingApprovals(false));

    // Fetch security events
    api.get<SecurityEventListResult>('/security-events?limit=10')
      .then(setSecEvents)
      .catch(() => setSecEvents({ items: [] }))
      .finally(() => setLoadingSecEvents(false));
  }, []);

  const reqItems = gqlData?.aiRequests?.items ?? [];
  const approvalItems = approvals?.items ?? [];
  const secItems = secEvents?.items ?? [];

  const totalRequests = reqItems.length;
  const completedRequests = reqItems.filter((r: AiRequestSummary) => r.status === 'COMPLETED').length;
  const blockedRequests = reqItems.filter((r: AiRequestSummary) => r.status === 'BLOCKED').length;
  const failedRequests = reqItems.filter((r: AiRequestSummary) => r.status === 'FAILED').length;
  const pendingApprovals = approvalItems.filter((a: ApprovalSummary) => a.status === 'PENDING').length;

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Security &amp; Governance Overview</h1>
          <p className="page-subtitle">
            Real-time metrics for your AI request pipeline
          </p>
        </div>
        {user && (
          <span className="badge badge-info">
            <Activity size={11} /> Live
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard label="Total Requests" value={loadingRequests ? '…' : totalRequests} icon={<Zap size={18} />} loading={loadingRequests} />
        <StatCard label="Completed" value={loadingRequests ? '…' : completedRequests} icon={<TrendingUp size={18} />} color="var(--status-success)" loading={loadingRequests} />
        <StatCard label="Blocked" value={loadingRequests ? '…' : blockedRequests} icon={<Shield size={18} />} color="var(--status-danger)" loading={loadingRequests} />
        <StatCard label="Failed" value={loadingRequests ? '…' : failedRequests} icon={<AlertTriangle size={18} />} color="var(--status-warning)" loading={loadingRequests} />
        <StatCard label="Pending Approvals" value={loadingApprovals ? '…' : pendingApprovals} icon={<CheckSquare size={18} />} color="var(--status-warning)" loading={loadingApprovals} />
        <StatCard label="Security Events" value={loadingSecEvents ? '…' : secItems.length} icon={<AlertTriangle size={18} />} color="var(--status-danger)" loading={loadingSecEvents} />
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
        {/* Recent AI Requests */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent AI Requests</span>
            <a href="/ai-requests" style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', textDecoration: 'none' }}>View all →</a>
          </div>
          {loadingRequests ? (
            <LoadingState message="Loading requests…" />
          ) : reqItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Zap size={24} className="empty-state-icon" />
              <p className="empty-state-title">No AI requests yet</p>
              <p className="empty-state-desc">Submit your first AI request to see it here.</p>
            </div>
          ) : (
            <div>
              {reqItems.slice(0, 8).map((req: AiRequestSummary) => (
                <div key={req.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.625rem 0', borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.model ?? 'Unknown model'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Clock size={10} style={{ display: 'inline', marginRight: 2 }} />
                      {formatRelative(req.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Security Events */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Security Events</span>
            <a href="/security-events" style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', textDecoration: 'none' }}>View all →</a>
          </div>
          {loadingSecEvents ? (
            <LoadingState message="Loading events…" />
          ) : secItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <AlertTriangle size={24} className="empty-state-icon" />
              <p className="empty-state-title">No security events</p>
              <p className="empty-state-desc">Security events will appear here when detected.</p>
            </div>
          ) : (
            <div>
              {secItems.slice(0, 8).map(evt => (
                <div key={evt.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.625rem 0', borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.eventType?.replace(/_/g, ' ') ?? 'Security Event'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatRelative(evt.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={evt.severity ?? 'LOW'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals > 0 && (
        <div className="card" style={{ marginTop: '1rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--status-warning)' }}>
              <CheckSquare size={14} style={{ display: 'inline', marginRight: 6 }} />
              Approval Queue ({pendingApprovals} pending)
            </span>
            <a href="/approvals" style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', textDecoration: 'none' }}>Manage →</a>
          </div>
          <div>
            {approvalItems.filter(a => a.status === 'PENDING').slice(0, 5).map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.625rem 0', borderBottom: '1px solid var(--border-light)',
              }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Request: {a.aiRequestId.slice(0, 12)}…
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatRelative(a.createdAt)}</div>
                </div>
                <a href={`/approvals`} className="btn btn-secondary btn-sm">Review</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
