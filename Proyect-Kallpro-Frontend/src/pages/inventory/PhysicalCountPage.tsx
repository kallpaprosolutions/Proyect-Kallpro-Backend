import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WizardLayout from '../../components/ui/WizardLayout';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { useToast } from '../../components/ui/Toast';
import { useBarcodeShortcut } from '../../hooks/useBarcodeShortcut';
import { inventoryApi } from '../../api/inventory';
import { Hash, Play, ClipboardCheck } from 'lucide-react';

/**
 * Conteo Físico — Wizard 3 pasos.
 * 1. Inicio: selecciona bodega + notas, inicia conteo.
 * 2. Conteo: tabla productos con sistema vs físico.
 * 3. Revisión: variances con color + finalizar.
 */

const STEPS = [
  { key: 'start',   label: 'Inicio',   icon: <Play className="w-4 h-4" /> },
  { key: 'count',   label: 'Conteo',   icon: <Hash className="w-4 h-4" /> },
  { key: 'review',  label: 'Revisión', icon: <ClipboardCheck className="w-4 h-4" /> },
];

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

interface CountRow {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  systemQty: number;
  physicalQty: number | '';
}

export default function PhysicalCountPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [countId, setCountId] = useState<string | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const rowRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function locateAndFocus(code: string) {
    // Buscar fila por barcode/sku en las filas cargadas
    const found = rows.find((r) => (r as any).barcode === code || r.sku === code);
    if (!found) {
      // Si no aparece en las filas cargadas (puede que no tenga stock previo), buscar en backend
      Promise.allSettled([
        inventoryApi.getProductByBarcode(code).catch(() => null),
        inventoryApi.getProductBySku(code).catch(() => null),
      ]).then((results) => {
        const p = (results[0].status === 'fulfilled' && results[0].value?.data) || (results[1].status === 'fulfilled' && results[1].value?.data);
        if (!p) {
          toast.warning(`No se encontró producto "${code}" en esta bodega`);
          return;
        }
        // Agregarlo a las filas con systemQty 0 si no estaba
        if (!rows.find((r) => r.productId === p.id)) {
          setRows((prev) => [{ productId: p.id, name: p.name, sku: p.sku, unit: p.unit, systemQty: 0, physicalQty: '' }, ...prev]);
        }
        setSearch(p.sku || p.name);
        setTimeout(() => { rowRefs.current[p.id]?.focus(); }, 100);
      });
      return;
    }
    setSearch(found.sku || found.name);
    setTimeout(() => { rowRefs.current[found.productId]?.focus(); rowRefs.current[found.productId]?.select(); }, 100);
  }

  // Scanner USB activo durante el paso de conteo
  useBarcodeShortcut((code) => {
    if (step === 1) locateAndFocus(code);
  }, { enabled: step === 1 && !scannerOpen });

  useEffect(() => {
    inventoryApi.getWarehouses().then((r) => {
      setWarehouses(r.data);
      if (r.data.length > 0) setWarehouseId(r.data[0].id);
    });
  }, []);

  async function startCount() {
    if (!warehouseId) return;
    setSubmitting(true);
    try {
      const res = await inventoryApi.startPhysicalCount({ warehouseId, notes: notes.trim() || undefined });
      setCountId(res.data.id);
      // cargar productos con stock en esa bodega
      const products = await inventoryApi.getProducts();
      const initial: CountRow[] = products.data.map((p: any) => {
        const stock = p.stocks?.find((s: any) => s.warehouseId === warehouseId);
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          systemQty: Number(stock?.quantity || 0),
          physicalQty: '',
        };
      });
      setRows(initial);
      setStep(1);
      toast.success('Conteo iniciado', '▶ Listo para contar');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo iniciar el conteo');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProgress() {
    if (!countId) return;
    const items = rows
      .filter((r) => r.physicalQty !== '' && r.physicalQty !== null)
      .map((r) => ({ productId: r.productId, physicalQty: Number(r.physicalQty) }));
    if (items.length === 0) {
      toast.warning('No hay items contados aún');
      return;
    }
    try {
      await inventoryApi.addPhysicalCountItems(countId, items);
      toast.success(`Guardados ${items.length} items`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al guardar progreso');
    }
  }

  async function finalize() {
    if (!countId) return;
    setSubmitting(true);
    try {
      // Asegurar guardar último estado
      const items = rows
        .filter((r) => r.physicalQty !== '' && r.physicalQty !== null)
        .map((r) => ({ productId: r.productId, physicalQty: Number(r.physicalQty) }));
      if (items.length > 0) {
        await inventoryApi.addPhysicalCountItems(countId, items);
      }
      await inventoryApi.finalizePhysicalCount(countId);
      toast.success('Conteo finalizado — ajustes aplicados al inventario', '✓ Listo');
      navigate('/inventory');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al finalizar conteo');
      setSubmitting(false);
    }
  }

  function updateRow(id: string, qty: number | '') {
    setRows((r) => r.map((row) => row.productId === id ? { ...row, physicalQty: qty } : row));
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
  }, [rows, search]);

  const counted = rows.filter((r) => r.physicalQty !== '' && r.physicalQty !== null);
  const variances = counted.map((r) => {
    const phys = Number(r.physicalQty);
    const diff = phys - r.systemQty;
    const pct = r.systemQty > 0 ? Math.abs(diff / r.systemQty) * 100 : (phys > 0 ? 100 : 0);
    return { ...r, diff, pct };
  });

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (step === 0) {
      if (!warehouseId) errors.push('Selecciona una bodega');
    }
    if (step === 1) {
      if (counted.length === 0) errors.push('Debes contar al menos un producto');
    }
    return errors;
  }, [step, warehouseId, counted.length]);
  const canAdvance = validation.length === 0;

  // Manejar onNext según paso
  function handleNext() {
    if (step === 0) {
      startCount();
    } else if (step === 1) {
      setStep(2);
    }
  }

  return (
    <WizardLayout
      title="Conteo Físico de Inventario"
      subtitle="Reconcilia el stock del sistema con el conteo físico"
      icon={<Hash className="w-5 h-5" />}
      steps={STEPS}
      currentIndex={step}
      backFallback="/inventory"
      onPrev={() => setStep((s) => Math.max(0, s - 1))}
      onNext={handleNext}
      onCancel={() => navigate('/inventory')}
      onFinish={finalize}
      canNext={canAdvance}
      isLast={step === STEPS.length - 1}
      isSubmitting={submitting}
      nextLabel={step === 0 ? 'Iniciar conteo' : 'Siguiente'}
      finishLabel="Finalizar y ajustar inventario"
    >
      {validation.length > 0 && (
        <div className="mb-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
            {validation.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* PASO 1 — Inicio */}
      {step === 0 && (
        <div className="space-y-5 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Bodega a contar *</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              <option value="">Selecciona una bodega</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Notas / motivo</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className={inputCls + ' resize-none'} placeholder="Ej. Inventario trimestral Q1 2026" />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              ℹ️ Al iniciar el conteo se creará una sesión persistente. Puedes guardar progreso
              parcial y volver luego. Al finalizar se generarán ajustes automáticos.
            </p>
          </div>
        </div>
      )}

      {/* PASO 2 — Conteo */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar producto..."
              className="flex-1 min-w-[240px] bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm" />
            <button type="button" onClick={() => setScannerOpen(true)}
              className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
              📷 Escanear
            </button>
            <span className="text-xs text-surface-500">
              Contados: <span className="font-semibold text-brand-600 dark:text-brand-400">{counted.length}</span> / {rows.length}
            </span>
            <button type="button" onClick={saveProgress}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              💾 Guardar progreso
            </button>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 -mt-2">
            💡 Tip: Conecta un scanner USB y escanea — el foco salta automáticamente a la fila del producto.
          </p>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-right px-4 py-3">Sistema</th>
                  <th className="text-right px-4 py-3 w-40">Conteo físico</th>
                  <th className="text-right px-4 py-3">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700 max-h-[500px]">
                {filteredRows.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-surface-400">Sin productos.</td></tr>}
                {filteredRows.map((r) => {
                  const phys = r.physicalQty === '' ? null : Number(r.physicalQty);
                  const diff = phys !== null ? phys - r.systemQty : null;
                  return (
                    <tr key={r.productId} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="px-4 py-2 text-surface-800 dark:text-white">{r.name}</td>
                      <td className="px-4 py-2 text-surface-500 font-mono text-xs">{r.sku || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.systemQty.toFixed(2)} <span className="text-xs text-surface-400">{r.unit}</span></td>
                      <td className="px-4 py-2 text-right">
                        <input
                          ref={(el) => { rowRefs.current[r.productId] = el; }}
                          type="number" min={0} step={0.01} value={r.physicalQty}
                          onChange={(e) => updateRow(r.productId, e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${
                        diff === null ? 'text-surface-400'
                        : Math.abs(diff) < 0.001 ? 'text-green-600 dark:text-green-400'
                        : Math.abs(diff) < r.systemQty * 0.05 ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400 font-semibold'
                      }`}>
                        {diff === null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PASO 3 — Revisión */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 uppercase">Productos contados</p>
              <p className="text-2xl font-bold mt-1 text-surface-800 dark:text-white">{counted.length}</p>
            </div>
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 uppercase">Sin variance</p>
              <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{variances.filter((v) => v.pct < 0.001).length}</p>
            </div>
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 uppercase">Variance ≤5%</p>
              <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{variances.filter((v) => v.pct > 0 && v.pct <= 5).length}</p>
            </div>
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 uppercase">Variance &gt;5%</p>
              <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{variances.filter((v) => v.pct > 5).length}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-right px-4 py-3">Sistema</th>
                  <th className="text-right px-4 py-3">Físico</th>
                  <th className="text-right px-4 py-3">Diferencia</th>
                  <th className="text-right px-4 py-3">% Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {variances.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-surface-400">Sin items contados.</td></tr>}
                {variances.map((v) => (
                  <tr key={v.productId}>
                    <td className="px-4 py-2">{v.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{v.systemQty.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(v.physicalQty).toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${
                      Math.abs(v.diff) < 0.001 ? 'text-green-600 dark:text-green-400'
                      : v.pct <= 5 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400 font-semibold'
                    }`}>
                      {v.diff > 0 ? '+' : ''}{v.diff.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        v.pct < 0.001 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : v.pct <= 5 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      }`}>
                        {v.pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
            ⚠️ Al finalizar el conteo se generarán automáticamente movimientos de ajuste
            (ADJUSTMENT_IN o ADJUSTMENT_OUT) en el kardex para igualar el stock físico.
            Esta acción <strong>no se puede deshacer</strong>.
          </div>
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onScan={(code) => { setScannerOpen(false); locateAndFocus(code); }}
        onClose={() => setScannerOpen(false)}
        title="Escanear producto a contar"
      />
    </WizardLayout>
  );
}
