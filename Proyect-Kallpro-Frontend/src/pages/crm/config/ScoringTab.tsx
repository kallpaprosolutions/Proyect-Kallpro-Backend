import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../../api/crm';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { LabeledInput, LabeledSelect, Loading } from './StagesTab';
import { SCORING_CATEGORY_LABELS } from '../../../lib/crmLabels';

/**
 * Reglas y umbrales de puntaje de leads, editables.
 *
 * Se agrupan por categoría porque perfil e interacción cuentan historias distintas y el
 * usuario tiene que verlas separadas para calibrarlas: un lead con perfil alto e
 * interacción baja necesita marketing; al revés, es ruido.
 */
const CATEGORY_ORDER = ['FIT', 'ENGAGEMENT', 'NEGATIVE'] as const;

export default function ScoringTab() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<any>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['crm-scoring-rules'],
    queryFn: () => crmApi.listScoringRules().then(r => r.data),
  });
  const { data: config } = useQuery({
    queryKey: ['crm-scoring-config'],
    queryFn: () => crmApi.getScoringConfig().then(r => r.data),
  });
  const { data: meta } = useQuery({
    queryKey: ['crm-config-meta'],
    queryFn: () => crmApi.getConfigMeta().then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['crm-scoring-rules'] });
    qc.invalidateQueries({ queryKey: ['crm-scoring-config'] });
  };

  const saveConfig = useMutation({
    mutationFn: (data: any) => crmApi.updateScoringConfig(data).then(r => r.data),
    onSuccess: () => { invalidate(); setConfigDraft({}); },
  });
  const saveRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateScoringRule(id, data).then(r => r.data),
    onSuccess: () => { invalidate(); setEditingId(null); setDraft({}); },
  });
  const createRule = useMutation({
    mutationFn: (data: any) => crmApi.createScoringRule(data).then(r => r.data),
    onSuccess: () => { invalidate(); setCreatingIn(null); setDraft({}); },
  });
  const deleteRule = useMutation({
    mutationFn: (id: string) => crmApi.deleteScoringRule(id).then(r => r.data),
    onSuccess: invalidate,
  });
  const resetRules = useMutation({
    mutationFn: () => crmApi.resetScoringRules().then(r => r.data),
    onSuccess: invalidate,
  });
  const rescoreAll = useMutation({
    mutationFn: () => crmApi.rescoreAllLeads().then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  if (isLoading || !config) return <Loading />;

  const cfg = { ...config, ...configDraft };
  const operators = meta?.operators ?? [];
  const fields = meta?.scorableFields ?? [];

  return (
    <div className="space-y-6">
      {/* ── Umbrales y pesos ── */}
      <Card>
        <h3 className="font-semibold text-surface-900 dark:text-white mb-1">Umbrales y pesos</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
          Los pesos de perfil e interacción deben sumar 100. Los umbrales deciden cuándo un
          lead pasa de simple contacto a MQL y luego a SQL.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LabeledInput
            label="Peso del perfil (%)" type="number"
            value={String(cfg.fitWeight)}
            onChange={v => setConfigDraft({ ...configDraft, fitWeight: Number(v), engagementWeight: 100 - Number(v) })}
          />
          <LabeledInput
            label="Peso de la interacción (%)" type="number"
            value={String(cfg.engagementWeight)}
            onChange={v => setConfigDraft({ ...configDraft, engagementWeight: Number(v), fitWeight: 100 - Number(v) })}
          />
          <LabeledInput
            label="Media vida (días)" type="number"
            value={String(cfg.halfLifeDays)}
            onChange={v => setConfigDraft({ ...configDraft, halfLifeDays: Number(v) })}
            hint="A los N días, un evento vale la mitad"
          />
          <LabeledInput
            label="Umbral MQL" type="number"
            value={String(cfg.mqlThreshold)}
            onChange={v => setConfigDraft({ ...configDraft, mqlThreshold: Number(v) })}
          />
          <LabeledInput
            label="Umbral SQL" type="number"
            value={String(cfg.sqlThreshold)}
            onChange={v => setConfigDraft({ ...configDraft, sqlThreshold: Number(v) })}
          />
          <LabeledInput
            label="Grado A desde" type="number"
            value={String(cfg.gradeAThreshold)}
            onChange={v => setConfigDraft({ ...configDraft, gradeAThreshold: Number(v) })}
          />
          <LabeledInput
            label="Grado B desde" type="number"
            value={String(cfg.gradeBThreshold)}
            onChange={v => setConfigDraft({ ...configDraft, gradeBThreshold: Number(v) })}
          />
          <LabeledInput
            label="Caliente desde" type="number"
            value={String(cfg.hotThreshold)}
            onChange={v => setConfigDraft({ ...configDraft, hotThreshold: Number(v) })}
          />
        </div>

        {errorOf(saveConfig) && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3">{errorOf(saveConfig)}</p>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            loading={saveConfig.isPending}
            disabled={Object.keys(configDraft).length === 0}
            onClick={() => saveConfig.mutate(configDraft)}
          >
            Guardar umbrales
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={rescoreAll.isPending}
            onClick={() => rescoreAll.mutate()}
            title="Vuelve a puntuar todos los leads abiertos con la configuración actual"
          >
            Aplicar a los leads existentes
          </Button>
          {rescoreAll.data && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 self-center">
              {rescoreAll.data.recalculados} lead(s) recalculados
            </span>
          )}
        </div>
      </Card>

      {/* ── Reglas por categoría ── */}
      {CATEGORY_ORDER.map(category => {
        const catRules = rules.filter((r: any) => r.category === category);
        const catMeta = meta?.scoringCategories?.find((c: any) => c.value === category);

        return (
          <Card key={category}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-surface-900 dark:text-white">
                  {catMeta?.label ?? SCORING_CATEGORY_LABELS[category]}
                </h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">{catMeta?.help}</p>
              </div>
              <Badge variant="neutral">{catRules.length} regla(s)</Badge>
            </div>

            <div className="space-y-2">
              {catRules.map((rule: any) => (
                <div key={rule.id} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                  {editingId === rule.id ? (
                    <RuleForm
                      draft={{ ...rule, ...draft }}
                      setDraft={setDraft}
                      operators={operators}
                      fields={fields}
                      category={category}
                      error={errorOf(saveRule)}
                      loading={saveRule.isPending}
                      onSave={() => saveRule.mutate({ id: rule.id, data: draft })}
                      onCancel={() => { setEditingId(null); setDraft({}); }}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${rule.isActive ? 'text-surface-900 dark:text-white' : 'text-surface-400 line-through'}`}>
                            {rule.name}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums ${category === 'NEGATIVE' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {category === 'NEGATIVE' ? '−' : '+'}{rule.points}
                          </span>
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5 truncate">
                          {rule.field} · {operators.find((o: any) => o.value === rule.operator)?.label ?? rule.operator}
                          {rule.value?.length ? ` · ${rule.value.join(', ')}` : ''}
                          {rule.maxPoints ? ` · tope ${rule.maxPoints}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(rule.id); setDraft({}); }}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(rule.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {creatingIn === category ? (
              <div className="mt-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                <RuleForm
                  draft={{ category, operator: 'CONTAINS', points: 10, value: [], ...draft }}
                  setDraft={setDraft}
                  operators={operators}
                  fields={fields}
                  category={category}
                  error={errorOf(createRule)}
                  loading={createRule.isPending}
                  onSave={() => createRule.mutate({ category, operator: 'CONTAINS', points: 10, value: [], ...draft })}
                  onCancel={() => { setCreatingIn(null); setDraft({}); }}
                />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => { setCreatingIn(category); setDraft({}); }}
              >
                + Añadir regla
              </Button>
            )}
          </Card>
        );
      })}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          loading={resetRules.isPending}
          onClick={() => resetRules.mutate()}
        >
          Restaurar el juego de reglas recomendado
        </Button>
        <span className="text-xs text-surface-400">Reemplaza todas las reglas actuales.</span>
      </div>
    </div>
  );
}

function RuleForm({ draft, setDraft, operators, fields, category, onSave, onCancel, loading, error }: any) {
  const isEventRule = draft.operator === 'EVENT_COUNT';

  return (
    <div className="space-y-3">
      <LabeledInput label="Nombre de la regla" value={draft.name ?? ''} onChange={v => setDraft((d: any) => ({ ...d, name: v }))} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isEventRule ? (
          <LabeledInput
            label="Tipo de evento"
            value={draft.field ?? ''}
            onChange={v => setDraft((d: any) => ({ ...d, field: v }))}
            placeholder="pricing_view, demo_request…"
          />
        ) : (
          <LabeledSelect
            label="Campo"
            value={draft.field ?? fields[0]?.value ?? ''}
            onChange={v => setDraft((d: any) => ({ ...d, field: v }))}
            options={fields}
          />
        )}
        <LabeledSelect
          label="Condición"
          value={draft.operator}
          onChange={v => setDraft((d: any) => ({ ...d, operator: v }))}
          options={operators}
        />
        <LabeledInput
          label={category === 'NEGATIVE' ? 'Puntos a restar' : 'Puntos a sumar'}
          type="number"
          value={String(draft.points ?? 0)}
          onChange={v => setDraft((d: any) => ({ ...d, points: Number(v) }))}
        />
      </div>

      {!['EXISTS', 'NOT_EXISTS'].includes(draft.operator) && (
        <LabeledInput
          label={isEventRule ? 'Mínimo de ocurrencias' : 'Valores (separados por coma)'}
          value={(draft.value ?? []).join(', ')}
          onChange={v => setDraft((d: any) => ({ ...d, value: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))}
          hint={isEventRule ? undefined : 'Basta con que coincida cualquiera de ellos'}
        />
      )}

      {category === 'ENGAGEMENT' && (
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="Tope de puntos" type="number"
            value={String(draft.maxPoints ?? '')}
            onChange={v => setDraft((d: any) => ({ ...d, maxPoints: v ? Number(v) : null }))}
            hint="Máximo aunque el evento se repita"
          />
          <LabeledInput
            label="Media vida propia (días)" type="number"
            value={String(draft.halfLifeDays ?? '')}
            onChange={v => setDraft((d: any) => ({ ...d, halfLifeDays: v ? Number(v) : null }))}
            hint="Vacío = usa la media vida global"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
        <input
          type="checkbox"
          checked={draft.isActive !== false}
          onChange={e => setDraft((d: any) => ({ ...d, isActive: e.target.checked }))}
          className="rounded border-surface-300"
        />
        Regla activa
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" loading={loading} disabled={!draft.name || !draft.field} onClick={onSave}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
