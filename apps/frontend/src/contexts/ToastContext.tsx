/**
 * Toast context — lightweight notification system.
 * No external library; compatible with the existing stack.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-green-400" />,
  error: <XCircle size={16} className="text-red-400" />,
  warning: <AlertTriangle size={16} className="text-yellow-400" />,
  info: <Info size={16} className="text-blue-400" />,
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`toast toast-${toast.type}`}>
      {ICONS[toast.type]}
      <span style={{ flex: 1, fontSize: '0.875rem' }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0', display: 'flex' }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => add('success', msg),
    error:   (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
    info:    (msg: string) => add('info', msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
