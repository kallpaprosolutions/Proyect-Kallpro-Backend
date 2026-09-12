import { ReactNode } from 'react';
import Sparkline from './Sparkline';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string | ReactNode;
  trend?: { value: string; positive?: boolean };
  /** Línea de contexto bajo el valor (ej. "vs. mes anterior", "meta: $50k") */
  subtitle?: string;
  /** Datos para mini-gráfico de tendencia */
  sparkline?: number[];
  color?: 'brand' | 'emerald' | 'blue' | 'purple' | 'amber' | 'red' | 'orange';
  className?: string;
  /** Índice para escalonar la animación de entrada */
  index?: number;
  onClick?: () => void;
}

const colorMap = {
  brand:   { bg: 'bg-brand-50 dark:bg-brand-900/30',     icon: 'text-brand-600 dark:text-brand-300',     spark: '#06b6d4' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-300', spark: '#10b981' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/30',       icon: 'text-blue-600 dark:text-blue-300',       spark: '#3b82f6' },
  purple:  { bg: 'bg-purple-50 dark:bg-purple-900/30',   icon: 'text-purple-600 dark:text-purple-300',   spark: '#8b5cf6' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/30',     icon: 'text-amber-600 dark:text-amber-300',     spark: '#f59e0b' },
  red:     { bg: 'bg-red-50 dark:bg-red-900/30',         icon: 'text-red-600 dark:text-red-300',         spark: '#ef4444' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-900/30',   icon: 'text-orange-600 dark:text-orange-300',   spark: '#f97316' },
};

export default function StatCard({
  label, value, icon, trend, subtitle, sparkline, color = 'brand',
  className = '', index = 0, onClick,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={[
        'bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700',
        'shadow-soft p-4 flex items-center gap-4 animate-fade-in-up',
        onClick ? 'cursor-pointer hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-600 transition-all' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${c.bg} ${c.icon}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold text-surface-900 dark:text-white mt-0.5 truncate">{value}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {trend && (
            <span className={`text-xs font-medium ${trend.positive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.positive !== false ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-surface-400 dark:text-surface-500 truncate">{subtitle}</span>
          )}
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="flex-shrink-0">
          <Sparkline data={sparkline} color={c.spark} width={72} height={28} />
        </div>
      )}
    </div>
  );
}
