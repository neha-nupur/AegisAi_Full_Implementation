import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, RefreshCw, ChevronRight, Search, Filter } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { LoadingState, ErrorState, EmptyState, Pagination, StatusBadge } from '../components/shared';

interface AiRequest {
  id: string;
  status: string;
  modelId?: string;
  providerId?: string;
  modelName?: string;
  providerName?: string;
  traceId: string;
  policyId?: string;
  requesterId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface AiRequestListResult {
  items: AiRequest[];
  nextCursor?: string;
}

const STATUS_OPTIONS = ['', 'COMPLETED', 'FAILED', 'BLOCKED', 'APPROVAL_REQUIRED', 'PENDING', 'RECEIVED'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function AiRequestsPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<AiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const fetchRequests = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString({ limit: 20, cursor, status: statusFilter || undefined, model: modelFilter || undefined });
      const result = await api.get<AiRequestListResult>(`/ai-requests${qs}`);
      setRequests(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load AI requests');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, modelFilter]);

  useEffect(() => {
    setCursorStack([]);
    setNextCursor(undefined);
    fetchRequests();
  }, [fetchRequests]);

  const handleNext = () => {
    if (nextCursor) {
      setCursorStack(prev => [...prev, nextCursor]);
      fetchRequests(nextCursor);
    }
  };

  const handlePrev = () => {
    const stack = [...cursorStack];
    stack.pop();
    const cursor = stack[stack.length - 1];
    setCursorStack(stack);
    fetchRequests(cursor);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">AI Requests</h1>
          <p className="page-subtitle">Monitor requests flowing through the AegisAI gateway</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchRequests()}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/ai-requests/new')}>
            <Plus size={14} /> New Request
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Filter size={14} className="search-box-icon" />
          <select
            className="form-input search-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="search-box">
          <Search size={14} className="search-box-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Filter by model…"
            value={modelFilter}
            onChange={e => setModelFilter(e.target.value)}
            aria-label="Filter by model"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchRequests()} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Zap size={32} />}
          title="No AI requests found"
          description="Submit your first AI request to see it here."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/ai-requests/new')}>
              <Plus size={16} /> Submit AI Request
            </button>
          }
        />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Trace ID</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/ai-requests/${req.id}`)}>
                    <td>
                      <code className="mono-value" style={{ fontSize: '0.75rem' }}>{req.id.slice(0, 12)}…</code>
                    </td>
                    <td><StatusBadge status={req.status} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{req.modelName ?? '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{req.providerName ?? '—'}</td>
                    <td>
                      <code className="mono-value" style={{ fontSize: '0.6875rem' }}>{req.traceId?.slice(0, 10)}…</code>
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(req.createdAt)}</td>
                    <td>
                      <button className="btn-icon" aria-label={`View request ${req.id}`}>
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            hasNext={!!nextCursor}
            hasPrev={cursorStack.length > 0}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        </>
      )}
    </div>
  );
}
