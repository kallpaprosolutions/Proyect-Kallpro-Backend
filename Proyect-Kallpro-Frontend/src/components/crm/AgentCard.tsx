import React from 'react';

interface AgentCardProps {
  agent: {
    code: string;
    name: string;
    model?: string;
    runsLast24h?: number;
    successRate?: number;
    avgLatencyMs?: number;
    totalCostUsd?: number;
    isActive?: boolean;
  };
  onInvoke?: (code: string) => void;
}

const AGENT_AVATARS: Record<string, string> = {
  router: '🤖',
  sdr: '👩‍💼',
  researcher: '🔍',
  copywriter: '✍️',
  closer: '🎯',
  success: '❤️',
};

const AGENT_COLORS: Record<string, { bg: string; border: string }> = {
  router: { bg: 'bg-gray-50', border: 'border-gray-200' },
  sdr: { bg: 'bg-blue-50', border: 'border-blue-200' },
  researcher: { bg: 'bg-purple-50', border: 'border-purple-200' },
  copywriter: { bg: 'bg-amber-50', border: 'border-amber-200' },
  closer: { bg: 'bg-red-50', border: 'border-red-200' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onInvoke }) => {
  const avatar = AGENT_AVATARS[agent.code] ?? '🤖';
  const colors = AGENT_COLORS[agent.code] ?? { bg: 'bg-gray-50', border: 'border-gray-200' };
  const successRate = agent.successRate ?? 0;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-5 space-y-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{avatar}</span>
          <div>
            <h3 className="font-bold text-gray-900">{agent.name}</h3>
            <p className="text-xs text-gray-500 font-mono">{agent.code}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          agent.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {agent.isActive !== false ? '● Activo' : '○ Inactivo'}
        </span>
      </div>

      {agent.model && (
        <p className="text-xs text-gray-400 font-mono">🧠 {agent.model}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">{agent.runsLast24h ?? 0}</p>
          <p className="text-xs text-gray-500">Runs 24h</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 text-center">
          <p className={`text-lg font-bold ${successRate >= 80 ? 'text-emerald-600' : successRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {successRate.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500">Éxito</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">{agent.avgLatencyMs ?? 0}ms</p>
          <p className="text-xs text-gray-500">Latencia</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">${(agent.totalCostUsd ?? 0).toFixed(4)}</p>
          <p className="text-xs text-gray-500">Costo</p>
        </div>
      </div>

      {onInvoke && (
        <button
          onClick={() => onInvoke(agent.code)}
          className="w-full text-sm py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
        >
          ⚡ Invocar ahora
        </button>
      )}
    </div>
  );
};

export default AgentCard;
