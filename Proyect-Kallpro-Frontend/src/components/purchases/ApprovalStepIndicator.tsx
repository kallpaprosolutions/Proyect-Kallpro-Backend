import { ProgressBar, OverlayTrigger, Tooltip } from 'react-bootstrap';

export interface ApprovalStep {
  level: number;
  label: string;
  approverId?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
}

interface Props {
  requiredLevels: number;
  currentLevel: number;
  steps: ApprovalStep[];
  status: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Jefe de Área',
  2: 'Jefe de Compras',
  3: 'Director Financiero',
  4: 'Gerente General',
  5: 'Directorio / Comité',
};

export function ApprovalStepIndicator({ requiredLevels, currentLevel, steps, status }: Props) {
  if (requiredLevels === 0) return null;

  const isRejected = status === 'REJECTED';
  const isApproved = status === 'APPROVED';
  const progressPct = isApproved ? 100 : Math.round((currentLevel / requiredLevels) * 100);

  return (
    <div className="approval-step space-y-3">
      {/* progress bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-surface-500">Progreso de aprobación</span>
        <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">
          {isApproved ? 'Completado' : isRejected ? 'Rechazado' : `Nivel ${currentLevel} de ${requiredLevels}`}
        </span>
      </div>
      <ProgressBar
        now={isRejected ? 100 : progressPct}
        variant={isRejected ? 'danger' : isApproved ? 'success' : 'primary'}
        style={{ height: '6px', borderRadius: '999px' }}
        className="bs-progress"
      />

      {/* step circles */}
      <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
        {Array.from({ length: requiredLevels }, (_, i) => {
          const lvl = i + 1;
          const step = steps.find((s) => s.level === lvl);
          const isDone = isApproved ? true : currentLevel >= lvl;
          const isActive = !isRejected && !isApproved && currentLevel + 1 === lvl;
          const isRej = isRejected && currentLevel + 1 === lvl;

          const label = step?.label || LEVEL_LABELS[lvl] || `Nivel ${lvl}`;
          const tooltipContent = step?.approvedAt
            ? `${label}\nAprobado: ${new Date(step.approvedAt).toLocaleDateString('es-EC')}\n${step.notes || ''}`
            : label;

          return (
            <div key={lvl} className="flex items-center gap-1 flex-shrink-0">
              <OverlayTrigger
                placement="top"
                overlay={<Tooltip id={`step-${lvl}`}>{tooltipContent}</Tooltip>}
              >
                <div className="flex flex-col items-center gap-1 cursor-default">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                      ${isDone && !isRejected
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                          ? 'bg-brand-500 border-brand-500 text-white approval-step-active'
                          : isRej
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 border-surface-300 dark:border-surface-600 text-surface-400'
                      }
                    `}
                  >
                    {isDone && !isRejected ? '✓' : isRej ? '✕' : lvl}
                  </div>
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 text-center leading-tight max-w-[64px]">
                    {label.split('/')[0].trim()}
                  </span>
                </div>
              </OverlayTrigger>

              {lvl < requiredLevels && (
                <div className={`h-0.5 w-6 flex-shrink-0 transition-all ${isDone && !isRejected ? 'bg-green-400' : 'bg-surface-200 dark:bg-surface-600'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
