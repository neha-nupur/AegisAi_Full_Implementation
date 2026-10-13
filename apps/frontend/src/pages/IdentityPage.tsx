import { useState, useEffect } from 'react';
import { Users, KeyRound, Plus, RefreshCw, Copy, Check, Loader2 } from 'lucide-react';
import { api, ApiError, buildQueryString } from '../lib/api';
import { StatusBadge, LoadingState, ErrorState, EmptyState } from '../components/shared';
import { useToast } from '../contexts/ToastContext';
import { hasPermission, PERMISSIONS } from '../lib/rbac';
import { useUser } from '../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  status: string;
  createdAt: string;
}

interface ServiceAccount {
  id: string;
  name: string;
  role: string;
  organizationId: string;
  status: string;
  createdAt: string;
}

interface ListResult<T> {
  items: T[];
  nextCursor?: string;
}

export function IdentityPage() {
  const { toast } = useToast();
  const currentUser = useUser();
  const canWriteUser = hasPermission(currentUser.role, PERMISSIONS.CREATE_USER);
  const canWriteSa = hasPermission(currentUser.role, PERMISSIONS.CREATE_SERVICE_ACCOUNT);

  const [activeTab, setActiveTab] = useState<'USERS' | 'SERVICE_ACCOUNTS'>('USERS');

  const [users, setUsers] = useState<User[]>([]);
  const [sas, setSas] = useState<ServiceAccount[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cursor state (unused in simplified UI - reserved for pagination expansion)
  const [userCursor, setUserCursor] = useState<string | undefined>();
  const [userStack, setUserStack] = useState<string[]>([]);
  const [saCursor, setSaCursor] = useState<string | undefined>();
  const [saStack, setSaStack] = useState<string[]>([]);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'USER' | 'SA'>('USER');
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: 'DEVELOPER' });
  const [createLoading, setCreateLoading] = useState(false);
  
  // New SA Credential display
  const [newSaSecret, setNewSaSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async (cursor?: string) => {
    try {
      const qs = buildQueryString({ limit: 10, cursor });
      const res = await api.get<ListResult<User>>(`/users${qs}`);
      setUsers(res.items);
      setUserCursor(res.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load users');
    }
  };

  const fetchSas = async (cursor?: string) => {
    try {
      const qs = buildQueryString({ limit: 10, cursor });
      const res = await api.get<ListResult<ServiceAccount>>(`/service-accounts${qs}`);
      setSas(res.items);
      setSaCursor(res.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load service accounts');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'USERS') {
        await fetchUsers(userStack[userStack.length - 1]);
      } else {
        await fetchSas(saStack[saStack.length - 1]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, userStack, saStack]);

  // Maps a user role to the permissions a service account with that role should receive.
  // Service accounts use flat permission arrays (not roles) — this translates the UI's
  // role selector to the backend's expected permissions[] field.
  const roleToPermissions = (role: string): string[] => {
    const ALL = [
      'users:read', 'users:write', 'service_accounts:read', 'service_accounts:write',
      'organizations:read', 'organizations:write', 'ai_requests:read', 'ai_requests:write',
      'policies:read', 'policies:write', 'approvals:read', 'approvals:write', 'audit:read',
    ];
    if (role === 'ORGANIZATION_ADMIN') return ALL;
    if (role === 'DEVELOPER') return [
      'users:read', 'service_accounts:read', 'service_accounts:write', 'organizations:read',
      'ai_requests:read', 'ai_requests:write', 'policies:read', 'approvals:read',
    ];
    // SECURITY_AUDITOR
    return [
      'users:read', 'service_accounts:read', 'organizations:read',
      'ai_requests:read', 'policies:read', 'approvals:read', 'audit:read',
    ];
  };

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      if (createType === 'USER') {
        if (!createForm.password) {
          toast.error('Password is required');
          setCreateLoading(false);
          return;
        }
        await api.post('/users', { email: createForm.email, role: createForm.role, password: createForm.password });
        toast.success('User created successfully');
        setShowCreateModal(false);
        fetchUsers(userStack[userStack.length - 1]);
      } else {
        const res = await api.post<{ serviceAccount: ServiceAccount; credential: string }>('/service-accounts', {
          name: createForm.name,
          permissions: roleToPermissions(createForm.role),
        });
        setNewSaSecret({ id: res.serviceAccount.id, secret: res.credential });
        toast.success('Service account created successfully');
        setShowCreateModal(false);
        fetchSas(saStack[saStack.length - 1]);
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Creation failed');
    } finally {
      setCreateLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (newSaSecret) {
      navigator.clipboard.writeText(newSaSecret.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Identity & Access</h1>
          <p className="page-subtitle">Manage users, service accounts, and RBAC roles</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchData()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'USERS' ? 'active' : ''}`} onClick={() => setActiveTab('USERS')}>
          <Users size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Users
        </button>
        <button className={`tab ${activeTab === 'SERVICE_ACCOUNTS' ? 'active' : ''}`} onClick={() => setActiveTab('SERVICE_ACCOUNTS')}>
          <KeyRound size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Service Accounts
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : activeTab === 'USERS' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {canWriteUser && (
              <button className="btn btn-primary btn-sm" onClick={() => { setCreateType('USER'); setCreateForm({ email: '', password: '', name: '', role: 'DEVELOPER' }); setShowCreateModal(true); }}>
                <Plus size={14} /> Add User
              </button>
            )}
          </div>
          {users.length === 0 ? (
            <EmptyState icon={<Users size={32} />} title="No users found" />
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.role}</td>
                        <td><StatusBadge status={u.status} /></td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" disabled={userStack.length === 0} onClick={() => setUserStack(prev => prev.slice(0, -1))}>Previous</button>
                <button className="btn btn-secondary btn-sm" disabled={!userCursor} onClick={() => { if (userCursor) setUserStack(prev => [...prev, userCursor]); }}>Next</button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {canWriteSa && (
              <button className="btn btn-primary btn-sm" onClick={() => { setCreateType('SA'); setCreateForm({ email: '', password: '', name: '', role: 'DEVELOPER' }); setShowCreateModal(true); }}>
                <Plus size={14} /> Create Service Account
              </button>
            )}
          </div>
          {sas.length === 0 ? (
            <EmptyState icon={<KeyRound size={32} />} title="No service accounts found" />
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>SA Name</th>
                      <th>ID / Client ID</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sas.map(sa => (
                      <tr key={sa.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sa.name}</td>
                        <td><code className="mono-value">{sa.id}</code></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{sa.role}</td>
                        <td><StatusBadge status={sa.status} /></td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(sa.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" disabled={saStack.length === 0} onClick={() => setSaStack(prev => prev.slice(0, -1))}>Previous</button>
                <button className="btn btn-secondary btn-sm" disabled={!saCursor} onClick={() => { if (saCursor) setSaStack(prev => [...prev, saCursor]); }}>Next</button>
              </div>
            </>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{createType === 'USER' ? 'Add User' : 'Create Service Account'}</h2>
            </div>
            <div className="modal-body">
              {createType === 'USER' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} placeholder="user@company.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input type="password" className="form-input" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} placeholder="Minimum 8 characters" />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Service Name</label>
                  <input type="text" className="form-input" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} placeholder="e.g. CI/CD Pipeline" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={createForm.role} onChange={e => setCreateForm({...createForm, role: e.target.value})}>
                  <option value="DEVELOPER">Developer</option>
                  <option value="SECURITY_AUDITOR">Security Auditor</option>
                  <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={createLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createLoading}>
                {createLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New SA Secret Modal */}
      {newSaSecret && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Service Account Created</h2>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <strong>Important:</strong> This is the only time the Client Secret will be shown. Copy it now and store it securely.
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Client ID</label>
                <code className="mono-value" style={{ display: 'block', padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>{newSaSecret.id}</code>
              </div>
              <div className="form-group">
                <label className="form-label">Client Secret</label>
                <div className="copy-box">
                  <span className="copy-box-value">{newSaSecret.secret}</span>
                  <button className="btn-icon" onClick={copyToClipboard} title="Copy to clipboard">
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setNewSaSecret(null)}>I have saved the secret</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
