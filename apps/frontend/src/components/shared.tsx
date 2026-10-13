import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/* ── Loading State ─────────────────────────────────────────────────── */
export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="empty-state">
      <Loader2 size={32} className="empty-state-icon" style={{ animation: 'spin 1s linear infinite' }} />
      <p className="empty-state-title">{message}</p>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: '1.25rem' }}>{action}</div>}
    </div>
  );
}

/* ── Error State ───────────────────────────────────────────────────── */
export function ErrorState({
  message,
  traceId,
  onRetry,
}: {
  message: string;
  traceId?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state-title" style={{ color: 'var(--status-danger)' }}>
        {message}
      </p>
      {traceId && (
        <p className="empty-state-desc" style={{ marginTop: '0.5rem' }}>
          Trace ID: <code className="mono-value">{traceId}</code>
        </p>
      )}
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="skeleton skeleton-text" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton skeleton-title" style={{ width: '40%', marginBottom: '0.75rem' }} />
      <div className="skeleton skeleton-card" />
    </div>
  );
}

/* ── Status Badge ──────────────────────────────────────────────────── */
type StatusMap = {
  [key: string]: { cls: string; label?: string };
};

const STATUS_MAP: StatusMap = {
  // AI Request statuses
  RECEIVED:           { cls: 'badge-neutral', label: 'Received' },
  VALIDATED:          { cls: 'badge-olive',   label: 'Validated' },
  PRIVACY_SCAN:       { cls: 'badge-info',    label: 'Privacy Scan' },
  POLICY_EVALUATION:  { cls: 'badge-info',    label: 'Policy Eval' },
  ROUTING:            { cls: 'badge-info',    label: 'Routing' },
  PROVIDER_CALL:      { cls: 'badge-info',    label: 'Provider Call' },
  COMPLETED:          { cls: 'badge-success', label: 'Completed' },
  FAILED:             { cls: 'badge-danger',  label: 'Failed' },
  BLOCKED:            { cls: 'badge-danger',  label: 'Blocked' },
  APPROVAL_REQUIRED:  { cls: 'badge-warning', label: 'Pending Approval' },
  APPROVED:           { cls: 'badge-olive',   label: 'Approved' },
  REJECTED:           { cls: 'badge-danger',  label: 'Rejected' },
  // Approval
  PENDING:            { cls: 'badge-warning', label: 'Pending' },
  // User status
  ACTIVE:             { cls: 'badge-success', label: 'Active' },
  INACTIVE:           { cls: 'badge-neutral', label: 'Inactive' },
  SUSPENDED:          { cls: 'badge-danger',  label: 'Suspended' },
  // Policy
  ENABLED:            { cls: 'badge-olive',   label: 'Enabled' },
  DISABLED:           { cls: 'badge-neutral', label: 'Disabled' },
  // Policy actions
  ALLOW:              { cls: 'badge-success', label: 'Allow' },
  BLOCK:              { cls: 'badge-danger',  label: 'Block' },
  MASK:               { cls: 'badge-warning', label: 'Mask' },
  REQUIRE_APPROVAL:   { cls: 'badge-purple',  label: 'Require Approval' },
  ROUTE:              { cls: 'badge-info',    label: 'Route' },
  // Security severity
  LOW:                { cls: 'badge-info',    label: 'Low' },
  MEDIUM:             { cls: 'badge-warning', label: 'Medium' },
  HIGH:               { cls: 'badge-danger',  label: 'High' },
  CRITICAL:           { cls: 'badge-danger',  label: 'Critical' },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status?.toUpperCase()] ?? { cls: 'badge-neutral' };
  return (
    <span className={`badge ${entry.cls}`}>
      {entry.label ?? status}
    </span>
  );
}

/* ── Confirmation Modal ────────────────────────────────────────────── */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title" id="confirm-title">{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────────────────── */
export function Pagination({
  hasNext,
  hasPrev,
  onNext,
  onPrev,
}: {
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
      <button className="btn btn-secondary btn-sm" onClick={onPrev} disabled={!hasPrev}>
        ← Previous
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onNext} disabled={!hasNext}>
        Next →
      </button>
    </div>
  );
}
