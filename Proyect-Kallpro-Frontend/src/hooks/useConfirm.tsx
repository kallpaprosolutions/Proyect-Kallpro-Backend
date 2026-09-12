import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const handleResolve = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const isDanger = state?.opts.variant === 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => handleResolve(false)}
        >
          <div
            className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-surface-100 dark:border-surface-700">
              <h3 className={`text-lg font-semibold ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>
                {state.opts.title}
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-surface-700 dark:text-surface-300">
                {state.opts.message}
              </p>
            </div>
            <div className="p-5 border-t border-surface-100 dark:border-surface-700 flex justify-end gap-2">
              <button
                onClick={() => handleResolve(false)}
                className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-surface-400 transition-colors"
              >
                {state.opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => handleResolve(true)}
                className={`px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors ${
                  isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-500 hover:bg-brand-600'
                }`}
              >
                {state.opts.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe estar dentro de <ConfirmProvider>');
  return ctx.confirm;
}
