import { Link } from 'react-router-dom';

/**
 * Banner guía del flujo de compras — se monta en las páginas de detalle
 * (requisición, comparativo, OC) para que el usuario siempre sepa en qué
 * paso está y cuál es la siguiente acción. Espeja las etapas del Hub.
 */

export type FlowStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: { n: FlowStep; label: string }[] = [
  { n: 1, label: 'Requisición' },
  { n: 2, label: 'Cotizaciones' },
  { n: 3, label: 'Comparativo' },
  { n: 4, label: 'Aprobación' },
  { n: 5, label: 'Pago y recepción' },
  { n: 6, label: 'Fin' },
];

interface Props {
  /** Paso actual del flujo (1..6) */
  step: FlowStep;
  /** Texto de la siguiente acción, p. ej. "Carga al menos 2 cotizaciones para comparar" */
  nextLabel?: string;
  /** Si hay URL, se muestra CTA navegable; si no, solo el texto guía */
  nextUrl?: string;
  /** Texto del botón CTA (default "Continuar →") */
  ctaText?: string;
}

export default function FlowGuideBanner({ step, nextLabel, nextUrl, ctaText = 'Continuar →' }: Props) {
  const done = step >= 6;
  return (
    <div className={`rounded-2xl border p-4 shadow-soft ${done
      ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800'
      : 'bg-brand-50/60 dark:bg-brand-900/15 border-brand-200 dark:border-brand-800'}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Mini-stepper */}
        <div className="flex items-center gap-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const isDone = s.n < step || done;
            const isActive = s.n === step && !done;
            return (
              <div key={s.n} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    isDone ? 'bg-green-500 text-white'
                    : isActive ? 'bg-brand-500 text-white ring-2 ring-brand-200 dark:ring-brand-800'
                    : 'bg-surface-200 dark:bg-surface-700 text-surface-500'}`}>
                    {isDone ? '✓' : s.n}
                  </div>
                  <span className={`text-xs whitespace-nowrap hidden sm:inline ${
                    isActive ? 'font-semibold text-brand-700 dark:text-brand-300'
                    : isDone ? 'text-green-700 dark:text-green-400'
                    : 'text-surface-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className={`w-4 h-0.5 mx-1 ${isDone ? 'bg-green-400' : 'bg-surface-200 dark:bg-surface-700'}`} />}
              </div>
            );
          })}
        </div>

        {/* Siguiente acción */}
        {done ? (
          <span className="text-sm font-medium text-green-700 dark:text-green-400">🎉 Flujo de compra completado</span>
        ) : nextLabel && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-surface-700 dark:text-surface-200">
              <span className="font-semibold text-brand-600 dark:text-brand-400">Siguiente:</span> {nextLabel}
            </span>
            {nextUrl && (
              <Link to={nextUrl}
                className="text-sm px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
                {ctaText}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
