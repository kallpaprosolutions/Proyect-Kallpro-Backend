import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../../api/crm';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { FORECAST_CATEGORY_LABELS } from '../../../lib/crmLabels';

/**
 * Etapas del pipeline, editables.
 *
 * Aquí es donde el usuario ajusta la probabilidad real de cada etapa según su historia
 * de conversión. Antes eran constantes en `deal.service.ts`; ahora el pronóstico las lee
 * de la base de datos, así que cambiar un 50 % a 20 % se refleja de inmediato.
 */
export default function StagesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [creating, setCreating] = useState(false);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: () => crmApi.listStages().then(r => r.data),
  });

  const { data: meta } = useQuery({
    queryKey: ['crm-config-meta'],
    queryFn: () => crmApi.getConfigMeta().then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['crm-stages'] });
    qc.invalidateQueries({ queryKey: ['crm-forecast'] });
  };

  const save = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateStage(id, data).then(r => r.data),
    onSuccess: () => { invalidate(); setEditing(null); },
  });

  const create = useMutation({
    mutationFn: (data: any) => crmApi.createStage(data).then(r => r.data),
    onSuccess: () => { invalidate(); setCreating(false); setDraft({}); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => crmApi.deleteStage(id).then(r => r.data),
    onSuccess: invalidate,
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  const categories = meta?.forecastCategories ?? [];

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500 dark:text-surface-400">
        La probabilidad y la categoría de cada etapa alimentan directamente el pronóstico.
        Ajústalas con tu tasa real de conversión, no con la que trae el sistema.
      </p>

      {(remove.error || save.error || create.error) && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorOf(remove) ?? errorOf(save) ?? errorOf(create)}
        </div>
      )}

      <div className="space-y-2">
        {stages.map((stage: any) => (
          <Card key={stage.id} padding="sm">
            {editing === stage.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LabeledInput
                    label="Nombre visible"
                    value={draft.name ?? stage.name}
                    onChange={v => setDraft({ ...draft, name: v })}
                  />
                  <LabeledInput
                    label="Probabilidad (%)"
                    type="number"
                    value={String(draft.probability ?? stage.probability)}
                    onChange={v => setDraft({ ...draft, probability: Number(v) })}
                  />
                  <LabeledSelect
                    label="Categoría de pronóstico"
                    value={draft.forecastCategory ?? stage.forecastCategory}
                    onChange={v => setDraft({ ...draft, forecastCategory: v })}
                    options={categories}
                  />
                  <LabeledInput
                    label="Días objetivo en la etapa"
                    type="number"
                    value={String(draft.targetDays ?? stage.targetDays)}
                    onChange={v => setDraft({ ...draft, targetDays: Number(v) })}
                    hint="Por encima de este valor la oportunidad se marca estancada"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
                    Criterios de entrada
                  </label>
                  <textarea
                    rows={2}
                    value={draft.entryCriteria ?? stage.entryCriteria ?? ''}
                    onChange={e => setDraft({ ...draft, entryCriteria: e.target.value })}
                    placeholder="Qué debe cumplirse para mover una oportunidad a esta etapa"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                  />
                  <p className="text-xs text-surface-400 mt-1">
                    Documentar esto es la palanca que más mejora la precisión del pronóstico.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={save.isPending}
                    onClick={() => save.mutate({ id: stage.id, data: draft })}
                  >
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft({}); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-surface-900 dark:text-white">{stage.name}</span>
                      <Badge variant="neutral">{stage.probability} %</Badge>
                      <Badge variant={stage.forecastCategory === 'COMMIT' ? 'success' : 'info'}>
                        {FORECAST_CATEGORY_LABELS[stage.forecastCategory] ?? stage.forecastCategory}
                      </Badge>
                      {stage.isWon && <Badge variant="success">Ganada</Badge>}
                      {stage.isLost && <Badge variant="error">Perdida</Badge>}
                      {!stage.isActive && <Badge variant="neutral">Inactiva</Badge>}
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5 truncate">
                      código <code>{stage.code}</code> · objetivo {stage.targetDays} días
                      {stage.entryCriteria ? ` · ${stage.entryCriteria}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(stage.id); setDraft({}); }}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(stage.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {creating ? (
        <Card padding="sm">
          <h3 className="font-medium text-surface-900 dark:text-white mb-3">Nueva etapa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput
              label="Código"
              value={draft.code ?? ''}
              onChange={v => setDraft({ ...draft, code: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              hint="Solo minúsculas, números y guion bajo. No se puede cambiar después."
            />
            <LabeledInput label="Nombre visible" value={draft.name ?? ''} onChange={v => setDraft({ ...draft, name: v })} />
            <LabeledInput
              label="Probabilidad (%)"
              type="number"
              value={String(draft.probability ?? 10)}
              onChange={v => setDraft({ ...draft, probability: Number(v) })}
            />
            <LabeledSelect
              label="Categoría de pronóstico"
              value={draft.forecastCategory ?? 'PIPELINE'}
              onChange={v => setDraft({ ...draft, forecastCategory: v })}
              options={categories}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!draft.code || !draft.name}
              onClick={() => create.mutate({ probability: 10, forecastCategory: 'PIPELINE', ...draft })}
            >
              Crear etapa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setDraft({}); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { setCreating(true); setDraft({}); }}>
          + Añadir etapa
        </Button>
      )}
    </div>
  );
}

export function LabeledInput({ label, value, onChange, type = 'text', hint, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
      />
      {hint && <p className="text-xs text-surface-400 mt-1">{hint}</p>}
    </div>
  );
}

export function LabeledSelect({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-surface-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );
}
