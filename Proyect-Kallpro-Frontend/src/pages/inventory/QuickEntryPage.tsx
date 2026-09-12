import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import BackButton from '../../components/ui/BackButton';
import { useToast } from '../../components/ui/Toast';
import { useBarcodeShortcut } from '../../hooks/useBarcodeShortcut';
import { inventoryApi } from '../../api/inventory';

/**
 * Entrada Rápida — el flujo optimizado para inventario.
 *
 * Modos:
 *  - IN (Recibir): escanea → confirma producto → cantidad → Enter → siguiente
 *  - OUT (Salida): igual pero registra OUT
 *  - COUNT (Conteo): registra el conteo físico para reconciliar después
 *
 * Reduce los pasos de ~7 a ~3 por operación:
 *   1. Escanea código
 *   2. Ingresa cantidad
 *   3. Enter → registra y reset a paso 1
 *
 * Soporta scanners USB (keyboard wedge) y cámara del dispositivo.
 */

type Mode = 'IN' | 'OUT' | 'COUNT';

const MODES = [
  { key: 'IN' as Mode,    label: 'Recibir',  icon: '📥', color: 'bg-green-500 hover:bg-green-600', desc: 'Entrada de mercancía' },
  { key: 'OUT' as Mode,   label: 'Salida',   icon: '📤', color: 'bg-red-500 hover:bg-red-600',     desc: 'Consumo / venta directa' },
  { key: 'COUNT' as Mode, label: 'Ajuste',   icon: '🔄', color: 'bg-blue-500 hover:bg-blue-600',   desc: 'Ajuste de inventario' },
];

interface HistoryEntry {
  ts: number;
  code: string;
  productName: string;
  quantity: number;
  mode: Mode;
  warehouseName: string;
}

export default function QuickEntryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('IN');
  // Dirección del ajuste (solo modo COUNT): entrada (+) o salida (−)
  const [adjustDir, setAdjustDir] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [currentProduct, setCurrentProduct] = useState<any | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [notFoundCode, setNotFoundCode] = useState('');

  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inventoryApi.getWarehouses().then((r) => {
      setWarehouses(r.data);
      const def = r.data.find((w: any) => w.isDefault) || r.data[0];
      if (def) setWarehouseId(def.id);
    });
  }, []);

  // Auto-foco en input de cantidad cuando se selecciona producto
  useEffect(() => {
    if (currentProduct && qtyInputRef.current) {
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    }
  }, [currentProduct]);

  // Hook scanner USB (siempre activo)
  useBarcodeShortcut((code) => {
    lookup(code);
  }, { enabled: !scannerOpen && !currentProduct });

  async function lookup(code: string) {
    setScannerOpen(false);
    setSearchCode(code);
    setNotFoundCode('');
    try {
      // Primero buscar por barcode
      const r = await inventoryApi.getProductByBarcode(code).catch(() => null);
      if (r && r.data) { setCurrentProduct(r.data); return; }
      // Luego por SKU
      const r2 = await inventoryApi.getProductBySku(code).catch(() => null);
      if (r2 && r2.data) { setCurrentProduct(r2.data); return; }
      setNotFoundCode(code);
      toast.warning(`No se encontró producto con código "${code}"`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al buscar producto');
    }
  }

  function reset() {
    setCurrentProduct(null);
    setQuantity('');
    setUnitCost('');
    setReference('');
    setNotFoundCode('');
    setSearchCode('');
  }

  async function submit() {
    if (!currentProduct || !warehouseId || !quantity || Number(quantity) <= 0) return;
    setSubmitting(true);
    try {
      const wh = warehouses.find((w) => w.id === warehouseId);

      if (mode === 'COUNT') {
        // Los ajustes pasan por doble autorización (solicitud → aprobación de finanzas/gerencia)
        const reason = reference.trim();
        if (reason.length < 3) {
          toast.error('Indica el motivo del ajuste en Referencia/Motivo (mín. 3 caracteres)');
          setSubmitting(false);
          return;
        }
        await inventoryApi.createAdjustment({
          productId: currentProduct.id,
          warehouseId,
          type: adjustDir,
          quantity: Number(quantity),
          unitCost: unitCost ? Number(unitCost) : undefined,
          reason,
        });
        setHistory((h) => [
          { ts: Date.now(), code: searchCode, productName: currentProduct.name, quantity: Number(quantity), mode, warehouseName: wh?.name || '' },
          ...h.slice(0, 19),
        ]);
        toast.success(`Ajuste enviado a aprobación: ${adjustDir === 'ADJUSTMENT_IN' ? '+' : '−'}${quantity} ${currentProduct.unit} de ${currentProduct.name}`);
        reset();
        return;
      }

      const movType = mode === 'IN' ? 'IN' : 'OUT';
      const payload: any = {
        productId: currentProduct.id,
        warehouseId,
        type: movType,
        quantity: Number(quantity),
        reference: reference.trim() || `Quick Entry · ${new Date().toLocaleString('es')}`,
      };
      if (mode === 'IN' && unitCost) payload.unitCost = Number(unitCost);
      await inventoryApi.registerMovement(payload);

      setHistory((h) => [
        { ts: Date.now(), code: searchCode, productName: currentProduct.name, quantity: Number(quantity), mode, warehouseName: wh?.name || '' },
        ...h.slice(0, 19),
      ]);
      toast.success(`${MODES.find((m) => m.key === mode)?.label} registrado: ${quantity} ${currentProduct.unit} de ${currentProduct.name}`);
      reset();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQtyKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      reset();
    }
  }

  const stockInWarehouse = useMemo(() => {
    if (!currentProduct) return 0;
    const s = currentProduct.stocks?.find((x: any) => x.warehouseId === warehouseId);
    return Number(s?.quantity || 0);
  }, [currentProduct, warehouseId]);

  const activeMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallback="/inventory" label="Inventario" />
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">⚡</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Entrada Rápida</h1>
            <p className="text-sm text-surface-500">Escanea → cantidad → siguiente. Soporta scanner físico y cámara.</p>
          </div>
        </div>
        <Link to="/inventory/physical-count" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
          🔢 Conteo Físico
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* COLUMNA PRINCIPAL */}
        <div className="space-y-4">
          {/* Selector de modo */}
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  mode === m.key
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-surface-900 dark:text-white">{m.label}</p>
                    <p className="text-xs text-surface-500">{m.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Bodega */}
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
            <label className="block text-xs uppercase tracking-wider text-surface-500 mb-1">Bodega</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2.5 text-base text-surface-900 dark:text-white">
              <option value="">Selecciona...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (default)' : ''}</option>)}
            </select>
          </div>

          {/* Zona principal de acción */}
          {!currentProduct ? (
            <div className="bg-white dark:bg-surface-800 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-2xl p-8 text-center">
              <p className="text-6xl mb-4">📷</p>
              <p className="text-lg font-semibold text-surface-800 dark:text-white mb-2">Escanea un código de barras o QR</p>
              <p className="text-sm text-surface-500 mb-6">
                Conecta un scanner USB (funciona automáticamente) o usa la cámara del dispositivo.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => setScannerOpen(true)} disabled={!warehouseId}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-base font-semibold shadow-lg">
                  📷 Abrir cámara
                </button>
              </div>
              <div className="mt-6">
                <form onSubmit={(e) => { e.preventDefault(); if (searchCode.trim()) lookup(searchCode.trim()); }}
                  className="flex gap-2 max-w-md mx-auto">
                  <input value={searchCode} onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="O ingresa SKU/código manualmente..."
                    className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm" />
                  <button type="submit" className="px-4 py-2 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg text-sm font-medium">
                    Buscar
                  </button>
                </form>
              </div>
              {notFoundCode && (
                <div className="mt-6 max-w-md mx-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
                  No existe producto con código <span className="font-mono font-semibold">{notFoundCode}</span>.{' '}
                  <button onClick={() => navigate(`/inventory/products/new?barcode=${encodeURIComponent(notFoundCode)}`)}
                    className="underline font-medium">Crear producto nuevo</button>
                </div>
              )}
              <p className="text-xs text-surface-400 mt-6">
                💡 Tip: Si tienes un scanner USB conectado, simplemente escanea y se procesará automáticamente.
              </p>
            </div>
          ) : (
            // PRODUCTO ENCONTRADO — capturar cantidad
            <div className={`bg-white dark:bg-surface-800 border-2 rounded-2xl p-5 shadow-lg ${activeMode.color.split(' ')[0].replace('bg-', 'border-')}`}>
              <div className="flex items-start gap-4 mb-5">
                {currentProduct.imageUrl ? (
                  <img src={currentProduct.imageUrl} alt={currentProduct.name}
                    className="w-24 h-24 rounded-xl object-cover border border-surface-200 dark:border-surface-700 flex-shrink-0" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-4xl flex-shrink-0">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${activeMode.color.split(' ')[0]}`}>
                      {activeMode.icon} {activeMode.label}
                    </span>
                    {currentProduct.sku && <span className="text-xs font-mono text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded">{currentProduct.sku}</span>}
                    {currentProduct.barcode && <span className="text-xs font-mono text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded">📊 {currentProduct.barcode}</span>}
                  </div>
                  <h2 className="text-xl font-bold text-surface-900 dark:text-white">{currentProduct.name}</h2>
                  <p className="text-sm text-surface-500">{currentProduct.category?.name || 'Sin categoría'} · {currentProduct.unit}</p>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-xs text-surface-500">Stock en bodega: </span>
                      <span className="font-mono font-bold text-surface-800 dark:text-white">{stockInWarehouse}</span>
                    </div>
                    <div>
                      <span className="text-xs text-surface-500">Costo prom: </span>
                      <span className="font-mono">${Number(currentProduct.avgCost || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={reset} className="text-surface-400 hover:text-red-500 text-xl">×</button>
              </div>

              {mode === 'COUNT' && (
                <div className="mb-3">
                  <label className="block text-xs uppercase tracking-wider text-surface-500 mb-1">Dirección del ajuste *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAdjustDir('ADJUSTMENT_IN')}
                      className={`py-2 rounded-xl border-2 text-sm font-semibold ${adjustDir === 'ADJUSTMENT_IN' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'border-surface-200 dark:border-surface-700 text-surface-500'}`}>
                      ⬆️ Entrada (+)
                    </button>
                    <button type="button" onClick={() => setAdjustDir('ADJUSTMENT_OUT')}
                      className={`py-2 rounded-xl border-2 text-sm font-semibold ${adjustDir === 'ADJUSTMENT_OUT' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'border-surface-200 dark:border-surface-700 text-surface-500'}`}>
                      ⬇️ Salida (−)
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    ⚖️ El ajuste requiere aprobación de finanzas/gerencia. Se enviará como solicitud pendiente; el motivo es obligatorio.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 mb-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-surface-500 mb-1">
                    Cantidad * <span className="lowercase text-surface-400">(Enter para confirmar)</span>
                  </label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min={0}
                    step={0.01}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={handleQtyKeyDown}
                    className="w-full bg-surface-50 dark:bg-surface-900 border-2 border-brand-500 rounded-xl px-4 py-3 text-2xl font-mono text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="0.00"
                  />
                </div>
                {mode === 'IN' && (
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-surface-500 mb-1">Costo unit. (opt)</label>
                    <input type="number" min={0} step={0.01} value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-3 text-base font-mono" />
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs uppercase tracking-wider text-surface-500 mb-1">Referencia/Motivo</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder={mode === 'IN' ? 'Ej. OC-001 / Compra de mercancía' : mode === 'OUT' ? 'Ej. Venta directa / Consumo' : 'Ej. Ajuste por conteo'}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm" />
              </div>

              {mode === 'OUT' && Number(quantity) > stockInWarehouse && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-3">
                  ⚠️ Cantidad excede stock disponible ({stockInWarehouse})
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={submit} disabled={submitting || !quantity || Number(quantity) <= 0 || (mode === 'OUT' && Number(quantity) > stockInWarehouse)}
                  className={`flex-1 py-3 ${activeMode.color} text-white rounded-xl text-base font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {submitting ? 'Procesando...' : mode === 'COUNT' ? '⚖️ Solicitar Ajuste (Enter)' : `✓ Registrar ${activeMode.label} (Enter)`}
                </button>
                <button onClick={reset} className="px-4 py-3 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 rounded-xl text-sm">
                  Esc
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA HISTORIAL */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-3 flex items-center justify-between">
              📜 Historial sesión
              <span className="text-xs text-surface-500 font-normal">{history.length}</span>
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-surface-400 italic">Aún no hay movimientos registrados en esta sesión.</p>
            ) : (
              <ul className="space-y-2 max-h-[480px] overflow-y-auto">
                {history.map((h, i) => (
                  <li key={i} className="text-xs bg-surface-50 dark:bg-surface-900/50 rounded-lg p-2 border border-surface-100 dark:border-surface-700">
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        h.mode === 'IN' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : h.mode === 'OUT' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                      }`}>
                        {MODES.find((m) => m.key === h.mode)?.icon} {h.mode}
                      </span>
                      <span className="text-surface-400 font-mono">{new Date(h.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-surface-800 dark:text-white font-medium mt-1 truncate">{h.productName}</p>
                    <p className="text-surface-500">Qty: <span className="font-mono font-semibold">{h.quantity}</span> · {h.warehouseName}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-xs text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">⌨ Atajos de teclado</p>
            <ul className="space-y-1">
              <li><kbd className="bg-blue-200 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px] font-mono">Enter</kbd> Confirmar movimiento</li>
              <li><kbd className="bg-blue-200 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd> Limpiar y volver a escanear</li>
              <li><span className="text-blue-700 dark:text-blue-400">📡 Scanner USB detectado automáticamente</span></li>
            </ul>
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onScan={lookup}
        onClose={() => setScannerOpen(false)}
        title={`${activeMode.label} — Escanea producto`}
        subtitle="Apunta la cámara al código de barras o QR del producto"
      />
    </div>
  );
}
