import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { crmApi } from '../../api/crm';
import { AgentCard } from '../../components/crm/AgentCard';

const AGENT_CODES = ['router', 'sdr', 'researcher', 'copywriter', 'closer', 'success'];

export default function AgentsView() {
  const [invokeModal, setInvokeModal] = useState<string | null>(null);
  const [invokeContext, setInvokeContext] = useState('');
  const [invokeResult, setInvokeResult] = useState<any>(null);

  const agentMetrics = useQuery({
    queryKey: ['crm-agents-all-metrics'],
    queryFn: async () => {
      const results = await Promise.all(
        AGENT_CODES.map(code =>
          crmApi.getAgentMetrics(code).then(r => ({ code, ...r.data })).catch(() => ({ code, runs: { total: 0, successRate: 0, avgLatencyMs: 0, totalCostUsd: 0 }, recentRuns: [] })),
        ),
      );
      return results;
    },
    refetchInterval: 30000,
  });

  const invokeMutation = useMutation({
    mutationFn: ({ code, context }: { code: string; context: any }) =>
      crmApi.invokeAgent(code, context).then(r => r.data),
    onSuccess: (data) => setInvokeResult(data),
  });

  const handleInvoke = () => {
    if (!invokeModal) return;
    try {
      const ctx = invokeContext ? JSON.parse(invokeContext) : {};
      invokeMutation.mutate({ code: invokeModal, context: ctx });
    } catch {
      invokeMutation.mutate({ code: invokeModal, context: { messageBody: invokeContext } });
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🤖</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Agentes IA</h1>
          <p className="text-sm text-surface-500">6 agentes especializados · Claude API + Ollama fallback</p>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentMetrics.data?.map((metrics: any) => (
            <AgentCard
              key={metrics.code}
              agent={{
                code: metrics.code,
                name: metrics.code === 'router' ? 'Router IA' :
                  metrics.code === 'sdr' ? 'Sofía SDR' :
                  metrics.code === 'researcher' ? 'Iván Researcher' :
                  metrics.code === 'copywriter' ? 'Camila Copywriter' :
                  metrics.code === 'closer' ? 'Andrés Closer' : 'Lucía Success',
                model: metrics.code === 'router' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514',
                runsLast24h: metrics.runs?.total ?? 0,
                successRate: metrics.runs?.successRate ?? 0,
                avgLatencyMs: metrics.runs?.avgLatencyMs ?? 0,
                totalCostUsd: metrics.runs?.totalCostUsd ?? 0,
                isActive: true,
              }}
              onInvoke={(code) => {
                setInvokeModal(code);
                setInvokeResult(null);
                setInvokeContext('');
              }}
            />
          ))}
          {agentMetrics.isLoading && (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border-2 border-gray-200 bg-gray-50 p-5 animate-pulse h-48" />
            ))
          )}
        </div>
      </div>

      {/* Invoke Modal */}
      {invokeModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 p-6 w-full max-w-lg fade-in">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">⚡ Invocar {invokeModal}</h2>

            <div className="mb-4">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">
                Contexto (JSON o texto libre):
              </label>
              <textarea
                value={invokeContext}
                onChange={e => setInvokeContext(e.target.value)}
                placeholder='{"messageBody": "Hola, me interesa cotizar el sistema", "contactId": "..."}'
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-xl p-3 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono resize-none"
              />
            </div>

            {invokeResult && (
              <div className="mb-4 bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p className="text-xs font-semibold text-surface-500 mb-2">Resultado:</p>
                <p className="text-sm text-surface-800 dark:text-surface-200 whitespace-pre-wrap">{invokeResult.output ?? JSON.stringify(invokeResult, null, 2)}</p>
                {invokeResult.toolsCalled?.length > 0 && (
                  <p className="text-xs text-surface-400 mt-2">Tools: {invokeResult.toolsCalled.join(', ')}</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleInvoke}
                disabled={invokeMutation.isPending}
                className="flex-1 bg-brand-500 text-white py-2.5 rounded-xl font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {invokeMutation.isPending ? '⏳ Procesando...' : '⚡ Invocar'}
              </button>
              <button
                onClick={() => { setInvokeModal(null); setInvokeResult(null); }}
                className="px-4 py-2.5 bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-xl font-medium hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
