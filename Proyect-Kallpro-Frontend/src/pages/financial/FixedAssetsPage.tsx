import { useEffect, useState } from 'react';
import { Landmark, Plus, Play, XCircle } from 'lucide-react';
import { fixedAssetsApi, FixedAsset, FixedAssetInput, FixedAssetCategoryInfo } from '../../api/fixedAssets';
import { purchasesApi } from '../../api/purchases';
import { getErrorMessage } from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

interface Supplier { id: string; name: string; ruc: string | null }

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ACTIVE:            { label: 'Activo',              color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  FULLY_DEPRECIATED: { label: 'Totalmente depreciado', color: 'bg-surface-100 dark:bg-surface-700 text-surface-500' },
  DISPOSED:          { label: 'Dado de baja',         color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
};

function emptyForm(): FixedAssetInput {
  return {
    name: '', category: 'EQUIPO_COMPUTO', acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: 0, residualValue: 0, usefulLifeYears: 3, supplierId: null, notes: '',
  };
}

function AssetModal({
  categories, suppliers, onClose, onSaved,
}: {
  categories: FixedAssetCategoryInfo[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FixedAssetInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

  function onCategoryChange(key: string) {
    const cat = categories.find((c) => c.key === key);
    setForm((f) => ({ ...f, category: key, usefulLifeYears: cat?.defaultUsefulLifeYears ?? f.usefulLifeYears }));
  }

  async function save() {
    setError('');
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!(form.acquisitionCost > 0)) { setError('El costo de adquisición debe ser mayor a cero'); return; }
    if (form.residualValue >= form.acquisitionCost) { setError('El valor residual debe ser menor al costo'); return; }
    setSaving(true);
    try {
      await fixedAssetsApi.create(form);
      toast.success('Activo registrado');
      onSaved();
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al registrar el activo'));
    }
    setSaving(false);
  }

  const selectedCategory = categories.find((c) => c.key === form.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Nuevo activo fijo</h2>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Nombre *</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Laptop de gerencia, Camioneta de reparto, Estanterías bodega..." className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Categoría</label>
            <select value={form.category} onChange={(e) => onCategoryChange(e.target.value)} className={inputCls}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {selectedCategory && (
              <p className="text-xs text-surface-400 mt-1">
                Cuenta {selectedCategory.accountCode} · vida útil legal sugerida: {selectedCategory.defaultUsefulLifeYears || 'no deprecia'} {selectedCategory.defaultUsefulLifeYears ? 'años' : ''}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Proveedor (opcional)</label>
            <select value={form.supplierId ?? ''} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value || null }))} className={inputCls}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Fecha de adquisición</label>
            <input type="date" value={form.acquisitionDate} onChange={(e) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Costo de adquisición</label>
            <input type="number" min={0} step={0.01} value={form.acquisitionCost || ''}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionCost: Number(e.target.value) }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Valor residual</label>
            <input type="number" min={0} step={0.01} value={form.residualValue || ''}
              onChange={(e) => setForm((f) => ({ ...f, residualValue: Number(e.target.value) }))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Vida útil (años)</label>
          <input type="number" min={0} value={form.usefulLifeYears}
            onChange={(e) => setForm((f) => ({ ...f, usefulLifeYears: Number(e.target.value) }))} className={inputCls} />
          <p className="text-xs text-surface-400 mt-1">0 solo para terrenos (no deprecian). El resto de categorías necesita al menos 1 año.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Notas</label>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm hover:bg-surface-50 dark:hover:bg-surface-700">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Guardando...' : 'Registrar activo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FixedAssetsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<FixedAssetCategoryInfo[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    fixedAssetsApi.list().then((r) => setAssets(r.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fixedAssetsApi.categories().then((r) => setCategories(r.data)).catch(() => {});
    purchasesApi.getSuppliers().then((r) => setSuppliers(r.data)).catch(() => {});
  }, []);

  async function handleGenerateDue() {
    setGenerating(true);
    try {
      const { data } = await fixedAssetsApi.generateDue();
      if (data.generated.length === 0 && data.skipped.length === 0) {
        toast.success('No hay depreciaciones pendientes por generar este período');
      } else {
        if (data.generated.length > 0) {
          const total = data.generated.reduce((s, g) => s + g.amount, 0);
          toast.success(`${data.generated.length} asiento(s) de depreciación generado(s) por ${money(total)}`);
        }
        if (data.skipped.length > 0) {
          toast.error(`${data.skipped.length} activo(s) fallaron: ${data.skipped.map((s) => s.reason).join('; ')}`);
        }
      }
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Error al generar la depreciación'));
    }
    setGenerating(false);
  }

  async function handleDispose(asset: FixedAsset) {
    const note = window.prompt(`Motivo de baja de "${asset.name}":`);
    if (!note) return;
    const ok = await confirm({ title: 'Dar de baja el activo', message: `¿Confirmas dar de baja "${asset.name}"? Dejará de depreciarse.`, variant: 'danger' });
    if (!ok) return;
    try {
      await fixedAssetsApi.dispose(asset.id, note);
      toast.success('Activo dado de baja');
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Error al dar de baja el activo'));
    }
  }

  const totals = assets.reduce((acc, a) => {
    acc.cost += Number(a.acquisitionCost);
    acc.accumulated += Number(a.accumulatedDepreciation);
    return acc;
  }, { cost: 0, accumulated: 0 });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-brand-600 dark:text-brand-400" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Activos Fijos</h1>
            <p className="text-sm text-surface-500">Propiedad, planta y equipo — depreciación en línea recta, art. 28 RLRTI</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerateDue} disabled={generating}
            className="flex items-center gap-1.5 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> {generating ? 'Generando...' : 'Correr depreciación'}
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-soft">
            <Plus className="w-4 h-4" /> Nuevo activo
          </button>
        </div>
      </div>

      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
            <p className="text-xs text-surface-500">Costo total</p>
            <p className="text-xl font-bold text-surface-900 dark:text-white">{money(totals.cost)}</p>
          </div>
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
            <p className="text-xs text-surface-500">Depreciación acumulada</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{money(totals.accumulated)}</p>
          </div>
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
            <p className="text-xs text-surface-500">Valor en libros</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{money(totals.cost - totals.accumulated)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft py-16 text-center">
          <p className="text-surface-500 mb-3">No hay activos fijos registrados todavía.</p>
          <button onClick={() => setShowModal(true)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium">
            + Registrar el primero →
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-3">ACTIVO</th>
                  <th className="text-left px-4 py-3">CATEGORÍA</th>
                  <th className="text-right px-4 py-3">COSTO</th>
                  <th className="text-right px-4 py-3">DEPREC. ACUM.</th>
                  <th className="text-right px-4 py-3">VALOR EN LIBROS</th>
                  <th className="text-left px-4 py-3">ÚLTIMA DEPREC.</th>
                  <th className="text-left px-4 py-3">ESTADO</th>
                  <th className="text-right px-4 py-3">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {assets.map((a) => {
                  const bookValue = Number(a.acquisitionCost) - Number(a.accumulatedDepreciation);
                  const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.ACTIVE;
                  return (
                    <tr key={a.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-brand-600 dark:text-brand-400">{a.assetNumber}</p>
                        <p className="text-surface-800 dark:text-white font-medium">{a.name}</p>
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-300 text-xs">
                        {categories.find((c) => c.key === a.category)?.label ?? a.category}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">{money(a.acquisitionCost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{money(a.accumulatedDepreciation)}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-green-600 dark:text-green-400">{money(bookValue)}</td>
                      <td className="px-4 py-3 text-surface-500 text-xs">{a.lastDepreciatedPeriod ?? '— nunca —'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status === 'ACTIVE' && (
                          <button onClick={() => handleDispose(a)}
                            className="text-xs px-2.5 py-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1 ml-auto">
                            <XCircle className="w-3 h-3" /> Dar de baja
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AssetModal categories={categories} suppliers={suppliers} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}
