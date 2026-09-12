import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../../api/crm';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import { Bot } from 'lucide-react';
import { LabeledSelect, LabeledInput, Loading } from './StagesTab';
import { AGENT_NAMES, AUTONOMY_LABELS } from '../../../lib/crmLabels';

/**
 * Editor de los agentes de IA.
 *
 * Es la primera vez que la instrucción del agente (`systemPrompt`), su modelo, su
 * temperatura y su nivel de autonomía se pueden cambiar sin tocar la base de datos.
 *
 * Se avisa con claridad de que un agente en piloto automático habla con clientes reales:
 * el editor no es un juguete y el usuario tiene que saberlo antes de guardar.
 */
export default function AgentsTab() {
  const qc = useQueryClient();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['crm-agents'],
    queryFn: () => crmApi.listAgents().then(r => r.data),
  });
  const { data: meta } = useQuery({
    queryKey: ['crm-config-meta'],
    queryFn: () => crmApi.getConfigMeta().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: ({ code, data }: { code: string; data: any }) => crmApi.updateAgent(code, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-agents'] });
      qc.invalidateQueries({ queryKey: ['crm-agent-full'] });
      setDraft({});
    },
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  if (isLoading) return <Loading />;

  if (agents.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Bot className="w-10 h-10" />}
          title="No hay agentes configurados para esta empresa"
          hint="Los seis agentes (ruteador, SDR, investigador, redactor, cierre y éxito) se siembran al activar el módulo de IA del CRM."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        Lo que escribas aquí es lo que el agente le dirá a clientes reales. En modo
        <strong> piloto automático</strong> responde sin que nadie revise. Si tienes dudas,
        usa <strong>Redacta y espera aprobación</strong> mientras calibras la instrucción.
      </div>

      <div className="space-y-2">
        {agents.map((agent: any) => {
          const info = AGENT_NAMES[agent.code] ?? { name: agent.name, icon: '🤖', role: '' };
          const isOpen = openCode === agent.code;

          return (
            <Card key={agent.id} padding="sm">
              <button
                onClick={() => { setOpenCode(isOpen ? null : agent.code); setDraft({}); }}
                className="w-full flex items-center justify-between gap-3 text-left"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0" aria-hidden>{info.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-surface-900 dark:text-white">{agent.name ?? info.name}</span>
                      <Badge variant={agent.isActive ? 'success' : 'neutral'}>
                        {agent.isActive ? 'Activo' : 'Desactivado'}
                      </Badge>
                      <Badge variant="info">{AUTONOMY_LABELS[agent.autonomyDefault] ?? agent.autonomyDefault}</Badge>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5 truncate">{info.role}</p>
                  </div>
                </div>
                <span className="text-surface-400 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <AgentEditor
                  code={agent.code}
                  meta={meta}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={(data: any) => save.mutate({ code: agent.code, data })}
                  saving={save.isPending}
                  saved={save.isSuccess}
                  error={errorOf(save)}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AgentEditor({ code, meta, draft, setDraft, onSave, saving, saved, error }: any) {
  const { data: metrics } = useQuery({
    queryKey: ['crm-agent-detail', code],
    queryFn: () => crmApi.getAgentMetrics(code).then(r => r.data),
  });

  // El listado omite la instrucción del sistema porque es pesada; se pide aparte.
  const { data: full } = useQuery({
    queryKey: ['crm-agent-full', code],
    queryFn: () => crmApi.getAgentConfig(code).then(r => r.data),
  });

  const current = { ...(full ?? {}), ...draft };
  const hasChanges = Object.keys(draft).length > 0;

  return (
    <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 space-y-4">
      {metrics?.runs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric label="Ejecuciones (24 h)" value={metrics.runs.total} />
          <Metric label="Éxito" value={`${metrics.runs.successRate} %`} />
          <Metric label="Latencia media" value={`${metrics.runs.avgLatencyMs} ms`} />
          <Metric label="Costo (24 h)" value={`$${metrics.runs.totalCostUsd}`} />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
          Instrucción del agente
        </label>
        <textarea
          rows={10}
          value={current.systemPrompt ?? ''}
          onChange={e => setDraft({ ...draft, systemPrompt: e.target.value })}
          placeholder="Describe quién es el agente, qué debe hacer, qué NO debe hacer y cuándo escalar a un humano."
          className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
        />
        <p className="text-xs text-surface-400 mt-1">
          Incluye siempre los límites: qué no puede prometer, qué descuentos no puede dar y
          cuándo debe pasar la conversación a una persona.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledSelect
          label="Modelo"
          value={current.model ?? ''}
          onChange={v => setDraft({ ...draft, model: v })}
          options={meta?.agentModels ?? []}
          hint="Modelos más capaces cuestan más por conversación"
        />
        <LabeledSelect
          label="Nivel de autonomía"
          value={current.autonomyDefault ?? 'setter_closer'}
          onChange={v => setDraft({ ...draft, autonomyDefault: v })}
          options={(meta?.autonomyModes ?? []).map((m: any) => ({ value: m.value, label: m.label }))}
        />
        <LabeledInput
          label="Temperatura (0 a 1)"
          type="number"
          value={String(current.temperature ?? 0.5)}
          onChange={v => setDraft({ ...draft, temperature: Number(v) })}
          hint="Más baja = respuestas más predecibles"
        />
        <LabeledInput
          label="Máximo de tokens"
          type="number"
          value={String(current.maxTokens ?? 1500)}
          onChange={v => setDraft({ ...draft, maxTokens: Number(v) })}
          hint="Largo máximo de cada respuesta"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
        <input
          type="checkbox"
          checked={current.isActive !== false}
          onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
          className="rounded border-surface-300"
        />
        Agente activo
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 items-center">
        <Button size="sm" loading={saving} disabled={!hasChanges} onClick={() => onSave(draft)}>
          Guardar agente
        </Button>
        {hasChanges && (
          <Button size="sm" variant="ghost" onClick={() => setDraft({})}>Descartar cambios</Button>
        )}
        {saved && !hasChanges && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado</span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface-50 dark:bg-surface-900/40 px-3 py-2">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}
