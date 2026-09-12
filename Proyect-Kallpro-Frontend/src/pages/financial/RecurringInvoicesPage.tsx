import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, Plus, Play, Pencil } from 'lucide-react';
import { recurringInvoicesApi, RecurringInvoiceTemplate, RecurringInvoiceTemplateInput } from '../../api/recurringInvoices';
import { purchasesApi } from '../../api/purchases';
import { sriApi } from '../../api/sriDocuments';
import { getErrorMessage } from '../../api/client';
import { useToast } from '../../components/ui/Toast';

interface Supplier { id: string; name: string; ruc: string | null }
interface IvaTariff { codigo: string; descripcion: string; porcentaje: number }

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EXAMPLES = [
  'Arriendo de local / oficina', 'Internet, telefonía o servicios básicos', 'Software / licencias SaaS',
  'Seguros', 'Honorarios o retainer profesional', 'Cuota de leasing o renting', 'Mantenimiento de equipos',
  'Guardianía o limpieza contratada',
];

function emptyForm(): RecurringInvoiceTemplateInput {
  return {
    supplierId: '', description: '', amount: 0, taxCode: '15', taxRate: 15,
    dayOfMonth: 1, startDate: new Date().toISOString().slice(0, 10), endDate: null, isActive: true,
  };
}

function TemplateModal({
  initial, suppliers, tariffs, onClose, onSaved,
}: {
  initial: RecurringInvoiceTemplate | null;
  suppliers: Supplier[];
  tariffs: IvaTariff[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<RecurringInvoiceTemplateInput>(() => initial ? {
    supplierId: initial.supplierId, description: initial.description, amount: initial.amount,
    taxCode: initial.taxCode, taxRate: initial.taxRate, dayOfMonth: initial.dayOfMonth,
    startDate: initial.startDate.slice(0, 10), endDate: initial.endDate ? initial.endDate.slice(0, 10) : null,
    isActive: initial.isActive,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

  function onTarifaChange(codigo: string) {
    const t = tariffs.find((x) => x.codigo === codigo);
    setForm((f) => ({ ...f, taxCode: codigo, taxRate: t?.porcentaje ?? 0 }));
  }

  async function save() {
    setError('');
    if (!form.supplierId) { setError('Selecciona un proveedor'); return; }
    if (!form.description.trim()) { setError('La descripción es obligatoria'); return; }
    if (!(form.amount > 0)) { setError('El monto debe ser mayor a cero'); return; }
    setSaving(true);
    try {
      if (initial) await recurringInvoicesApi.update(initial.id, form);
      else await recurringInvoicesApi.create(form);
      toast.success(initial ? 'Plantilla actualizada' : 'Plantilla creada');
      onSaved();
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al guardar la plantilla'));
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
          {initial ? 'Editar plantilla recurrente' : 'Nueva factura recurrente'}
        </h2>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Proveedor *</label>
          <select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))} className={inputCls}>
            <option value="">Seleccionar proveedor...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.ruc ? ` (${s.ruc})` : ''}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Descripción *</label>
          <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Arriendo local Quito, Internet fibra óptica, Póliza de seguro..." className={inputCls} />
          <p className="text-xs text-surface-400 mt-1">Cualquier factura de compra que se repita cada mes: arriendo, servicios, software, seguros, honorarios, leasing, mantenimiento, etc.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Monto base (sin IVA) *</label>
            <input type="number" min={0} step={0.01} value={form.amount || ''}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Tarifa IVA</label>
            <select value={form.taxCode} onChange={(e) => onTarifaChange(e.target.value)} className={inputCls}>
              {tariffs.map((t) => <option key={t.codigo} value={t.codigo}>{t.descripcion} ({t.porcentaje}%)</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Día del mes</label>
            <input type="number" min={1} max={28} value={form.dayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Desde</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Hasta (opcional)</label>
            <input type="date" value={form.endDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || null }))} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
          <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="rounded border-surface-300 text-brand-500 focus:ring-brand-500" />
          Activa (genera facturas automáticamente al vencer)
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm hover:bg-surface-50 dark:hover:bg-surface-700">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecurringInvoicesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<RecurringInvoiceTemplate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tariffs, setTariffs] = useState<IvaTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTemplate, setModalTemplate] = useState<RecurringInvoiceTemplate | 'new' | null>(null);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    recurringInvoicesApi.list().then((r) => setTemplates(r.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    purchasesApi.getSuppliers().then((r) => setSuppliers(r.data)).catch(() => {});
    sriApi.catalogs().then((r) => setTariffs(r.data?.ivaTariffs ?? [])).catch(() => {});
  }, []);

  async function toggleActive(t: RecurringInvoiceTemplate) {
    try {
      await recurringInvoicesApi.update(t.id, { isActive: !t.isActive });
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Error al actualizar la plantilla'));
    }
  }

  async function handleGenerateDue() {
    setGenerating(true);
    try {
      const { data } = await recurringInvoicesApi.generateDue();
      if (data.generated.length === 0 && data.skipped.length === 0) {
        toast.success('No hay plantillas vencidas por generar hoy');
      } else {
        if (data.generated.length > 0) {
          toast.success(`${data.generated.length} factura(s) generada(s) — quedaron en Documentos SRI pendientes de revisión`);
        }
        if (data.skipped.length > 0) {
          toast.error(`${data.skipped.length} plantilla(s) no se pudieron generar: ${data.skipped.map((s) => s.reason).join('; ')}`);
        }
      }
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Error al generar facturas pendientes'));
    }
    setGenerating(false);
  }

  const dueSoon = (t: RecurringInvoiceTemplate) => {
    if (!t.isActive) return false;
    const now = new Date();
    return now.getUTCDate() >= t.dayOfMonth && t.lastGeneratedPeriod !== `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <Repeat className="w-5 h-5 text-brand-600 dark:text-brand-400" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Facturación Recurrente</h1>
            <p className="text-sm text-surface-500">Arriendos, servicios, software, seguros, honorarios — cualquier factura de compra que se repita cada mes, de cualquier sector</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerateDue} disabled={generating}
            className="flex items-center gap-1.5 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> {generating ? 'Generando...' : 'Generar pendientes'}
          </button>
          <button onClick={() => setModalTemplate('new')}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-soft">
            <Plus className="w-4 h-4" /> Nueva plantilla
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft py-16 text-center">
          <p className="text-surface-500 mb-3">No hay plantillas de facturación recurrente todavía.</p>
          <p className="text-xs text-surface-400 max-w-md mx-auto mb-4">
            Sirve para cualquier sector: {EXAMPLES.join(' · ')}.
          </p>
          <button onClick={() => setModalTemplate('new')} className="text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium">
            + Crear la primera →
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3">DESCRIPCIÓN</th>
                <th className="text-left px-4 py-3">PROVEEDOR</th>
                <th className="text-right px-4 py-3">MONTO + IVA</th>
                <th className="text-left px-4 py-3">FRECUENCIA</th>
                <th className="text-left px-4 py-3">ÚLTIMA GENERACIÓN</th>
                <th className="text-left px-4 py-3">ESTADO</th>
                <th className="text-right px-4 py-3">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-3 text-surface-800 dark:text-white font-medium max-w-[220px] truncate">{t.description}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{t.supplier.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">
                    {money(t.amount * (1 + t.taxRate / 100))}
                  </td>
                  <td className="px-4 py-3 text-surface-500 text-xs">
                    Día {t.dayOfMonth} de cada mes
                    {dueSoon(t) && <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">⏳ vencida</span>}
                  </td>
                  <td className="px-4 py-3 text-surface-500 text-xs">{t.lastGeneratedPeriod ?? '— nunca —'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(t)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        t.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-500 hover:bg-surface-200'
                      }`}>
                      {t.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end items-center">
                      <button onClick={() => setModalTemplate(t)} className="text-xs px-2.5 py-1 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <Link to="/sri" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        Ver documentos →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalTemplate && (
        <TemplateModal
          initial={modalTemplate === 'new' ? null : modalTemplate}
          suppliers={suppliers}
          tariffs={tariffs}
          onClose={() => setModalTemplate(null)}
          onSaved={() => { setModalTemplate(null); load(); }}
        />
      )}
    </div>
  );
}
