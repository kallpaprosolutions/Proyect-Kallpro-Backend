export type ProcurementStage =
  | 'REQUISITION'
  | 'APPROVAL'
  | 'ORDER'
  | 'RECEIPT'
  | 'INVOICE'
  | 'PAYMENT';

const STAGES: { key: ProcurementStage; label: string; icon: string }[] = [
  { key: 'REQUISITION', label: 'Requisición', icon: '📝' },
  { key: 'APPROVAL', label: 'Aprobación', icon: '✅' },
  { key: 'ORDER', label: 'Orden', icon: '🛒' },
  { key: 'RECEIPT', label: 'Recepción', icon: '📦' },
  { key: 'INVOICE', label: 'Factura', icon: '📑' },
  { key: 'PAYMENT', label: 'Pago', icon: '💵' },
];

interface Props {
  current: ProcurementStage;
  /** marca la etapa actual como en progreso parcial (p.ej. recepción parcial) */
  partial?: boolean;
}

export default function ProcurementFlow({ current, partial = false }: Props) {
  const currentIdx = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
      <p className="text-xs text-surface-500 uppercase tracking-wider mb-3">Flujo de compras</p>
      <div className="flex items-center overflow-x-auto">
        {STAGES.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const future = i > currentIdx;
          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  done ? 'bg-green-500 text-white' :
                  active ? (partial ? 'bg-orange-500 text-white ring-4 ring-orange-200 dark:ring-orange-900' : 'bg-brand-500 text-white ring-4 ring-brand-200 dark:ring-brand-900') :
                  'bg-surface-100 dark:bg-surface-700 text-surface-400'
                }`}>
                  {done ? '✓' : stage.icon}
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${
                  done ? 'text-green-600 dark:text-green-400' :
                  active ? (partial ? 'text-orange-600 dark:text-orange-400' : 'text-brand-600 dark:text-brand-400') :
                  'text-surface-400'
                }`}>
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1.5 min-w-[12px] transition-colors ${
                  future ? 'bg-surface-200 dark:bg-surface-700' : 'bg-green-500'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
