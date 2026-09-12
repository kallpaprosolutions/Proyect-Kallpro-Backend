import { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'default', isLoading = false, onConfirm, onCancel, children,
}: Props) {
  if (!open) return null;
  const isDanger = variant === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !isLoading && onCancel()}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-surface-100 dark:border-surface-700">
          <h3 className={`text-lg font-semibold ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{title}</h3>
        </div>
        <div className="p-5">
          {message && <p className="text-sm text-surface-700 dark:text-surface-300">{message}</p>}
          {children}
        </div>
        <div className="p-5 border-t border-surface-100 dark:border-surface-700 flex justify-end gap-2">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-surface-400 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={isLoading}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-500 hover:bg-brand-600'
            }`}>
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
