import React from 'react';

interface AIInsight {
  title: string;
  finding: string;
  cause: string;
  impactUsd: number;
  action: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  kpiCode?: string;
}

interface AIInsightCardProps {
  insight: AIInsight;
  index?: number;
}

const PRIORITY_CONFIG = {
  high: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: '🔴', label: 'Alta Prioridad' },
  medium: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '🟡', label: 'Media Prioridad' },
  low: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🔵', label: 'Baja Prioridad' },
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({ insight, index = 0 }) => {
  const cfg = PRIORITY_CONFIG[insight.priority];

  return (
    <div className={`rounded-xl border-2 ${cfg.bg} p-5 space-y-3 transition-all hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{insight.title}</h3>
            {insight.kpiCode && (
              <span className="text-xs font-mono text-gray-500">KPI: {insight.kpiCode}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.icon} {cfg.label}
          </span>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            ${insight.impactUsd.toLocaleString()} USD
          </span>
        </div>
      </div>

      {/* Finding */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hallazgo</p>
        <p className="text-sm text-gray-700">{insight.finding}</p>
      </div>

      {/* Cause */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Causa probable</p>
        <p className="text-sm text-gray-600">{insight.cause}</p>
      </div>

      {/* Action */}
      <div className="rounded-lg bg-white border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">✅ Acción recomendada</p>
        <p className="text-sm font-medium text-gray-800">{insight.action}</p>
        <p className="text-xs text-gray-500 mt-1">⏱ Plazo: <span className="font-semibold">{insight.deadline}</span></p>
      </div>
    </div>
  );
};

export default AIInsightCard;
