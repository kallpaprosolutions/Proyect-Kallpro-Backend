import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WizardLayout from '../../components/ui/WizardLayout';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { useToast } from '../../components/ui/Toast';
import { inventoryApi } from '../../api/inventory';
import { ArrowLeftRight } from 'lucide-react';

/**
 * Transferencia entre bodegas — Wizard 3 pasos.
 * 1. Producto (autocomplete + ver stock por bodega)
 * 2. Movimiento (origen/destino + cantidad + motivo)
 * 3. Confirmación (vista previa antes/después + ejecutar)
 */

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  avgCost: number;
  stocks: { warehouseId: string; quantity: number; reserved: number; warehouse: { id: string; name: string } }[];
}

const STEPS = [
  { key: 'product',  label: 'Producto',     icon: '📦' },
  { key: 'movement', label: 'Movimiento',   icon: '↔️' },
  { key: 'confirm',  label: 'Confirmación', icon: '✓' },
];

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1';

export default function WarehouseTransferPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.allSettled([inventoryApi.getProducts(), inventoryApi.getWarehouses()]).then((r) => {
      if (r[0].status === 'fulfilled') setProducts(r[0].value.data);
      if (r[1].status === 'fulfilled') setWarehouses(r[1].value.data);
      setLoading(false);
    });
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    selectedProduct?.stocks?.forEach((s) => m.set(s.warehouseId, Number(s.quantity || 0)));
    return m;
  }, [selectedProduct]);

  const fromStock = fromWarehouseId ? (stockMap.get(fromWarehouseId) || 0) : 0;
  const toStock = toWarehouseId ? (stockMap.get(toWarehouseId) || 0) : 0;
  const transferValue = quantity * (selectedProduct?.avgCost ?? 0);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 12);
    const q = search.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 12);
  }, [products, search]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (step === 0 && !selectedProductId) errors.push('Selecciona un producto');
    if (step === 1) {
      if (!fromWarehouseId) errors.push('Selecciona bodega origen');
      if (!toWarehouseId)   errors.push('Selecciona bodega destino');
      if (fromWarehouseId === toWarehouseId) errors.push('Origen y destino deben ser diferentes');
      if (!quantity || quantity <= 0) errors.push('Cantidad debe ser mayor a 0');
      if (quantity > fromStock) errors.push(`Cantidad excede stock disponible (${fromStock})`);
    }
    return errors;
  }, [step, selectedProductId, fromWarehouseId, toWarehouseId, quantity, fromStock]);
  const canAdvance = validation.length === 0;

  async function submit() {
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      await inventoryApi.transferStock({
        productId: selectedProduct.id,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        notes: notes.trim() || undefined,
      });
      toast.success(`Transferencia ejecutada: ${quantity} ${selectedProduct.unit} de ${selectedProduct.name}`, '✓ Listo');
      navigate(`/inventory/products/${selectedProduct.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo ejecutar la transferencia', 'Error');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const fromWarehouse = warehouses.find((w) => w.id === fromWarehouseId);
  const toWarehouse = warehouses.find((w) => w.id === toWarehouseId);

  return (
    <WizardLayout
      title="Transferencia entre bodegas"
      subtitle="Mueve stock de una bodega a otra paso a paso"
      icon={<ArrowLeftRight className="w-5 h-5" />}
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
      finishLabel="Ejecutar transferencia"
    >
      {validation.length > 0 && (
        <div className="mb-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
            {validation.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* PASO 1 — Producto */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Buscar producto</label>
            <div className="flex gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls}
                placeholder="🔍 Nombre o SKU del producto..." autoFocus />
              <button type="button" onClick={() => setScannerOpen(true)}
                className="px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium whitespace-nowrap">
                📷 Escanear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="col-span-2 text-center text-surface-400 py-8">Sin resultados</p>
            ) : filtered.map((p) => {
              const totalStock = (p.stocks || []).reduce((s, st) => s + Number(st.quantity || 0), 0);
              return (
                <button key={p.id} type="button" onClick={() => setSelectedProductId(p.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedProductId === p.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-surface-500">{p.sku || 'Sin SKU'} · {p.unit}</p>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700">
                      {totalStock} ud
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedProduct && (
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
              <h4 className="font-semibold text-surface-800 dark:text-white mb-2">Stock actual por bodega:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {selectedProduct.stocks?.length ? selectedProduct.stocks.map((s) => (
                  <div key={s.warehouseId} className="flex justify-between bg-white dark:bg-surface-800 rounded-lg px-3 py-2">
                    <span className="text-surface-600 dark:text-surface-300 truncate">{s.warehouse.name}</span>
                    <span className="font-mono font-semibold">{Number(s.quantity).toFixed(2)}</span>
                  </div>
                )) : <p className="text-surface-400 italic">Sin stock en ninguna bodega</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 2 — Movimiento */}
      {step === 1 && selectedProduct && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Bodega origen *</label>
              <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} className={inputCls}>
                <option value="">Selecciona...</option>
                {warehouses.map((w) => {
                  const stock = stockMap.get(w.id) || 0;
                  return (
                    <option key={w.id} value={w.id} disabled={stock <= 0}>
                      {w.name} ({stock} {selectedProduct.unit} disponibles)
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bodega destino *</label>
              <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className={inputCls}>
                <option value="">Selecciona...</option>
                {warehouses.filter((w) => w.id !== fromWarehouseId).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({stockMap.get(w.id) || 0} {selectedProduct.unit} actuales)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Cantidad a transferir * (máx: {fromStock} {selectedProduct.unit})</label>
            <input type="number" min={0} max={fromStock} step={0.01} value={quantity || ''}
              onChange={(e) => setQuantity(Number(e.target.value))} className={inputCls} />
            {fromStock > 0 && quantity > 0 && (
              <div className="mt-2">
                <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (quantity / fromStock) * 100)}%` }} />
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  {Math.round((quantity / fromStock) * 100)}% del stock disponible
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Motivo / Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className={inputCls + ' resize-none'} placeholder="Ej. Reabastecimiento sucursal norte" />
          </div>
        </div>
      )}

      {/* PASO 3 — Confirmación */}
      {step === 2 && selectedProduct && (
        <div className="space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Confirmación de la transferencia</h3>

          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-wider">Producto</p>
                <p className="font-semibold text-lg text-surface-900 dark:text-white">{selectedProduct.name}</p>
                <p className="text-sm text-surface-500">{selectedProduct.sku || 'Sin SKU'} · {selectedProduct.unit}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-500 uppercase tracking-wider">Valor estimado</p>
                <p className="font-mono font-bold text-2xl text-brand-600 dark:text-brand-400">
                  ${transferValue.toLocaleString('es', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* Origen */}
              <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Desde</p>
                <p className="font-semibold text-surface-900 dark:text-white">{fromWarehouse?.name}</p>
                <p className="text-sm text-surface-500 mt-2">Antes: <span className="font-mono">{fromStock}</span></p>
                <p className="text-sm text-red-600 dark:text-red-400">Después: <span className="font-mono font-semibold">{(fromStock - quantity).toFixed(2)}</span></p>
              </div>

              {/* Flecha */}
              <div className="text-center">
                <p className="text-3xl text-brand-500">→</p>
                <p className="font-mono text-2xl font-bold text-surface-900 dark:text-white mt-2">
                  {quantity} {selectedProduct.unit}
                </p>
              </div>

              {/* Destino */}
              <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Hacia</p>
                <p className="font-semibold text-surface-900 dark:text-white">{toWarehouse?.name}</p>
                <p className="text-sm text-surface-500 mt-2">Antes: <span className="font-mono">{toStock}</span></p>
                <p className="text-sm text-green-600 dark:text-green-400">Después: <span className="font-mono font-semibold">{(toStock + quantity).toFixed(2)}</span></p>
              </div>
            </div>

            {notes && (
              <div className="mt-4 pt-4 border-t border-brand-200 dark:border-brand-800">
                <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Motivo</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{notes}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-surface-500 text-center">
            Al confirmar se generará un par de movimientos de inventario (TRANSFER_OUT + TRANSFER_IN) en el kardex.
          </p>
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onScan={(code) => {
          setScannerOpen(false);
          // buscar primero por barcode, luego por sku, en la lista cargada
          const found = products.find((p) => (p as any).barcode === code || p.sku === code);
          if (found) {
            setSelectedProductId(found.id);
            toast.success(`Producto seleccionado: ${found.name}`);
          } else {
            toast.warning(`No se encontró producto con código "${code}"`);
            setSearch(code);
          }
        }}
        onClose={() => setScannerOpen(false)}
        title="Escanear producto a transferir"
      />
    </WizardLayout>
  );
}
