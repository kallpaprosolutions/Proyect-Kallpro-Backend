import { GRADE_COLORS, TEMPERATURE_ICONS, TEMPERATURE_LABELS } from '../../lib/crmLabels';

interface ScoreBadgeProps {
  score: number;
  grade?: string;
  temperature?: string;
  /** Umbrales MQL/SQL de la empresa, para explicar el número. */
  thresholds?: { mql: number; sql: number };
  size?: 'sm' | 'md';
}

/**
 * Semáforo del score de un lead.
 *
 * Muestra el número, el grado y la temperatura juntos porque un número suelto no dice
 * nada: "72" solo significa algo si al lado se ve que el umbral SQL es 75.
 */
export default function ScoreBadge({ score, grade, temperature, thresholds, size = 'md' }: ScoreBadgeProps) {
  const lifecycle = thresholds
    ? score >= thresholds.sql ? 'SQL' : score >= thresholds.mql ? 'MQL' : 'Lead'
    : null;

  const barColor =
    score >= 80 ? 'bg-emerald-500'
    : score >= 60 ? 'bg-blue-500'
    : score >= 40 ? 'bg-amber-500'
    : 'bg-surface-300 dark:bg-surface-600';

  const isSm = size === 'sm';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex flex-col ${isSm ? 'w-16' : 'w-20'}`}>
        <div className="flex items-baseline gap-1">
          <span className={`font-bold tabular-nums text-surface-900 dark:text-white ${isSm ? 'text-sm' : 'text-base'}`}>
            {score}
          </span>
          {lifecycle && (
            <span className="text-[10px] font-medium text-surface-400 dark:text-surface-500">{lifecycle}</span>
          )}
        </div>
        <div
          className="h-1.5 w-full rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Puntaje del lead: ${score} de 100`}
        >
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(2, score)}%` }} />
        </div>
      </div>

      {grade && (
        <span
          className={`inline-flex items-center justify-center rounded-md font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS.D} ${isSm ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-xs'}`}
          title={`Grado ${grade}`}
        >
          {grade}
        </span>
      )}

      {temperature && (
        <span title={TEMPERATURE_LABELS[temperature] ?? temperature} className={isSm ? 'text-sm' : 'text-base'}>
          {TEMPERATURE_ICONS[temperature] ?? ''}
        </span>
      )}
    </div>
  );
}
