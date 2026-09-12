import React from 'react';

interface SavingsBreakdown {
  hard: number;
  costAvoidance: number;
  consolidation: number;
  downtimeAvoided: number;
}

interface SavingsCardProps {
  total: number;
  breakdown: SavingsBreakdown;
  period: string;
  currency?: string;
}

const SAVINGS_TYPES = [
  { key: 'hard' as const, label: 'Hard Savings', icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Reducción real de costos' },
  { key: 'costAvoidance' as const, label: 'Cost Avoidance', icon: '🛡️', color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Costos prevenidos' },
  { key: 'consolidation' as const, label: 'Consolidación', icon: '🤝', color: 'text-purple-600', bg: 'bg-purple-50', desc: 'Ahorro por volumen' },
  { key: 'downtimeAvoided' as const, label: 'Downtime Evitado', icon: '⚡', color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Pérdidas prevenidas' },
];

export const SavingsCard: React.FC<SavingsCardProps> = ({ total, breakdown, period, currency = 'USD' }) => {
  return (
    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-xl">
      {/* Total */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-emerald-200 text-sm font-medium">Ahorros LOGIFI™ · {period}</span>
          <span className="text-xs bg-emerald-500 rounded-full px-2 py-0.5">{currency}</span>
        </div>
        <p className="text-5xl font-black tracking-tight">
          ${total.toLocaleString('es-EC')}
        </p>
        <p className="text-emerald-300 text-sm mt-1">Total de ahorros este período</p>
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-2 gap-3">
        {SAVINGS_TYPES.map(type => {
          const amount = breakdown[type.key];
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <div key={type.key} className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{type.icon}</span>
                <span className="text-xs font-medium text-emerald-100">{type.label}</span>
              </div>
              <p className="text-xl font-bold">${amount.toLocaleString('es-EC')}</p>
              <div className="mt-1.5 bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-emerald-200 mt-1">{pct}% del total</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavingsCard;
