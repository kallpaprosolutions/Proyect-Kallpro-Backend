import React from 'react';

interface KPITileProps {
  label: string;
  value: number | null;
  unit?: string;
  status?: 'green' | 'yellow' | 'red' | 'neutral';
  trend?: number | null;
  formula?: string;
  benchmark?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_COLORS = {
  green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  yellow: 'bg-amber-50 border-amber-200 text-amber-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  neutral: 'bg-gray-50 border-gray-200 text-gray-600',
};

const STATUS_DOT = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  neutral: 'bg-gray-400',
};

export const KPITile: React.FC<KPITileProps> = ({
  label,
  value,
  unit,
  status = 'neutral',
  trend,
  formula,
  benchmark,
  size = 'md',
}) => {
  const isNull = value === null || value === undefined;
  const displayValue = isNull ? '—' : typeof value === 'number'
    ? (Math.abs(value) >= 1000 ? value.toLocaleString('es-EC', { maximumFractionDigits: 0 }) : value.toFixed(2))
    : value;

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className={`rounded-xl border ${STATUS_COLORS[status]} ${sizeClasses[size]} relative group transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70 leading-tight">{label}</p>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className={`font-bold ${valueSizeClasses[size]}`}>{displayValue}</span>
        {unit && !isNull && <span className="text-sm opacity-60">{unit}</span>}
      </div>

      {(trend !== null && trend !== undefined) && (
        <div className="mt-1 flex items-center gap-1">
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs opacity-50">vs. período anterior</span>
        </div>
      )}

      {(formula || benchmark) && (
        <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 z-10 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl min-w-48 max-w-64">
          {formula && (
            <div className="mb-1">
              <span className="text-gray-400">Fórmula: </span>
              <span className="font-mono">{formula}</span>
            </div>
          )}
          {benchmark && (
            <div>
              <span className="text-gray-400">Benchmark: </span>
              <span>{benchmark}</span>
            </div>
          )}
          <div className="absolute bottom-0 left-4 translate-y-full border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default KPITile;
