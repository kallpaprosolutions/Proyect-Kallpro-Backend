import { ProgressBar, OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';
import { getCriterionDef, type Criterion } from '../../data/scoringCriteria';

export interface RankingEntry {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  deliveryDays: number | null;
  weightedScore: number;
  breakdown: Record<string, { raw: number; score: number; weight: number }>;
}

interface Props {
  criteria: Criterion[];
  ranking: RankingEntry[];
  winnerQuotationId: string | null;
  onSelectWinner?: (quotationId: string, supplierName: string) => void;
  canSelect?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function fmtRaw(key: string, raw: number): string {
  if (key === 'PRICE') return `$${raw.toLocaleString('es', { minimumFractionDigits: 2 })}`;
  if (key === 'DELIVERY') return `${raw} días`;
  if (key === 'PAYMENT') return `${raw.toFixed(0)} (crédito neto)`;
  return `${raw.toFixed(0)} pts`;
}

export function WeightedComparisonMatrix({ criteria, ranking, winnerQuotationId, onSelectWinner, canSelect }: Props) {
  if (ranking.length === 0) {
    return <div className="text-center py-12 text-surface-400">Aún no hay evaluación. Pulsa "Calcular comparativo".</div>;
  }

  const cols = `220px repeat(${ranking.length}, minmax(160px, 1fr))`;

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
      {/* Encabezado: proveedores */}
      <div className="grid border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50" style={{ gridTemplateColumns: cols }}>
        <div className="px-4 py-3 text-xs uppercase text-surface-500 font-semibold">Criterio (peso)</div>
        {ranking.map((r) => {
          const isWinner = r.quotationId === winnerQuotationId;
          return (
            <div key={r.quotationId} className={`px-3 py-3 text-center border-l border-surface-200 dark:border-surface-700 ${isWinner ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
              {isWinner && <div className="text-[11px] font-bold text-green-600 dark:text-green-400 mb-0.5">🏆 MEJOR OPCIÓN</div>}
              <div className="font-bold text-surface-900 dark:text-white text-sm truncate">{r.supplierName}</div>
              <div className="text-xs text-surface-500 mt-0.5">${r.totalAmount.toLocaleString('es', { minimumFractionDigits: 2 })}</div>
            </div>
          );
        })}
      </div>

      {/* Filas por criterio */}
      {criteria.map((c) => {
        const def = getCriterionDef(c.key);
        return (
          <div key={c.key} className="grid border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50/50 dark:hover:bg-surface-700/20" style={{ gridTemplateColumns: cols }}>
            <div className="px-4 py-3 flex items-center gap-2">
              <span>{def?.icon ?? '•'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{c.label}</p>
                <p className="text-xs text-surface-400">peso {c.weight}%</p>
              </div>
            </div>
            {ranking.map((r) => {
              const cell = r.breakdown[c.key];
              if (!cell) return <div key={r.quotationId} className="px-3 py-3 border-l border-surface-100 dark:border-surface-700/50 text-center text-surface-400">—</div>;
              return (
                <div key={r.quotationId} className="px-3 py-3 border-l border-surface-100 dark:border-surface-700/50">
                  <OverlayTrigger placement="top" overlay={<Tooltip id={`t-${c.key}-${r.quotationId}`}>{fmtRaw(c.key, cell.raw)} → {cell.score.toFixed(0)} pts × {c.weight}%</Tooltip>}>
                    <div className="cursor-default">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-surface-500">{fmtRaw(c.key, cell.raw)}</span>
                        <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">{cell.score.toFixed(0)}</span>
                      </div>
                      <ProgressBar now={cell.score} variant={scoreColor(cell.score)} style={{ height: '6px', borderRadius: '999px' }} className="bs-progress" />
                    </div>
                  </OverlayTrigger>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Fila final: puntaje ponderado */}
      <div className="grid bg-surface-50 dark:bg-surface-700/40 border-t-2 border-surface-200 dark:border-surface-600" style={{ gridTemplateColumns: cols }}>
        <div className="px-4 py-3 text-sm font-bold text-surface-700 dark:text-surface-200">PUNTAJE PONDERADO</div>
        {ranking.map((r) => {
          const isWinner = r.quotationId === winnerQuotationId;
          return (
            <div key={r.quotationId} className={`px-3 py-3 border-l border-surface-200 dark:border-surface-600 text-center ${isWinner ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
              <Badge bg={isWinner ? 'success' : 'secondary'} className="text-sm px-2.5 py-1">
                {r.weightedScore.toFixed(1)} pts
              </Badge>
              {canSelect && onSelectWinner && (
                <button
                  onClick={() => onSelectWinner(r.quotationId, r.supplierName)}
                  className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isWinner
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }`}
                >
                  {isWinner ? '🏆 Generar OC' : 'Elegir igual'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
