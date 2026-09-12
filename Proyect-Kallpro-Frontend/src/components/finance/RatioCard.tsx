import React from 'react';

interface RatioCardProps {
  code: string;
  name: string;
  value: number | null;
  unit?: string;
  benchmark?: number | string;
  benchmarkLabel?: string;
  status: 'green' | 'yellow' | 'red' | 'neutral';
  variationYoY?: number | null;
  formula?: string;
  category?: string;
}

const STATUS_CONFIG = {
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✅', label: 'Saludable' },
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '⚠️', label: 'Atención' },
  red: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', icon: '🔴', label: 'Crítico' },
  neutral: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: '⚪', label: 'Sin datos' },
};

export const RatioCard: React.FC<RatioCardProps> = ({
  code,
  name,
  value,
  unit,
  benchmarkLabel,
  status,
  variationYoY,
  formula,
}) => {
  const cfg = STATUS_CONFIG[status];
  const isNull = value === null || value === undefined;
  const displayValue = isNull ? '—'
    : Math.abs(value) >= 10000 ? `$${(value / 1000).toFixed(1)}K`
    : value.toFixed(2);

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 hover:shadow-md transition-all group`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-gray-400 font-bold">{code}</span>
          <h4 className="text-sm font-semibold text-gray-800 mt-0.5">{name}</h4>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold text-gray-900">{displayValue}</span>
        {unit && !isNull && <span className="text-sm text-gray-500">{unit}</span>}
      </div>

      <div className="flex items-center justify-between">
        {benchmarkLabel && (
          <span className="text-xs text-gray-500">
            Benchmark: <span className="font-medium text-gray-700">{benchmarkLabel}</span>
          </span>
        )}
        {variationYoY !== null && variationYoY !== undefined && (
          <span className={`text-xs font-semibold ${variationYoY >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {variationYoY >= 0 ? '↑' : '↓'} {Math.abs(variationYoY).toFixed(1)}% YoY
          </span>
        )}
      </div>

      {formula && (
        <div className="hidden group-hover:block mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 font-mono">{formula}</p>
        </div>
      )}
    </div>
  );
};

export default RatioCard;
