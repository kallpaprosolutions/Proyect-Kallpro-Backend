import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'bg-green-50 dark:bg-green-900/30',  border: 'border-green-200 dark:border-green-800',  text: 'text-green-800 dark:text-green-300', icon: '✓' },
  error:   { bg: 'bg-red-50 dark:bg-red-900/30',      border: 'border-red-200 dark:border-red-800',      text: 'text-red-800 dark:text-red-300',     icon: '✕' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/30',border: 'border-yellow-200 dark:border-yellow-800',text: 'text-yellow-800 dark:text-yellow-300',icon: '⚠' },
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/30',    border: 'border-blue-200 dark:border-blue-800',    text: 'text-blue-800 dark:text-blue-300',   icon: 'ℹ' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = t.duration ?? 4000;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  const value: ToastContextValue = {
    show,
    success: (message, title) => show({ message, title, variant: 'success' }),
    error:   (message, title) => show({ message, title, variant: 'error' }),
    warning: (message, title) => show({ message, title, variant: 'warning' }),
    info:    (message, title) => show({ message, title, variant: 'info' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const v = VARIANT_STYLES[toast.variant];
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`${v.bg} ${v.border} ${v.text} border rounded-xl shadow-lg pointer-events-auto px-4 py-3 flex items-start gap-3 transition-all duration-200 ${entering ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
      <span className="text-lg flex-shrink-0">{v.icon}</span>
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
        <p className="text-sm">{toast.message}</p>
      </div>
      <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe estar dentro de <ToastProvider>');
  return ctx;
}
