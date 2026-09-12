import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../../api/crm';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import { FileText } from 'lucide-react';
import { LabeledInput, LabeledSelect, Loading } from './StagesTab';

/**
 * Formularios de captura web, editables.
 *
 * El usuario define los campos aquí y el backend valida contra esa definición: no hay
 * que desplegar nada para añadir una pregunta. Se recomiendan 3–5 campos visibles porque
 * cada campo extra cuesta conversión.
 */
export default function FormsTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['crm-forms'],
    queryFn: () => crmApi.listForms().then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm-forms'] });

  const create = useMutation({
    mutationFn: (name: string) => crmApi.createForm({ name }).then(r => r.data),
    onSuccess: (form: any) => { invalidate(); setCreating(false); setNewName(''); setSelectedId(form.id); },
  });

  if (isLoading) return <Loading />;

  if (selectedId) {
    return <FormEditor formId={selectedId} onBack={() => { setSelectedId(null); invalidate(); }} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500 dark:text-surface-400">
        Cada formulario genera una clave pública para incrustar en tu sitio. Captura la
        atribución (campaña, fuente, página) automáticamente y puntúa el lead al entrar.
      </p>

      {forms.length === 0 && !creating ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            title="Aún no tienes formularios"
            hint="Crea uno y pega el fragmento en tu sitio web para empezar a capturar leads."
          >
            <Button className="mt-4" onClick={() => setCreating(true)}>Crear formulario</Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {forms.map((form: any) => (
            <Card key={form.id} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-900 dark:text-white">{form.name}</span>
                    <Badge variant={form.isActive ? 'success' : 'neutral'}>
                      {form.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {form._count?.leads ?? 0} lead(s) capturados · {form.submissionCount} envío(s) ·{' '}
                    <code>{form.publicKey}</code>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedId(form.id)}>Configurar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating ? (
        <Card padding="sm">
          <LabeledInput
            label="Nombre del formulario"
            value={newName}
            onChange={setNewName}
            placeholder="Contacto desde la web"
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" loading={create.isPending} disabled={!newName.trim()} onClick={() => create.mutate(newName)}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </Card>
      ) : forms.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>+ Nuevo formulario</Button>
      )}
    </div>
  );
}

function FormEditor({ formId, onBack }: { formId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<any>({});
  const [copied, setCopied] = useState(false);

  const { data: form, isLoading } = useQuery({
    queryKey: ['crm-form', formId],
    queryFn: () => crmApi.getForm(formId).then(r => r.data),
  });
  const { data: meta } = useQuery({
    queryKey: ['crm-config-meta'],
    queryFn: () => crmApi.getConfigMeta().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (data: any) => crmApi.updateForm(formId, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-form', formId] }); setDraft({}); },
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  if (isLoading || !form) return <Loading />;

  const current = { ...form, ...draft };
  const fields: any[] = current.fields ?? [];
  const mappable = meta?.mappableLeadFields ?? [];
  const fieldTypes = (meta?.fieldTypes ?? []).map((t: string) => ({ value: t, label: t }));

  const updateField = (index: number, patch: any) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setDraft({ ...draft, fields: next });
  };
  const removeField = (index: number) => {
    setDraft({ ...draft, fields: fields.filter((_, i) => i !== index) });
  };
  const addField = () => {
    setDraft({
      ...draft,
      fields: [...fields, { key: `campo_${fields.length + 1}`, label: 'Nuevo campo', type: 'text', required: false }],
    });
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
        ← Volver a los formularios
      </button>

      <Card>
        <h3 className="font-semibold text-surface-900 dark:text-white mb-3">Datos generales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label="Nombre" value={current.name ?? ''} onChange={v => setDraft({ ...draft, name: v })} />
          <LabeledInput
            label="Mensaje de éxito"
            value={current.successMessage ?? ''}
            onChange={v => setDraft({ ...draft, successMessage: v })}
          />
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
            Texto de consentimiento
          </label>
          <textarea
            rows={2}
            value={current.consentText ?? ''}
            onChange={e => setDraft({ ...draft, consentText: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
          />
          <p className="text-xs text-surface-400 mt-1">
            Requerido por la Ley Orgánica de Protección de Datos Personales de Ecuador.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <Toggle
            label="Formulario activo"
            checked={current.isActive}
            onChange={v => setDraft({ ...draft, isActive: v })}
          />
          <Toggle
            label="Exigir consentimiento"
            checked={current.requireConsent}
            onChange={v => setDraft({ ...draft, requireConsent: v })}
          />
          <Toggle
            label="Asignar por reglas"
            checked={current.autoAssign}
            onChange={v => setDraft({ ...draft, autoAssign: v })}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-white">Campos</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              De 3 a 5 campos visibles convierte mejor. Debe haber al menos correo o teléfono.
            </p>
          </div>
          <Badge variant="neutral">{fields.length}</Badge>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={i} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <LabeledInput label="Clave" value={field.key} onChange={v => updateField(i, { key: v })} />
                <LabeledInput label="Etiqueta" value={field.label} onChange={v => updateField(i, { label: v })} />
                <LabeledSelect
                  label="Tipo" value={field.type}
                  onChange={v => updateField(i, { type: v })}
                  options={fieldTypes}
                />
                <LabeledSelect
                  label="Guarda en"
                  value={field.mapsTo ?? ''}
                  onChange={v => updateField(i, { mapsTo: v || undefined })}
                  options={[{ value: '', label: 'Campo personalizado' }, ...mappable]}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <Toggle
                  label="Obligatorio"
                  checked={!!field.required}
                  onChange={v => updateField(i, { required: v })}
                />
                <Button size="sm" variant="ghost" onClick={() => removeField(i)}>Quitar</Button>
              </div>
            </div>
          ))}
        </div>

        <Button size="sm" variant="outline" className="mt-3" onClick={addField}>+ Añadir campo</Button>
      </Card>

      {errorOf(save) && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorOf(save)}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          loading={save.isPending}
          disabled={Object.keys(draft).length === 0}
          onClick={() => save.mutate(draft)}
        >
          Guardar cambios
        </Button>
        {save.isSuccess && Object.keys(draft).length === 0 && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 self-center">Guardado</span>
        )}
      </div>

      <Card>
        <h3 className="font-semibold text-surface-900 dark:text-white mb-2">Código para tu sitio web</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
          Pega esto en la página donde quieras el formulario. Captura la atribución (UTM,
          referente, página de destino) sola y trae protección contra bots incluida.
        </p>
        <pre className="text-xs bg-surface-900 text-surface-100 rounded-lg p-4 overflow-x-auto max-h-72">
          {form.embedSnippet}
        </pre>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(form.embedSnippet ?? '');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copiado' : 'Copiar código'}
        </Button>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-surface-300"
      />
      {label}
    </label>
  );
}
