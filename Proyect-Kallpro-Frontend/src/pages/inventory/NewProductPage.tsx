import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WizardLayout from '../../components/ui/WizardLayout';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { useToast } from '../../components/ui/Toast';
import { inventoryApi } from '../../api/inventory';
import { ollamaApi } from '../../api/ollama';
import { Tag, DollarSign, Package } from 'lucide-react';

/**
 * Nuevo Producto — Wizard de 3 pasos.
 * Paso 1: Identificación (SKU, nombre, código, descripción, categoría, unidad)
 * Paso 2: Precios y valoración (costo, precio venta, método valuación, taxes)
 * Paso 3: Inventario inicial + revisión (reorder, lead time, stock inicial)
 */

const STEPS = [
  { key: 'identification', label: 'Identificación',     icon: <Tag className="w-4 h-4" /> },
  { key: 'pricing',        label: 'Precios y valoración', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'inventory',      label: 'Inventario inicial',   icon: <Package className="w-4 h-4" /> },
];

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1';

const UNIT_OPTIONS = ['UNIDAD', 'KG', 'LT', 'MT', 'CAJA', 'PAR', 'DOC', 'GR', 'ML'];

const VALUATION_OPTIONS = [
  { value: 'AVG',           label: 'Promedio Ponderado', desc: 'Recalcula el costo promedio en cada entrada' },
  { value: 'FIFO',          label: 'FIFO',               desc: 'Primero en entrar, primero en salir (por lotes)' },
  { value: 'LIFO',          label: 'LIFO',               desc: 'Último en entrar, primero en salir (por lotes)' },
  { value: 'STANDARD_COST', label: 'Costo Estándar',     desc: 'Usa un costo fijo definido por la empresa' },
];

export default function NewProductPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Paso 1
    sku: '', barcode: searchParams.get('barcode') || '', name: '', description: '', categoryId: '', unit: 'UNIDAD',
    // Paso 2
    avgCost: '', salePrice: '', valuationMethod: 'AVG', standardCost: '',
    // Paso 3
    minStock: '', reorderPoint: '',
    initialStock: [] as { warehouseId: string; quantity: number }[],
  });

  useEffect(() => {
    Promise.allSettled([inventoryApi.getCategories(), inventoryApi.getWarehouses()]).then((r) => {
      if (r[0].status === 'fulfilled') setCategories(r[0].value.data);
      if (r[1].status === 'fulfilled') setWarehouses(r[1].value.data);
    });
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (step === 0) {
      if (!form.name.trim()) errors.push('Nombre del producto requerido');
    }
    if (step === 1) {
      if (!form.salePrice || Number(form.salePrice) <= 0) errors.push('Precio de venta requerido');
      if (form.valuationMethod === 'STANDARD_COST' && (!form.standardCost || Number(form.standardCost) <= 0)) {
        errors.push('Costo estándar requerido para método STANDARD_COST');
      }
    }
    return errors;
  }, [step, form]);
  const canAdvance = validation.length === 0;

  async function generateAiDescription() {
    if (!form.name.trim()) return;
    setAiLoading(true);
    try {
      const cat = categories.find((c) => c.id === form.categoryId)?.name;
      const res = await ollamaApi.generateProductDescription(form.name, cat, form.unit);
      set('description', res.data.description);
      toast.success('Descripción generada con IA');
    } catch {
      toast.warning('No se pudo generar la descripción con IA');
    } finally {
      setAiLoading(false);
    }
  }

  function addInitialStock() {
    set('initialStock', [...form.initialStock, { warehouseId: warehouses[0]?.id || '', quantity: 0 }]);
  }
  function updateStock(i: number, patch: Partial<{ warehouseId: string; quantity: number }>) {
    set('initialStock', form.initialStock.map((s, j) => j === i ? { ...s, ...patch } : s));
  }
  function removeStock(i: number) {
    set('initialStock', form.initialStock.filter((_, j) => j !== i));
  }

  async function submit() {
    setSubmitting(true);
    const payload: any = {
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || undefined,
      unit: form.unit,
      salePrice: Number(form.salePrice) || 0,
      avgCost: form.avgCost ? Number(form.avgCost) : 0,
      minStock: form.minStock ? Number(form.minStock) : 0,
      reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : 0,
      valuationMethod: form.valuationMethod,
      standardCost: form.valuationMethod === 'STANDARD_COST' ? Number(form.standardCost) : 0,
    };
    try {
      const res = await inventoryApi.createProduct(payload);
      const productId = res.data?.id;

      // Stock inicial por bodega — crear movimientos de entrada
      const stockEntries = form.initialStock.filter((s) => s.warehouseId && s.quantity > 0);
      if (productId && stockEntries.length > 0) {
        await Promise.allSettled(
          stockEntries.map((s) =>
            inventoryApi.registerMovement({
              productId,
              warehouseId: s.warehouseId,
              type: 'IN',
              quantity: s.quantity,
              unitCost: payload.avgCost || payload.standardCost || 0,
              reference: 'Stock inicial',
            })
          )
        );
      }

      // Subir imagen si se seleccionó
      if (productId && imageFile) {
        try {
          await inventoryApi.uploadProductImage(productId, imageFile);
        } catch {
          toast.warning('El producto se creó pero la imagen no se pudo subir');
        }
      }

      toast.success(`Producto "${form.name}" creado con éxito`, '✓ Listo');
      navigate(productId ? `/inventory/products/${productId}` : '/inventory');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al crear producto', 'Error');
      setSubmitting(false);
    }
  }

  return (
    <WizardLayout
      title="Nuevo Producto"
      subtitle="Registra un producto paso a paso"
      icon={<Package className="w-5 h-5" />}
      steps={STEPS}
      currentIndex={step}
      backFallback="/inventory"
      onPrev={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onCancel={() => navigate('/inventory')}
      onFinish={submit}
      canNext={canAdvance}
      isLast={step === STEPS.length - 1}
      isSubmitting={submitting}
      finishLabel="Crear Producto"
    >
      {validation.length > 0 && (
        <div className="mb-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
            {validation.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* PASO 1 — Identificación */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px] gap-4">
            <div>
              <label className={labelCls}>SKU (opcional)</label>
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} className={inputCls} placeholder="PROD-001" />
            </div>
            <div>
              <label className={labelCls}>Código de barras</label>
              <div className="flex gap-1">
                <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} className={inputCls} placeholder="7891234567890" />
                <button type="button" onClick={() => setScannerOpen(true)}
                  className="px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium whitespace-nowrap" title="Escanear">
                  📷
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Unidad</label>
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls}>
                {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Imagen</label>
              <div className="flex items-center gap-2">
                {imagePreview ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl">×</button>
                  </div>
                ) : (
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) { toast.error('Máx 5 MB'); return; }
                        setImageFile(f);
                        const reader = new FileReader();
                        reader.onload = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(f);
                      }} />
                    <div className={inputCls + ' text-center cursor-pointer'}>🖼 Subir</div>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Nombre del producto *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="Laptop HP 15 pulgadas" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Descripción</label>
              <button type="button" onClick={generateAiDescription} disabled={!form.name.trim() || aiLoading}
                className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-600/20 hover:bg-purple-200 dark:hover:bg-purple-600/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-600/30 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40">
                {aiLoading ? '⏳ Generando…' : '🤖 Generar con IA'}
              </button>
            </div>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
              className={inputCls + ' resize-none'} placeholder="Detalles del producto..." />
          </div>

          <div>
            <label className={labelCls}>Categoría</label>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputCls}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* PASO 2 — Precios y valoración */}
      {step === 1 && (
        <div className="space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Precios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Costo unitario (referencia)</label>
              <input type="number" min={0} step={0.0001} value={form.avgCost}
                onChange={(e) => set('avgCost', e.target.value)} className={inputCls} placeholder="0.0000" />
              <p className="text-xs text-surface-500 mt-1">Costo inicial. Se recalculará con cada entrada de inventario.</p>
            </div>
            <div>
              <label className={labelCls}>Precio de venta *</label>
              <input type="number" min={0} step={0.01} value={form.salePrice}
                onChange={(e) => set('salePrice', e.target.value)} className={inputCls} placeholder="0.00" />
              {form.avgCost && form.salePrice && (
                <p className="text-xs text-surface-500 mt-1">
                  Margen: <span className="font-semibold">
                    {((Number(form.salePrice) - Number(form.avgCost)) / Number(form.salePrice) * 100).toFixed(1)}%
                  </span>
                </p>
              )}
            </div>
          </div>

          <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Método de valoración de inventario</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VALUATION_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('valuationMethod', opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  form.valuationMethod === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
                }`}>
                <p className="font-semibold text-surface-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-surface-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>

          {form.valuationMethod === 'STANDARD_COST' && (
            <div>
              <label className={labelCls}>Costo estándar unitario *</label>
              <input type="number" min={0} step={0.0001} value={form.standardCost}
                onChange={(e) => set('standardCost', e.target.value)} className={inputCls} placeholder="0.0000" />
            </div>
          )}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onScan={(code) => { set('barcode', code); setScannerOpen(false); toast.success(`Código capturado: ${code}`); }}
        onClose={() => setScannerOpen(false)}
        title="Escanear código de barras"
        subtitle="Apunta la cámara al código del producto"
      />

      {/* PASO 3 — Inventario inicial */}
      {step === 2 && (
        <div className="space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Parámetros de reorden</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Stock mínimo (alerta)</label>
              <input type="number" min={0} value={form.minStock}
                onChange={(e) => set('minStock', e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Punto de reorden</label>
              <input type="number" min={0} value={form.reorderPoint}
                onChange={(e) => set('reorderPoint', e.target.value)} className={inputCls} placeholder="0" />
              <p className="text-xs text-surface-500 mt-1">Cuando el stock baje de este valor se sugiere reorden.</p>
            </div>
          </div>

          <h3 className="font-semibold text-surface-800 dark:text-white pt-3 flex items-center justify-between">
            Stock inicial por bodega (opcional)
            <button type="button" onClick={addInitialStock} disabled={warehouses.length === 0}
              className="text-xs px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50">
              + Agregar bodega
            </button>
          </h3>
          <div className="space-y-2">
            {form.initialStock.length === 0 && (
              <p className="text-sm text-surface-400 italic">Sin stock inicial. El producto se creará con stock 0 en todas las bodegas.</p>
            )}
            {form.initialStock.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_180px_40px] gap-2 items-end p-3 bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface-200 dark:border-surface-700">
                <div>
                  <label className="text-xs text-surface-500">Bodega</label>
                  <select value={s.warehouseId} onChange={(e) => updateStock(i, { warehouseId: e.target.value })} className={inputCls}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-500">Cantidad</label>
                  <input type="number" min={0} step={0.01} value={s.quantity}
                    onChange={(e) => updateStock(i, { quantity: Number(e.target.value) })} className={inputCls + ' text-right'} />
                </div>
                <button type="button" onClick={() => removeStock(i)}
                  className="h-10 px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">×</button>
              </div>
            ))}
          </div>

          {/* Resumen final */}
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-5 mt-6">
            <h4 className="font-semibold text-surface-800 dark:text-white mb-3">Resumen</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-surface-500">Producto</dt>      <dd className="text-right font-medium">{form.name || '—'}</dd>
              <dt className="text-surface-500">SKU</dt>            <dd className="text-right font-mono">{form.sku || '—'}</dd>
              <dt className="text-surface-500">Unidad</dt>         <dd className="text-right">{form.unit}</dd>
              <dt className="text-surface-500">Precio venta</dt>   <dd className="text-right font-mono">${Number(form.salePrice || 0).toFixed(2)}</dd>
              <dt className="text-surface-500">Valuación</dt>      <dd className="text-right">{form.valuationMethod}</dd>
              <dt className="text-surface-500">Stock inicial</dt>  <dd className="text-right">{form.initialStock.reduce((s, x) => s + Number(x.quantity || 0), 0)} ud en {form.initialStock.length} bodega(s)</dd>
            </dl>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}
