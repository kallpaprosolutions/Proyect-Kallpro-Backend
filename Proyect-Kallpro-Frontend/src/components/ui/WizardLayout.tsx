import { ReactNode } from 'react';
import Stepper from './Stepper';
import BackButton from './BackButton';

interface Step {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  steps: Step[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  isLast?: boolean;
  isSubmitting?: boolean;
  cancelLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  children: ReactNode;
  backFallback?: string;
}

export default function WizardLayout({
  title, subtitle, icon, steps, currentIndex,
  onPrev, onNext, onFinish, onCancel,
  canPrev = true, canNext = true, isLast = false, isSubmitting = false,
  cancelLabel = 'Cancelar', nextLabel = 'Siguiente', finishLabel = 'Finalizar',
  children, backFallback = '/',
}: Props) {
  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          {icon && <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">{icon}</div>}
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{title}</h1>
            {subtitle && <p className="text-sm text-surface-500">{subtitle}</p>}
          </div>
        </div>
        <BackButton fallback={backFallback} />
      </div>

      {/* Stepper */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft mb-6">
        <Stepper steps={steps} currentIndex={currentIndex} />
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-6 shadow-soft mb-6">
        {children}
      </div>

      {/* Footer sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-surface-900/95 backdrop-blur border-t border-surface-200 dark:border-surface-700 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-surface-500">
            Paso <span className="font-semibold text-surface-700 dark:text-white">{currentIndex + 1}</span> de {steps.length}
            {steps[currentIndex] && <span className="ml-2">— {steps[currentIndex].label}</span>}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel}
                className="px-4 py-2 text-sm rounded-lg text-surface-500 hover:text-surface-700 dark:hover:text-white">
                {cancelLabel}
              </button>
            )}
            <button type="button" onClick={onPrev} disabled={!canPrev || currentIndex === 0 || isSubmitting}
              className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-brand-400 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Atrás
            </button>
            {!isLast ? (
              <button type="button" onClick={onNext} disabled={!canNext || isSubmitting}
                className="px-5 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {nextLabel} →
              </button>
            ) : (
              <button type="button" onClick={onFinish} disabled={!canNext || isSubmitting}
                className="px-5 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Procesando...' : `✓ ${finishLabel}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
