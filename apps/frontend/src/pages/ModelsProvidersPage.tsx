import { useState, useEffect, useCallback } from 'react';
import { Cpu, Server, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { StatusBadge, LoadingState, ErrorState, EmptyState } from '../components/shared';
import { useToast } from '../contexts/ToastContext';
import { hasPermission, PERMISSIONS } from '../lib/rbac';
import { useUser } from '../contexts/AuthContext';

interface Model {
  id: string;
  name: string;
  providerId: string;
  status: string;
  active: boolean;
  capabilities: string[];
  sensitivityLevel: string;
  costMetadata: {
    inputCostPer1k: number;
    outputCostPer1k: number;
    currency: string;
  };
  configuration: Record<string, any>;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  status: string;
  healthStatus: string;
  priority: number;
  configurationReference: string;
}

export function ModelsProvidersPage() {
  const { toast } = useToast();
  const user = useUser();
  const canWriteModel = hasPermission(user.role, PERMISSIONS.CREATE_MODEL);
  const canWriteProvider = hasPermission(user.role, PERMISSIONS.CREATE_PROVIDER);

  const [activeTab, setActiveTab] = useState<'MODELS' | 'PROVIDERS'>('MODELS');
  
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [providerModal, setProviderModal] = useState<Partial<Provider> | null>(null);
  const [modelModal, setModelModal] = useState<Partial<Model> | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, pRes] = await Promise.all([
        api.get<{items: Model[]}>('/model-provider/models'),
        api.get<{items: Provider[]}>('/model-provider/providers')
      ]);
      setModels(mRes.items);
      setProviders(pRes.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load infrastructure data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Provider Actions
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerModal) return;
    try {
      const payload = {
        name: providerModal.name,
        type: providerModal.type || 'openai',
        baseUrl: providerModal.baseUrl || 'https://api.openai.com/v1',
        status: providerModal.status || 'active',
        healthStatus: providerModal.healthStatus || 'unknown',
        priority: Number(providerModal.priority) || 1,
        configurationReference: providerModal.configurationReference || 'default'
      };

      if (providerModal.id) {
        await api.patch(`/model-provider/providers/${providerModal.id}`, payload);
        toast.success('Provider updated successfully');
      } else {
        await api.post('/model-provider/providers', payload);
        toast.success('Provider created successfully');
      }
      setProviderModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save provider');
    }
  };

  const handleDeleteProvider = async () => {
    if (!deleteProviderId) return;
    try {
      await api.delete(`/model-provider/providers/${deleteProviderId}`);
      toast.success('Provider deleted successfully');
      setDeleteProviderId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete provider');
    }
  };

  // Model Actions
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelModal) return;
    try {
      const payload = {
        name: modelModal.name,
        providerId: modelModal.providerId,
        capabilities: typeof modelModal.capabilities === 'string' 
          ? (modelModal.capabilities as string).split(',').map(s => s.trim()) 
          : (modelModal.capabilities || []),
        sensitivityLevel: modelModal.sensitivityLevel || 'low',
        costMetadata: {
          inputCostPer1k: Number(modelModal.costMetadata?.inputCostPer1k) || 0,
          outputCostPer1k: Number(modelModal.costMetadata?.outputCostPer1k) || 0,
          currency: modelModal.costMetadata?.currency || 'USD'
        },
        active: modelModal.active ?? true,
        configuration: typeof modelModal.configuration === 'string' 
          ? JSON.parse(modelModal.configuration) 
          : (modelModal.configuration || {})
      };

      if (modelModal.id) {
        await api.patch(`/model-provider/models/${modelModal.id}`, payload);
        toast.success('Model updated successfully');
      } else {
        await api.post('/model-provider/models', payload);
        toast.success('Model created successfully');
      }
      setModelModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save model');
    }
  };

  const handleDeleteModel = async () => {
    if (!deleteModelId) return;
    try {
      await api.delete(`/model-provider/models/${deleteModelId}`);
      toast.success('Model deleted successfully');
      setDeleteModelId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete model');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-heading">AI Infrastructure</h1>
          <p className="page-subtitle">Manage connected AI models and upstream provider configurations</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchData()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'MODELS' ? 'active' : ''}`} onClick={() => setActiveTab('MODELS')}>
          <Cpu size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Models
        </button>
        <button className={`tab ${activeTab === 'PROVIDERS' ? 'active' : ''}`} onClick={() => setActiveTab('PROVIDERS')}>
          <Server size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Providers
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : activeTab === 'MODELS' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {canWriteModel && (
              <button className="btn btn-primary btn-sm" onClick={() => setModelModal({
                active: true,
                capabilities: [],
                sensitivityLevel: 'low',
                costMetadata: { inputCostPer1k: 0, outputCostPer1k: 0, currency: 'USD' },
                configuration: {}
              })}>
                <Plus size={14} /> Add Model
              </button>
            )}
          </div>
          {models.length === 0 ? (
            <EmptyState
              icon={<Cpu size={32} />}
              title="No models configured"
              description="Register AI models that your organization is allowed to route requests to."
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Model Name</th>
                    <th>Provider ID</th>
                    <th>Status</th>
                    <th>Sensitivity</th>
                    {canWriteModel && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {models.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}><code className="mono-value">{m.providerId}</code></td>
                      <td><StatusBadge status={m.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td>{m.sensitivityLevel}</td>
                      {canWriteModel && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button className="btn-icon" onClick={() => setModelModal({
                              ...m,
                              configuration: JSON.stringify(m.configuration, null, 2) as any,
                              capabilities: m.capabilities.join(', ') as any
                            })} title="Edit Model">
                              <Pencil size={14} />
                            </button>
                            <button className="btn-icon" style={{ color: 'var(--status-danger)' }} onClick={() => setDeleteModelId(m.id)} title="Delete Model">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {canWriteProvider && (
              <button className="btn btn-primary btn-sm" onClick={() => setProviderModal({
                type: 'openai',
                status: 'active',
                healthStatus: 'unknown',
                priority: 1
              })}>
                <Plus size={14} /> Add Provider
              </button>
            )}
          </div>
          {providers.length === 0 ? (
            <EmptyState
              icon={<Server size={32} />}
              title="No providers configured"
              description="Register upstream AI providers (e.g. OpenAI, Anthropic, local clusters)."
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Base URL</th>
                    {canWriteProvider && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {providers.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td>{p.type}</td>
                      <td><StatusBadge status={p.status.toUpperCase()} /></td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.baseUrl ?? '—'}</td>
                      {canWriteProvider && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button className="btn-icon" onClick={() => setProviderModal(p)} title="Edit Provider">
                              <Pencil size={14} />
                            </button>
                            <button className="btn-icon" style={{ color: 'var(--status-danger)' }} onClick={() => setDeleteProviderId(p.id)} title="Delete Provider">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Provider Modal */}
      {providerModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{providerModal.id ? 'Edit Provider' : 'Add Provider'}</h2>
            </div>
            <form onSubmit={handleSaveProvider}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Name</label>
                  <input className="input" required value={providerModal.name || ''} onChange={e => setProviderModal({...providerModal, name: e.target.value})} placeholder="e.g. Primary OpenAI" />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="input" value={providerModal.type || 'openai'} onChange={e => setProviderModal({...providerModal, type: e.target.value})}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="bedrock">AWS Bedrock</option>
                    <option value="mock">Mock</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Base URL</label>
                  <input className="input" required value={providerModal.baseUrl || ''} onChange={e => setProviderModal({...providerModal, baseUrl: e.target.value})} placeholder="e.g. https://api.openai.com/v1" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Status</label>
                    <select className="input" value={providerModal.status || 'active'} onChange={e => setProviderModal({...providerModal, status: e.target.value})}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Health Status</label>
                    <select className="input" value={providerModal.healthStatus || 'unknown'} onChange={e => setProviderModal({...providerModal, healthStatus: e.target.value})}>
                      <option value="healthy">Healthy</option>
                      <option value="degraded">Degraded</option>
                      <option value="unhealthy">Unhealthy</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Priority</label>
                    <input className="input" type="number" min="1" required value={providerModal.priority || 1} onChange={e => setProviderModal({...providerModal, priority: Number(e.target.value)})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Config Ref (Vault)</label>
                    <input className="input" required value={providerModal.configurationReference || ''} onChange={e => setProviderModal({...providerModal, configurationReference: e.target.value})} placeholder="e.g. vault://openai/prod" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setProviderModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Provider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {modelModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{modelModal.id ? 'Edit Model' : 'Add Model'}</h2>
            </div>
            <form onSubmit={handleSaveModel}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Model Name</label>
                    <input className="input" required value={modelModal.name || ''} onChange={e => setModelModal({...modelModal, name: e.target.value})} placeholder="e.g. gpt-4" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Provider</label>
                    <select className="input" required value={modelModal.providerId || ''} onChange={e => setModelModal({...modelModal, providerId: e.target.value})}>
                      <option value="" disabled>Select Provider</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Capabilities (comma separated)</label>
                  <input className="input" value={modelModal.capabilities as any || ''} onChange={e => setModelModal({...modelModal, capabilities: e.target.value as any})} placeholder="e.g. chat, completions, embeddings" />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Sensitivity Level</label>
                    <select className="input" value={modelModal.sensitivityLevel || 'low'} onChange={e => setModelModal({...modelModal, sensitivityLevel: e.target.value})}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={modelModal.active ?? true} onChange={e => setModelModal({...modelModal, active: e.target.checked})} />
                      Active (Routable)
                    </label>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Cost Metadata</h4>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Input Cost / 1k</label>
                      <input className="input" type="number" step="0.0001" required value={modelModal.costMetadata?.inputCostPer1k || 0} onChange={e => setModelModal({...modelModal, costMetadata: {...modelModal.costMetadata!, inputCostPer1k: Number(e.target.value)}})} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Output Cost / 1k</label>
                      <input className="input" type="number" step="0.0001" required value={modelModal.costMetadata?.outputCostPer1k || 0} onChange={e => setModelModal({...modelModal, costMetadata: {...modelModal.costMetadata!, outputCostPer1k: Number(e.target.value)}})} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Currency</label>
                      <input className="input" required value={modelModal.costMetadata?.currency || 'USD'} onChange={e => setModelModal({...modelModal, costMetadata: {...modelModal.costMetadata!, currency: e.target.value}})} />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Configuration (JSON)</label>
                  <textarea 
                    className="input" 
                    rows={4} 
                    style={{ fontFamily: 'monospace', resize: 'vertical' }}
                    value={modelModal.configuration as any || '{}'} 
                    onChange={e => setModelModal({...modelModal, configuration: e.target.value as any})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModelModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Model</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modals */}
      {deleteProviderId && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">Delete Provider</h2></div>
            <div className="modal-body"><p>Are you sure you want to delete this provider? This action cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteProviderId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteProvider}>Delete Provider</button>
            </div>
          </div>
        </div>
      )}

      {deleteModelId && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">Delete Model</h2></div>
            <div className="modal-body"><p>Are you sure you want to delete this model? This action cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModelId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteModel}>Delete Model</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
