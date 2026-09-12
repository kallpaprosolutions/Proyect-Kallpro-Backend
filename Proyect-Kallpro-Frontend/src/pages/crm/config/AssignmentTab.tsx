import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../../api/crm';
import { adminApi } from '../../../api/admin';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import { Shuffle } from 'lucide-react';
import { LabeledInput, LabeledSelect, Loading } from './StagesTab';

/**
 * Reglas de enrutamiento de leads, editables.
 *
 * Se evalúan de menor a mayor prioridad y gana la primera que casa, como un cortafuegos.
 * Ese orden se le explica al usuario en pantalla: sin saberlo, no puede razonar sobre
 * por qué un lead cayó donde cayó.
 */
export default function AssignmentTab() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['crm-assignment-rules'],
    queryFn: () => crmApi.listAssignmentRules().then(r => r.data),
  });
  const { data: meta } = useQuery({
    queryKey: ['crm-config-meta'],
    queryFn: () => crmApi.getConfigMeta().then(r => r.data),
  });
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-for-crm'],
    queryFn: () => adminApi.listUsers().then(r => r.data).catch(() => []),
  });

  const users: any[] = Array.isArray(usersData) ? usersData : (usersData?.users ?? []);
  const userOptions = users.map(u => ({
    value: u.id,
    label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
  }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm-assignment-rules'] });

  const create = useMutation({
    mutationFn: (data: any) => crmApi.createAssignmentRule(data).then(r => r.data),
    onSuccess: () => { invalidate(); setCreating(false); setDraft({}); },
  });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateAssignmentRule(id, data).then(r => r.data),
    onSuccess: () => { invalidate(); setEditingId(null); setDraft({}); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => crmApi.deleteAssignmentRule(id).then(r => r.data),
    onSuccess: invalidate,
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  if (isLoading) return <Loading />;

  const operators = meta?.operators ?? [];
  const fields = meta?.scorableFields ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500 dark:text-surface-400">
        Las reglas se revisan de menor a mayor número de prioridad y <strong>gana la primera
        que coincide</strong>. Si ninguna coincide, el lead cae al responsable por defecto
        del formulario, o queda sin asignar.
      </p>

      {rules.length === 0 && !creating ? (
        <Card>
          <EmptyState
            icon={<Shuffle className="w-10 h-10" />}
            title="Sin reglas de asignación"
            hint="Sin reglas, los leads quedan sin responsable salvo que el formulario tenga uno por defecto."
          >
            <Button className="mt-4" onClick={() => { setCreating(true); setDraft({ assignMode: 'ROUND_ROBIN', conditions: [] }); }}>
              Crear la primera regla
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule: any) => (
            <Card key={rule.id} padding="sm">
              {editingId === rule.id ? (
                <RuleForm
                  draft={{ ...rule, ...draft }}
                  setDraft={setDraft}
                  operators={operators}
                  fields={fields}
                  userOptions={userOptions}
                  error={errorOf(save)}
                  loading={save.isPending}
                  onSave={() => save.mutate({ id: rule.id, data: draft })}
                  onCancel={() => { setEditingId(null); setDraft({}); }}
                />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="neutral">#{rule.priority}</Badge>
                      <span className={`font-medium ${rule.isActive ? 'text-surface-900 dark:text-white' : 'text-surface-400 line-through'}`}>
                        {rule.name}
                      </span>
                      <Badge variant={rule.assignMode === 'ROUND_ROBIN' ? 'info' : 'brand'}>
                        {rule.assignMode === 'ROUND_ROBIN' ? 'Rotación' : 'Responsable fijo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {(rule.conditions ?? []).length === 0
                        ? 'Sin condiciones: aplica a todos los leads'
                        : (rule.conditions ?? []).map((c: any) =>
                            `${c.field} ${operators.find((o: any) => o.value === c.operator)?.label ?? c.operator} ${(c.value ?? []).join(' / ')}`,
                          ).join(' · ')}
                      {' · '}{rule.matchCount} asignación(es)
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(rule.id); setDraft({}); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(rule.id)}>Eliminar</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {creating ? (
        <Card padding="sm">
          <RuleForm
            draft={{ assignMode: 'ROUND_ROBIN', conditions: [], priority: 100, ...draft }}
            setDraft={setDraft}
            operators={operators}
            fields={fields}
            userOptions={userOptions}
            error={errorOf(create)}
            loading={create.isPending}
            onSave={() => create.mutate({ assignMode: 'ROUND_ROBIN', conditions: [], priority: 100, ...draft })}
            onCancel={() => { setCreating(false); setDraft({}); }}
          />
        </Card>
      ) : rules.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setCreating(true); setDraft({ assignMode: 'ROUND_ROBIN', conditions: [] }); }}
        >
          + Añadir regla
        </Button>
      )}
    </div>
  );
}

function RuleForm({ draft, setDraft, operators, fields, userOptions, onSave, onCancel, loading, error }: any) {
  const conditions: any[] = draft.conditions ?? [];

  const updateCondition = (i: number, patch: any) => {
    setDraft((d: any) => ({
      ...d,
      conditions: conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabeledInput label="Nombre" value={draft.name ?? ''} onChange={v => setDraft((d: any) => ({ ...d, name: v }))} />
        <LabeledInput
          label="Prioridad" type="number"
          value={String(draft.priority ?? 100)}
          onChange={v => setDraft((d: any) => ({ ...d, priority: Number(v) }))}
          hint="Menor número = se evalúa antes"
        />
        <LabeledSelect
          label="Modo de asignación"
          value={draft.assignMode}
          onChange={v => setDraft((d: any) => ({ ...d, assignMode: v }))}
          options={[
            { value: 'ROUND_ROBIN', label: 'Rotación entre un equipo' },
            { value: 'FIXED', label: 'Siempre a la misma persona' },
          ]}
        />
      </div>

      {draft.assignMode === 'FIXED' ? (
        <LabeledSelect
          label="Responsable"
          value={draft.ownerUserId ?? ''}
          onChange={v => setDraft((d: any) => ({ ...d, ownerUserId: v }))}
          options={[{ value: '', label: 'Selecciona una persona' }, ...userOptions]}
        />
      ) : (
        <div>
          <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
            Equipo (se asigna por turnos)
          </label>
          <div className="flex flex-wrap gap-2">
            {userOptions.map((u: any) => {
              const selected = (draft.poolUserIds ?? []).includes(u.value);
              return (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setDraft((d: any) => ({
                    ...d,
                    poolUserIds: selected
                      ? (d.poolUserIds ?? []).filter((id: string) => id !== u.value)
                      : [...(d.poolUserIds ?? []), u.value],
                  }))}
                  className={[
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    selected
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300',
                  ].join(' ')}
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
          Condiciones (deben cumplirse todas)
        </label>
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <LabeledSelect
                label="Campo" value={c.field ?? fields[0]?.value ?? ''}
                onChange={v => updateCondition(i, { field: v })} options={fields}
              />
              <LabeledSelect
                label="Condición" value={c.operator ?? 'EQUALS'}
                onChange={v => updateCondition(i, { operator: v })} options={operators}
              />
              <LabeledInput
                label="Valores" value={(c.value ?? []).join(', ')}
                onChange={v => updateCondition(i, { value: v.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              />
              <Button
                size="sm" variant="ghost"
                onClick={() => setDraft((d: any) => ({ ...d, conditions: conditions.filter((_, idx) => idx !== i) }))}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm" variant="outline" className="mt-2"
          onClick={() => setDraft((d: any) => ({
            ...d,
            conditions: [...conditions, { field: fields[0]?.value ?? 'city', operator: 'EQUALS', value: [] }],
          }))}
        >
          + Añadir condición
        </Button>
        {conditions.length === 0 && (
          <p className="text-xs text-surface-400 mt-2">
            Sin condiciones, esta regla se lleva todos los leads que lleguen hasta ella.
          </p>
        )}
      </div>

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
        <Button size="sm" loading={loading} disabled={!draft.name} onClick={onSave}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
