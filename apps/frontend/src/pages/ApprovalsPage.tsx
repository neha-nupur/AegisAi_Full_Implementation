import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { LoadingState, ErrorState, EmptyState, Pagination, StatusBadge } from '../components/shared';
import { useToast } from '../contexts/ToastContext';

interface Approval {
  id: string;
  aiRequestId: string;
  status: string;
  organizationId: string;
  policyId?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalListResult {
  items: Approval[];
  nextCursor?: string;
}

export function ApprovalsPage() {
  const { toast } = useToast();

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const [actionModal, setActionModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchApprovals = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString({ limit: 20, cursor, status: statusFilter || undefined });
      const result = await api.get<ApprovalListResult>(`/approvals${qs}`);
      setApprovals(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load approvals');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setCursorStack([]);
    setNextCursor(undefined);
    fetchApprovals();
  }, [fetchApprovals]);

  const handleNext = () => {
    if (nextCursor) {
      setCursorStack(prev => [...prev, nextCursor]);
      fetchApprovals(nextCursor);
    }
  };

  const handlePrev = () => {
    const stack = [...cursorStack];
    stack.pop();
    const cursor = stack[stack.length - 1];
    setCursorStack(stack);
    fetchApprovals(cursor);
  };

  const submitAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      await api.post(`/approvals/${actionModal.id}/${actionModal.action}`, {
        reason: actionReason || undefined,
      });
      toast.success(`Request ${actionModal.action}d successfully`);
      setActionModal(null);
      setActionReason('');
      fetchApprovals(cursorStack[cursorStack.length - 1]);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(`Failed to ${actionModal.action}: ${err.message}`);
      } else {
        toast.error(`An unexpected error occurred`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Approvals</h1>
          <p className="page-subtitle">Review AI requests flagged by organizational policies</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchApprovals()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${statusFilter === 'PENDING' ? 'active' : ''}`} onClick={() => setStatusFilter('PENDING')}>
          Pending Review
        </button>
        <button className={`tab ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>
          All Approvals
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchApprovals()} />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={32} />}
          title="No approvals found"
          description={statusFilter === 'PENDING' ? "You're all caught up! No pending requests require your approval." : "No approvals found in the system."}
        />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Status</th>
                  <th>Policy ID</th>
                  <th>Reason</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(appr => (
                  <tr key={appr.id}>
                    <td>
                      <code className="mono-value" style={{ fontSize: '0.75rem' }}>{appr.aiRequestId.slice(0, 12)}…</code>
                    </td>
                    <td><StatusBadge status={appr.status} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {appr.policyId ? <code className="mono-value">{appr.policyId.slice(0, 8)}</code> : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{appr.reason ?? '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(appr.createdAt).toLocaleString()}</td>
                    <td>
                      {appr.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => { setActionModal({ id: appr.id, action: 'approve' }); setActionReason(''); }}
                            title="Approve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => { setActionModal({ id: appr.id, action: 'reject' }); setActionReason(''); }}
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
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

      {actionModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {actionModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h2>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                You are about to {actionModal.action} AI Request approval <code className="mono-value">{actionModal.id}</code>.
              </p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reason" className="form-label">Reason (Optional)</label>
                <textarea
                  id="reason"
                  className="form-input"
                  rows={3}
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  placeholder="Enter a reason for this decision…"
                  disabled={actionLoading}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActionModal(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className={`btn ${actionModal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={submitAction}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
