import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, RefreshCw, Pencil, Trash2, FileText, Loader2 } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { LoadingState, ErrorState, EmptyState, Pagination, StatusBadge } from '../components/shared';
import { useToast } from '../contexts/ToastContext';
import { hasPermission, PERMISSIONS } from '../lib/rbac';
import { useUser } from '../contexts/AuthContext';

type PolicyAction = 'ALLOW' | 'BLOCK' | 'MASK' | 'REQUIRE_APPROVAL' | 'ROUTE';
type PolicyStatus = 'ACTIVE' | 'INACTIVE';

interface PolicyRule {
  id: string;
  action: PolicyAction;
}

interface Policy {
  id: string;
  name: string;
  status: PolicyStatus;
  version: number;
  organizationId: string;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
}

interface PolicyListResult {
  items: Policy[];
  nextCursor?: string;
}

const ACTIONS: PolicyAction[] = ['ALLOW', 'BLOCK', 'MASK', 'REQUIRE_APPROVAL', 'ROUTE'];
const STATUSES: PolicyStatus[] = ['ACTIVE', 'INACTIVE'];

function newRule(): PolicyRule {
  return { id: `rule-${Date.now()}`, action: 'ALLOW' };
}

interface PolicyFormState {
  name: string;
  status: PolicyStatus;
  rules: PolicyRule[];
}

const defaultForm = (): PolicyFormState => ({ name: '', status: 'ACTIVE', rules: [newRule()] });

export function PoliciesPage() {
  const { toast } = useToast();
  const user = useUser();
  const canWrite = hasPermission(user.role, PERMISSIONS.CREATE_POLICY);

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [policyModal, setPolicyModal] = useState<null | { mode: 'create' } | { mode: 'edit'; policy: Policy }>(null);
  const [form, setForm] = useState<PolicyFormState>(defaultForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString({ limit: 20, ...(cursor ? { cursor } : {}) });
      const result = await api.get<PolicyListResult>(`/policies${qs}`);
      setPolicies(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCursorStack([]);
    setNextCursor(undefined);
    fetchPolicies();
  }, [fetchPolicies]);

  const handleNext = () => {
    if (nextCursor) {
      setCursorStack(prev => [...prev, nextCursor]);
      fetchPolicies(nextCursor);
    }
  };

  const handlePrev = () => {
    const stack = [...cursorStack];
    stack.pop();
    setCursorStack(stack);
    fetchPolicies(stack[stack.length - 1]);
  };

  const openCreate = () => { setForm(defaultForm()); setFormError(null); setPolicyModal({ mode: 'create' }); };
  const openEdit = (policy: Policy) => {
    setForm({ name: policy.name, status: policy.status, rules: policy.rules.length > 0 ? policy.rules : [newRule()] });
    setFormError(null);
    setPolicyModal({ mode: 'edit', policy });
  };

  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, newRule()] }));
  const removeRule = (idx: number) => setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== idx) }));
  const updateRule = (idx: number, patch: Partial<PolicyRule>) =>
    setForm(f => ({ ...f, rules: f.rules.map((r, i) => i === idx ? { ...r, ...patch } : r) }));

  const handleSubmitPolicy = async () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (form.rules.length === 0) { setFormError('At least one rule is required.'); return; }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = { name: form.name.trim(), status: form.status, rules: form.rules };
      if (policyModal?.mode === 'create') {
        await api.post('/policies', payload);
        toast.success('Policy created successfully');
      } else if (policyModal?.mode === 'edit') {
        await api.patch(`/policies/${policyModal.policy.id}`, payload);
        toast.success('Policy updated successfully');
      }
      setPolicyModal(null);
      fetchPolicies(cursorStack[cursorStack.length - 1]);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save policy');
    } finally {
      setFormLoading(false);
    }
  };

  const deletePolicy = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/policies/${deleteModal}`);
      toast.success('Policy deleted successfully');
      setDeleteModal(null);
      fetchPolicies(cursorStack[cursorStack.length - 1]);
    } catch (err) {
      toast.error(err instanceof ApiError ? `Failed: ${err.message}` : 'An unexpected error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Policies</h1>
          <p className="page-subtitle">Manage organizational security rules and AI routing policies</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchPolicies()}><RefreshCw size={14} /> Refresh</button>
          {canWrite && (
            <button className="btn btn-primary btn-sm" onClick={openCreate} id="new-policy-btn">
              <Plus size={14} /> New Policy
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchPolicies()} />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="No policies defined"
          description="Create your first policy to govern AI requests for your organization."
          action={canWrite && (
            <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Create Policy</button>
          )}
        />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Rules</th>
                  <th>Updated</th>
                  {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {policies.map(policy => (
                  <tr key={policy.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{policy.name}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>{policy.id}</div>
                    </td>
                    <td><StatusBadge status={policy.status} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>v{policy.version}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {policy.rules.slice(0, 3).map((r, i) => (
                          <span key={i} className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>{r.action}</span>
                        ))}
                        {policy.rules.length > 3 && (
                          <span className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>+{policy.rules.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(policy.updatedAt).toLocaleDateString()}</td>
                    {canWrite && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <button className="btn-icon" onClick={() => openEdit(policy)} title="Edit Policy" id={`edit-policy-${policy.id}`}><Pencil size={14} /></button>
                          <button className="btn-icon" style={{ color: 'var(--status-danger)' }} onClick={() => setDeleteModal(policy.id)} title="Delete Policy" id={`delete-policy-${policy.id}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination hasNext={!!nextCursor} hasPrev={cursorStack.length > 0} onNext={handleNext} onPrev={handlePrev} />
        </>
      )}

      {/* Create / Edit Policy Modal */}
      {policyModal && createPortal(
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">{policyModal.mode === 'create' ? 'Create Policy' : 'Edit Policy'}</h2>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}
              <div className="form-group">
                <label className="form-label">Policy Name <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <input type="text" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Default Allow Policy" disabled={formLoading} id="policy-name-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PolicyStatus }))} disabled={formLoading}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Rules <span style={{ color: 'var(--status-danger)' }}>*</span>
              </div>
              {form.rules.map((rule, idx) => (
                <div key={rule.id} className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem', borderColor: 'rgba(99,102,241,0.2)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Rule ID</label>
                      <input type="text" className="form-input" value={rule.id} onChange={e => updateRule(idx, { id: e.target.value })} disabled={formLoading} style={{ fontSize: '0.8125rem' }} />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Action</label>
                      <select className="form-input" value={rule.action} onChange={e => updateRule(idx, { action: e.target.value as PolicyAction })} disabled={formLoading} style={{ fontSize: '0.8125rem' }}>
                        {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    {form.rules.length > 1 && (
                      <button className="btn-icon" style={{ color: 'var(--status-danger)', marginBottom: '0.25rem' }} onClick={() => removeRule(idx)} disabled={formLoading} title="Remove rule">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addRule} disabled={formLoading} style={{ marginTop: '0.25rem' }}>
                <Plus size={12} /> Add Rule
              </button>
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>A rule with no conditions matches all requests (fallback/default rule).</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPolicyModal(null)} disabled={formLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitPolicy} disabled={formLoading} id="policy-submit-btn">
                {formLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (policyModal.mode === 'create' ? 'Create Policy' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteModal && createPortal(
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Delete Policy</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)' }}>
                Are you sure you want to delete this policy? Active AI requests relying on it may fall back to defaults. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)} disabled={deleteLoading}>Cancel</button>
              <button className="btn btn-danger" onClick={deletePolicy} disabled={deleteLoading}>
                {deleteLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Delete Policy'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


