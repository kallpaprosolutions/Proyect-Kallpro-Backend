import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import BackButton from '../../components/ui/BackButton';
import ProductImageUpload from '../../components/ui/ProductImageUpload';
import { useToast } from '../../components/ui/Toast';

// ── Constantes de UI ───────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  IN:             { label: 'Entrada',       bg: 'bg-green-100 dark:bg-green-500/15',   text: 'text-green-700 dark:text-green-400',   icon: '↓' },
  OUT:            { label: 'Salida',        bg: 'bg-red-100 dark:bg-red-500/15',       text: 'text-red-700 dark:text-red-400',       icon: '↑' },
  ADJUSTMENT_IN:  { label: 'Ajuste +',      bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400',     icon: '⊕' },
  ADJUSTMENT_OUT: { label: 'Ajuste −',      bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400', icon: '⊖' },
  TRANSFER_IN:    { label: 'Traslado ↓',    bg: 'bg-brand-50 dark:bg-brand-500/15',   text: 'text-brand-700 dark:text-brand-400',   icon: '⇄' },
  TRANSFER_OUT:   { label: 'Traslado ↑',    bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', icon: '⇄' },
};

const VALUATION_INFO: Record<string, { label: string; color: string }> = {
  AVG:           { label: 'Promedio Ponderado', color: 'text-yellow-400' },
  FIFO:          { label: 'FIFO',               color: 'text-blue-400' },
  LIFO:          { label: 'LIFO',               color: 'text-indigo-400' },
  STANDARD_COST: { label: 'Costo Estándar',     color: 'text-purple-400' },
};

const UNITS = ['UNIDAD', 'KG', 'LT', 'MT', 'M2', 'M3', 'CAJA', 'PAQUETE', 'ROLLO', 'JUEGO', 'PAR'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: any, dec = 2) { return Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [product, setProduct] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [kardex, setKardex] = useState<any[]>([]);
  const [fifoBatches, setFifoBatches] = useState<any[]>([]);

  // filters
  const [kardexWarehouse, setKardexWarehouse] = useState('');

  // quick movement form
  const [showMovForm, setShowMovForm] = useState(false);
  const [mov, setMov] = useState({ warehouseId: '', type: 'IN', quantity: '', unitCost: '', reference: '', notes: '' });
  const [movError, setMovError] = useState('');
  const [movLoading, setMovLoading] = useState(false);

  // transfer form
  const [showTransfer, setShowTransfer] = useState(false);
  const [transfer, setTransfer] = useState({ fromWarehouseId: '', toWarehouseId: '', quantity: '', notes: '' });
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // tabs
  const [activeTab, setActiveTab] = useState<'kardex' | 'warehouses' | 'lots' | 'valuation' | 'image' | 'edit'>('kardex');

  // edit form
  const [editForm, setEditForm] = useState({ name: '', description: '', sku: '', barcode: '', salePrice: '', minStock: '', maxStock: '', reorderPoint: '', unit: '', categoryId: '', allowNegativeStock: false, purchaseUnit: '', purchaseConversionFactor: '1' });
  const [categories, setCategories] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');

  // valuation
  const [valForm, setValForm] = useState({ valuationMethod: 'AVG', standardCost: '' });
  const [valLoading, setValLoading] = useState(false);
  const [valSuccess, setValSuccess] = useState(false);

  // mín/máx por bodega (C1 — override de ProductStock, sobrescribe el default del producto)
  const [editingThresholdsFor, setEditingThresholdsFor] = useState<string | null>(null);
  const [thresholdsForm, setThresholdsForm] = useState({ minStock: '', maxStock: '' });
  const [thresholdsLoading, setThresholdsLoading] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadProduct = async () => {
    const r = await inventoryApi.getProduct(id!);
    const p = r.data;
    setProduct(p);
    setValForm({ valuationMethod: p.valuationMethod || 'AVG', standardCost: p.standardCost?.toString() || '' });
    setEditForm({
      name: p.name || '',
      description: p.description || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      salePrice: p.salePrice?.toString() || '',
      minStock: p.minStock?.toString() || '',
      maxStock: p.maxStock?.toString() || '',
      reorderPoint: p.reorderPoint?.toString() || '',
      unit: p.unit || 'UNIDAD',
      categoryId: p.categoryId || '',
      allowNegativeStock: !!p.allowNegativeStock,
      purchaseUnit: p.purchaseUnit || '',
      purchaseConversionFactor: p.purchaseConversionFactor?.toString() || '1',
    });
  };

  const loadKardex = async () => {
    const r = await inventoryApi.getKardex(id!, kardexWarehouse || undefined);
    setKardex(r.data);
  };

  useEffect(() => {
    loadProduct();
    inventoryApi.getWarehouses().then((r) => setWarehouses(r.data));
    inventoryApi.getCategories().then((r) => setCategories(r.data));
  }, [id]);

  useEffect(() => { loadKardex(); }, [id, kardexWarehouse]);

  useEffect(() => {
    if (product?.valuationMethod === 'FIFO' || product?.valuationMethod === 'LIFO') {
      inventoryApi.getFifoBatches(id!).then((r) => setFifoBatches(r.data));
    }
  }, [product]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleMovSubmit = async () => {
    if (!mov.warehouseId || !mov.quantity) { setMovError('Bodega y cantidad son requeridos'); return; }
    const isAdjustment = mov.type === 'ADJUSTMENT_IN' || mov.type === 'ADJUSTMENT_OUT';
    setMovLoading(true); setMovError('');
    try {
      if (isAdjustment) {
        // Doble autorización: se crea una solicitud pendiente, no mueve stock aún.
        const reason = (mov.reference || mov.notes || '').trim();
        if (reason.length < 3) { setMovError('Indica el motivo del ajuste en el campo "Motivo"'); setMovLoading(false); return; }
        await inventoryApi.createAdjustment({
          productId: id!,
          warehouseId: mov.warehouseId,
          type: mov.type as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
          quantity: Number(mov.quantity),
          unitCost: mov.unitCost ? Number(mov.unitCost) : undefined,
          reason,
        });
        setMov({ warehouseId: '', type: 'IN', quantity: '', unitCost: '', reference: '', notes: '' });
        setShowMovForm(false);
        toast.success('Ajuste enviado a aprobación de finanzas/gerencia. El stock cambiará cuando sea aprobado.');
        return;
      }
      await inventoryApi.registerMovement({
        productId: id!,
        warehouseId: mov.warehouseId,
        type: mov.type,
        quantity: Number(mov.quantity),
        unitCost: mov.unitCost ? Number(mov.unitCost) : undefined,
        reference: mov.reference || undefined,
        notes: mov.notes || undefined,
      });
      setMov({ warehouseId: '', type: 'IN', quantity: '', unitCost: '', reference: '', notes: '' });
      setShowMovForm(false);
      await loadProduct();
      await loadKardex();
    } catch (e: any) {
      setMovError(e.response?.data?.error || 'Error al registrar movimiento');
    } finally { setMovLoading(false); }
  };

  const handleTransferSubmit = async () => {
    if (!transfer.fromWarehouseId || !transfer.toWarehouseId || !transfer.quantity) {
      setTransferError('Completa todos los campos'); return;
    }
    if (transfer.fromWarehouseId === transfer.toWarehouseId) {
      setTransferError('Origen y destino no pueden ser iguales'); return;
    }
    setTransferLoading(true); setTransferError('');
    try {
      await inventoryApi.transferStock({
        productId: id!,
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        quantity: Number(transfer.quantity),
        notes: transfer.notes || undefined,
      });
      setTransfer({ fromWarehouseId: '', toWarehouseId: '', quantity: '', notes: '' });
      setShowTransfer(false);
      await loadProduct();
      await loadKardex();
    } catch (e: any) {
      setTransferError(e.response?.data?.error || 'Error al transferir');
    } finally { setTransferLoading(false); }
  };

  const startEditThresholds = (stock: any) => {
    setEditingThresholdsFor(stock.warehouseId);
    setThresholdsForm({
      minStock: stock.minStock != null ? String(stock.minStock) : '',
      maxStock: stock.maxStock != null ? String(stock.maxStock) : '',
    });
  };

  const handleSaveThresholds = async (warehouseId: string) => {
    setThresholdsLoading(true);
    try {
      await inventoryApi.updateStockThresholds(id!, warehouseId, {
        minStock: thresholdsForm.minStock === '' ? null : Number(thresholdsForm.minStock),
        maxStock: thresholdsForm.maxStock === '' ? null : Number(thresholdsForm.maxStock),
      });
      setEditingThresholdsFor(null);
      await loadProduct();
      toast.success('Mín/máx de la bodega actualizado');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo actualizar el mín/máx', 'Error');
    } finally { setThresholdsLoading(false); }
  };

  const handleEditSave = async () => {
    setEditLoading(true); setEditError(''); setEditSuccess('');
    try {
      await inventoryApi.updateProduct(id!, {
        name: editForm.name,
        description: editForm.description || undefined,
        sku: editForm.sku || undefined,
        barcode: editForm.barcode || undefined,
        salePrice: Number(editForm.salePrice),
        minStock: editForm.minStock ? Number(editForm.minStock) : 0,
        maxStock: editForm.maxStock ? Number(editForm.maxStock) : undefined,
        reorderPoint: editForm.reorderPoint ? Number(editForm.reorderPoint) : 0,
        unit: editForm.unit,
        categoryId: editForm.categoryId || undefined,
        allowNegativeStock: editForm.allowNegativeStock,
        purchaseUnit: editForm.purchaseUnit.trim() || null,
        purchaseConversionFactor: editForm.purchaseUnit.trim() ? Number(editForm.purchaseConversionFactor || 1) : 1,
      });
      setEditSuccess('Cambios guardados');
      await loadProduct();
      setTimeout(() => setEditSuccess(''), 3000);
    } catch (e: any) {
      setEditError(e.response?.data?.error || 'Error al guardar');
    } finally { setEditLoading(false); }
  };

  const handleValSave = async () => {
    setValLoading(true);
    try {
      await inventoryApi.updateValuation(id!, {
        valuationMethod: valForm.valuationMethod as any,
        standardCost: valForm.valuationMethod === 'STANDARD_COST' ? Number(valForm.standardCost) : undefined,
      });
      setValSuccess(true);
      await loadProduct();
      setTimeout(() => setValSuccess(false), 3000);
    } catch {
      // silent
    } finally { setValLoading(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  if (!product) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  const totalStock = product.stocks?.reduce((s: number, st: any) => s + Number(st.quantity), 0) ?? 0;
  const totalReserved = product.stocks?.reduce((s: number, st: any) => s + Number(st.reserved), 0) ?? 0;
  const available = totalStock - totalReserved;
  const reorderPoint = Number(product.reorderPoint ?? 0);
  const minStock = Number(product.minStock ?? 0);

  const stockStatus =
    available <= 0 ? { label: 'Sin Stock', color: 'text-red-400', bg: 'bg-red-500/15' } :
    available <= reorderPoint && reorderPoint > 0 ? { label: '⚠ Reorden', color: 'text-yellow-400', bg: 'bg-yellow-500/15' } :
    available <= minStock ? { label: '↓ Stock Bajo', color: 'text-orange-400', bg: 'bg-orange-500/15' } :
    { label: '✓ Normal', color: 'text-green-400', bg: 'bg-green-500/15' };

  const activeBatches = fifoBatches.filter((b: any) => !b.isExhausted);
  const nearExpiry = activeBatches.filter((b: any) => {
    const d = daysUntil(b.expiryDate);
    return d !== null && d <= 30;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'kardex', label: '📋 Kardex' },
    { id: 'warehouses', label: `🏭 Bodegas (${product.stocks?.length ?? 0})` },
    { id: 'lots', label: `📦 Lotes${nearExpiry.length > 0 ? ` ⚠${nearExpiry.length}` : ''}` },
    { id: 'valuation', label: '⚖️ Valoración' },
    { id: 'image', label: product.imageUrl ? '🖼️ Imagen' : '🖼️ Imagen +' },
    { id: 'edit', label: '✏️ Editar' },
  ];

  return (
    <div className="max-w-full">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallback="/inventory" label="Inventario" />
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name}
              className="w-14 h-14 rounded-xl object-cover border border-surface-200 dark:border-surface-700" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-2xl">📦</div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{product.name}</h1>
              {product.sku && <span className="text-xs text-surface-500 font-mono bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded">{product.sku}</span>}
              {product.barcode && (
                <span className="text-xs text-surface-500 font-mono bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded flex items-center gap-1">
                  <span>▌▌▌</span>{product.barcode}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                {stockStatus.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 ${VALUATION_INFO[product.valuationMethod]?.color ?? 'text-surface-500'}`}>
                {VALUATION_INFO[product.valuationMethod]?.label ?? product.valuationMethod}
              </span>
              {product.allowNegativeStock && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" title="Puede venderse/despacharse sin existencia física">
                  Stock negativo permitido
                </span>
              )}
              {product.purchaseUnit && Number(product.purchaseConversionFactor) !== 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  title={`Se compra por ${product.purchaseUnit}, el stock se cuenta en ${product.unit}`}>
                  Compra: 1 {product.purchaseUnit} = {Number(product.purchaseConversionFactor)} {product.unit}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowTransfer(true); setShowMovForm(false); }}
            className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors font-medium">
            ⇄ Trasladar
          </button>
          <button onClick={() => { setShowMovForm(true); setShowTransfer(false); }}
            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium">
            + Movimiento
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-0 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden mb-4 shadow-soft">
        {[
          { label: 'Stock Total', value: `${fmt(totalStock, 0)} ${product.unit}`, color: 'text-surface-900 dark:text-white' },
          { label: 'Disponible', value: `${fmt(available, 0)} ${product.unit}`, color: 'text-green-600 dark:text-green-400' },
          { label: 'Reservado', value: `${fmt(totalReserved, 0)} ${product.unit}`, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Costo Avg', value: `$${fmt(product.avgCost, 4)}`, color: 'text-brand-600 dark:text-brand-400' },
          { label: 'Precio Venta', value: `$${fmt(product.salePrice, 2)}`, color: 'text-surface-900 dark:text-white' },
          { label: 'Pt. Reorden', value: reorderPoint > 0 ? `${fmt(reorderPoint, 0)} ${product.unit}` : '—', color: reorderPoint > 0 && available <= reorderPoint ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-500' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-50 dark:bg-surface-900/50 px-4 py-3 border-r border-surface-200 dark:border-surface-700 last:border-r-0">
            <p className="text-surface-500 text-xs">{kpi.label}</p>
            <p className={`font-bold text-sm mt-0.5 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Movement Form */}
      {showMovForm && (
        <div className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-5 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white">Registrar Movimiento</h3>
            <button onClick={() => { setShowMovForm(false); setMovError(''); }} className="ml-auto text-surface-400 hover:text-surface-700 dark:hover:text-white text-xs">✕ Cerrar</button>
          </div>
          {movError && <p className="text-red-600 dark:text-red-400 text-xs mb-2">{movError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select value={mov.type} onChange={(e) => setMov({ ...mov, type: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT_IN">Ajuste +</option>
              <option value="ADJUSTMENT_OUT">Ajuste −</option>
            </select>
            <select value={mov.warehouseId} onChange={(e) => setMov({ ...mov, warehouseId: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Bodega…</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="number" placeholder="Cantidad" value={mov.quantity}
              onChange={(e) => setMov({ ...mov, quantity: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input type="number" placeholder="Costo unit. (opcional)" value={mov.unitCost}
              onChange={(e) => setMov({ ...mov, unitCost: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input type="text"
              placeholder={mov.type === 'ADJUSTMENT_IN' || mov.type === 'ADJUSTMENT_OUT' ? 'Motivo del ajuste *' : 'Referencia'}
              value={mov.reference}
              onChange={(e) => setMov({ ...mov, reference: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={handleMovSubmit} disabled={movLoading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
              {movLoading ? '...' : (mov.type === 'ADJUSTMENT_IN' || mov.type === 'ADJUSTMENT_OUT') ? 'Solicitar' : 'Guardar'}
            </button>
          </div>
          {(mov.type === 'ADJUSTMENT_IN' || mov.type === 'ADJUSTMENT_OUT') && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚖️ Los ajustes requieren aprobación de finanzas/gerencia: se enviará como solicitud pendiente y el stock cambiará al aprobarse.
            </p>
          )}
        </div>
      )}

      {/* Transfer Form */}
      {showTransfer && (
        <div className="bg-surface-50 dark:bg-surface-800 border border-brand-200 dark:border-brand-700/40 rounded-xl px-5 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-sm text-brand-600 dark:text-brand-400">⇄ Traslado entre Bodegas</h3>
            <button onClick={() => { setShowTransfer(false); setTransferError(''); }} className="ml-auto text-surface-400 hover:text-surface-700 dark:hover:text-white text-xs">✕ Cerrar</button>
          </div>
          {transferError && <p className="text-red-600 dark:text-red-400 text-xs mb-2">{transferError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 items-center">
            <select value={transfer.fromWarehouseId} onChange={(e) => setTransfer({ ...transfer, fromWarehouseId: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Origen…</option>
              {warehouses.map((w: any) => {
                const stock = product.stocks?.find((s: any) => s.warehouseId === w.id);
                return <option key={w.id} value={w.id}>{w.name} ({fmt(stock?.quantity ?? 0, 0)} {product.unit})</option>;
              })}
            </select>
            <div className="flex items-center justify-center text-surface-400">→</div>
            <select value={transfer.toWarehouseId} onChange={(e) => setTransfer({ ...transfer, toWarehouseId: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Destino…</option>
              {warehouses.filter((w: any) => w.id !== transfer.fromWarehouseId).map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <input type="number" placeholder={`Cantidad (${product.unit})`} value={transfer.quantity}
              onChange={(e) => setTransfer({ ...transfer, quantity: e.target.value })}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={handleTransferSubmit} disabled={transferLoading}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
              {transferLoading ? '...' : '⇄ Trasladar'}
            </button>
          </div>
          {transfer.fromWarehouseId && transfer.toWarehouseId && transfer.quantity && (
            <div className="mt-3 flex gap-4 text-xs text-surface-500">
              {[
                { id: transfer.fromWarehouseId, label: 'Origen', delta: -Number(transfer.quantity) },
                { id: transfer.toWarehouseId, label: 'Destino', delta: +Number(transfer.quantity) },
              ].map(({ id: wid, label, delta }) => {
                const w = warehouses.find((x: any) => x.id === wid);
                const stock = product.stocks?.find((s: any) => s.warehouseId === wid);
                const current = Number(stock?.quantity ?? 0);
                const after = current + delta;
                return (
                  <div key={wid} className="bg-white dark:bg-surface-800/60 rounded-lg px-3 py-2 border border-surface-200 dark:border-surface-700">
                    <span className="text-surface-500">{label}: </span>
                    <span className="font-mono text-surface-700 dark:text-surface-300">{fmt(current, 0)}</span>
                    <span className="text-surface-400 mx-1">→</span>
                    <span className={`font-mono font-bold ${after < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{fmt(after, 0)}</span>
                    <span className="text-surface-400 ml-1">{product.unit}</span>
                    <span className="text-surface-400 ml-2">({w?.name})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface-200 dark:border-surface-700 px-1 gap-0 overflow-x-auto mb-4">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`text-xs px-4 py-2.5 font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>

        {/* ═══════════════════ KARDEX ═══════════════════ */}
        {activeTab === 'kardex' && (
          <div>
            {/* Filtros */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="font-semibold text-sm text-surface-800 dark:text-white">Historial de Movimientos</h2>
              <select value={kardexWarehouse} onChange={(e) => setKardexWarehouse(e.target.value)}
                className="ml-auto bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Todas las bodegas</option>
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <span className="text-xs text-surface-500">{kardex.length} movimientos</span>
            </div>

            {kardex.length === 0 ? (
              <div className="text-center py-12 text-surface-400 text-sm">Sin movimientos registrados</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500">
                      <th className="text-left px-3 py-2.5">Fecha</th>
                      <th className="text-left px-3 py-2.5">Tipo</th>
                      <th className="text-left px-3 py-2.5">Bodega / Ruta</th>
                      <th className="text-right px-3 py-2.5">Cantidad</th>
                      <th className="text-right px-3 py-2.5">Costo U.</th>
                      <th className="text-right px-3 py-2.5">Total</th>
                      <th className="text-right px-3 py-2.5">Costo Prom.</th>
                      <th className="text-right px-3 py-2.5">Stock</th>
                      <th className="text-right px-3 py-2.5">Saldo valorado</th>
                      <th className="text-left px-3 py-2.5">Lote</th>
                      <th className="text-left px-3 py-2.5">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardex.map((m: any, i: number) => {
                      const meta = TYPE_META[m.type] ?? { label: m.type, bg: 'bg-surface-100 dark:bg-surface-700', text: 'text-surface-500', icon: '•' };
                      const isTransfer = m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT';
                      const batchDays = m.batch?.expiryDate ? daysUntil(m.batch.expiryDate) : null;

                      return (
                        <tr key={m.id} className={`border-b border-surface-100 dark:border-surface-800/50 ${i % 2 === 0 ? 'bg-surface-50/50 dark:bg-surface-900/20' : ''} hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors`}>
                          <td className="px-3 py-2 text-surface-500 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${meta.bg} ${meta.text}`}>
                              <span>{meta.icon}</span>{meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {isTransfer && m.fromWarehouse && m.toWarehouse ? (
                              <div className="flex items-center gap-1 text-xs">
                                <span className={`${m.type === 'TRANSFER_OUT' ? 'font-bold text-surface-900 dark:text-white' : 'text-surface-500'}`}>
                                  {m.fromWarehouse.name}
                                </span>
                                <span className="text-surface-400">→</span>
                                <span className={`${m.type === 'TRANSFER_IN' ? 'font-bold text-surface-900 dark:text-white' : 'text-surface-500'}`}>
                                  {m.toWarehouse.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-surface-700 dark:text-surface-300">{m.warehouse?.name}</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-medium ${m.type.includes('OUT') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {m.type.includes('OUT') ? '−' : '+'}{fmt(m.quantity, 2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">${fmt(m.unitCost, 4)}</td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">${fmt(m.totalCost, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-surface-500">${fmt(m.avgCostAfter, 4)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-surface-900 dark:text-white">{fmt(m.stockAfter, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300">${fmt(m.runningValue, 2)}</td>
                          <td className="px-3 py-2">
                            {m.batch?.lotNumber && (
                              <div>
                                <span className="text-brand-600 dark:text-brand-400 font-mono text-xs">{m.batch.lotNumber}</span>
                                {m.batch.expiryDate && (
                                  <div className={`text-xs ${batchDays !== null && batchDays <= 7 ? 'text-red-600 dark:text-red-400' : batchDays !== null && batchDays <= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-500'}`}>
                                    Vence: {fmtDate(m.batch.expiryDate)}
                                    {batchDays !== null && ` (${batchDays}d)`}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-surface-500 text-xs max-w-xs truncate">{m.reference}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ BODEGAS ═══════════════════ */}
        {activeTab === 'warehouses' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-semibold text-sm text-surface-800 dark:text-white">Stock por Bodega</h2>
              <button onClick={() => { setShowTransfer(true); setActiveTab('kardex'); }}
                className="ml-auto text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors">
                ⇄ Nuevo Traslado
              </button>
            </div>

            {!product.stocks?.length ? (
              <p className="text-surface-400 text-sm">Sin stock registrado en ninguna bodega.</p>
            ) : (
              <div className="space-y-3">
                {product.stocks.map((s: any) => {
                  const qty = Number(s.quantity);
                  const reserved = Number(s.reserved);
                  const avail = qty - reserved;
                  const pct = totalStock > 0 ? (qty / totalStock) * 100 : 0;
                  return (
                    <div key={s.id} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-surface-800 dark:text-white">{s.warehouse?.name}</span>
                          {s.warehouse?.code && (
                            <span className="text-xs text-surface-500 bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded font-mono">{s.warehouse.code}</span>
                          )}
                          {s.warehouse?.isDefault && (
                            <span className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/10 px-1.5 py-0.5 rounded">Principal</span>
                          )}
                          {qty < 0 && (
                            <span className="text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-1.5 py-0.5 rounded font-medium">⚠ Stock negativo</span>
                          )}
                        </div>
                        <span className={`font-bold text-base ${qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{fmt(qty, 2)} <span className="text-surface-500 font-normal text-sm">{product.unit}</span></span>
                      </div>
                      <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full mb-2">
                        <div className="h-1.5 bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-surface-500 mb-2">
                        <span>Disponible: <strong className="text-green-600 dark:text-green-400">{fmt(avail, 2)}</strong></span>
                        <span>Reservado: <strong className="text-yellow-600 dark:text-yellow-400">{fmt(reserved, 2)}</strong></span>
                        <span className="ml-auto text-surface-400">{fmt(pct, 1)}% del total</span>
                      </div>

                      {/* C1 — mín/máx por bodega (override del default del producto) */}
                      {editingThresholdsFor === s.warehouseId ? (
                        <div className="flex items-center gap-2 text-xs pt-2 border-t border-surface-100 dark:border-surface-700">
                          <label className="text-surface-500">Mín</label>
                          <input type="number" min={0} value={thresholdsForm.minStock}
                            onChange={(e) => setThresholdsForm({ ...thresholdsForm, minStock: e.target.value })}
                            placeholder={fmt(product.minStock, 0)}
                            className="w-20 px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-800 dark:text-white" />
                          <label className="text-surface-500">Máx</label>
                          <input type="number" min={0} value={thresholdsForm.maxStock}
                            onChange={(e) => setThresholdsForm({ ...thresholdsForm, maxStock: e.target.value })}
                            placeholder={product.maxStock != null ? fmt(product.maxStock, 0) : 'sin límite'}
                            className="w-24 px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-800 dark:text-white" />
                          <button disabled={thresholdsLoading} onClick={() => handleSaveThresholds(s.warehouseId)}
                            className="px-2 py-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded font-medium">Guardar</button>
                          <button onClick={() => setEditingThresholdsFor(null)}
                            className="px-2 py-1 text-surface-500 hover:text-surface-700 dark:hover:text-white">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs pt-2 border-t border-surface-100 dark:border-surface-700 text-surface-500">
                          <span>
                            Mín/Máx de esta bodega: <strong className="text-surface-700 dark:text-surface-300">
                              {s.minStock != null ? fmt(s.minStock, 0) : `${fmt(product.minStock, 0)} (default)`}
                              {' / '}
                              {s.maxStock != null ? fmt(s.maxStock, 0) : (product.maxStock != null ? `${fmt(product.maxStock, 0)} (default)` : 'sin límite')}
                            </strong>
                          </span>
                          <button onClick={() => startEditThresholds(s)} className="ml-auto text-brand-600 dark:text-brand-400 hover:underline">
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ LOTES ═══════════════════ */}
        {activeTab === 'lots' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-semibold text-sm text-surface-800 dark:text-white">Trazabilidad de Lotes</h2>
              {nearExpiry.length > 0 && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                  ⚠ {nearExpiry.length} lote{nearExpiry.length > 1 ? 's' : ''} próximo{nearExpiry.length > 1 ? 's' : ''} a vencer
                </span>
              )}
            </div>

            {fifoBatches.length === 0 ? (
              <p className="text-surface-400 text-sm">Sin lotes registrados. Los lotes se crean automáticamente con el método FIFO/LIFO.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500">
                      <th className="text-left px-3 py-2.5">Nº Lote</th>
                      <th className="text-left px-3 py-2.5">Lote Proveedor</th>
                      <th className="text-left px-3 py-2.5">Bodega</th>
                      <th className="text-left px-3 py-2.5">Fecha Entrada</th>
                      <th className="text-left px-3 py-2.5">Vencimiento</th>
                      <th className="text-right px-3 py-2.5">Qty Inicial</th>
                      <th className="text-right px-3 py-2.5">Qty Restante</th>
                      <th className="text-right px-3 py-2.5">Costo Unit.</th>
                      <th className="text-right px-3 py-2.5">Valor</th>
                      <th className="text-left px-3 py-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fifoBatches.map((b: any) => {
                      const days = daysUntil(b.expiryDate);
                      const expColor = days === null ? '' : days <= 0 ? 'text-red-600 dark:text-red-400' : days <= 7 ? 'text-red-600 dark:text-red-400' : days <= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-700 dark:text-surface-300';
                      const pctUsed = b.initialQty > 0 ? (1 - Number(b.remainingQty) / Number(b.initialQty)) * 100 : 0;

                      return (
                        <tr key={b.id} className={`border-b border-surface-100 dark:border-surface-800/50 ${b.isExhausted ? 'opacity-40' : ''} hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors`}>
                          <td className="px-3 py-2 font-mono text-brand-600 dark:text-brand-400">{b.lotNumber || '—'}</td>
                          <td className="px-3 py-2 text-surface-500">{b.supplierBatch || '—'}</td>
                          <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{b.warehouse?.name}</td>
                          <td className="px-3 py-2 text-surface-500">{fmtDate(b.receivedAt)}</td>
                          <td className={`px-3 py-2 font-medium ${expColor}`}>
                            {b.expiryDate ? (
                              <>{fmtDate(b.expiryDate)}{days !== null && <span className="ml-1 text-xs">({days}d)</span>}</>
                            ) : <span className="text-surface-400">Sin vto.</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">{fmt(b.initialQty, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">
                            <div>{fmt(b.remainingQty, 2)}</div>
                            <div className="w-16 h-1 bg-surface-200 dark:bg-surface-700 rounded-full mt-0.5 ml-auto">
                              <div className="h-1 bg-brand-500 rounded-full" style={{ width: `${100 - pctUsed}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">${fmt(b.unitCost, 4)}</td>
                          <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">${fmt(Number(b.remainingQty) * Number(b.unitCost), 2)}</td>
                          <td className="px-3 py-2">
                            {b.isExhausted ? (
                              <span className="text-surface-400">Agotado</span>
                            ) : days !== null && days <= 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-medium">Vencido</span>
                            ) : days !== null && days <= 7 ? (
                              <span className="text-red-600 dark:text-red-400">⚠ Vence pronto</span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400">Activo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VALORACIÓN */}
        {activeTab === 'valuation' && (
          <div className="max-w-lg space-y-4">
            <h2 className="font-semibold text-sm text-surface-800 dark:text-white mb-3">Método de Valoración</h2>
            {(['AVG', 'FIFO', 'LIFO', 'STANDARD_COST'] as const).map((m) => (
              <label key={m} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${valForm.valuationMethod === m
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/5'
                : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-surface-300 dark:hover:border-surface-600'}`}>
                <input type="radio" name="valMethod" value={m} checked={valForm.valuationMethod === m}
                  onChange={() => setValForm({ ...valForm, valuationMethod: m })}
                  className="mt-0.5 accent-brand-500" />
                <div className="flex-1">
                  <p className={`font-medium text-sm ${VALUATION_INFO[m].color}`}>{VALUATION_INFO[m].label}</p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {m === 'AVG' && 'Recalcula el costo promedio en cada entrada. Recomendado para mayoría de productos.'}
                    {m === 'FIFO' && 'Consume el lote más antiguo primero. Ideal para productos perecederos.'}
                    {m === 'LIFO' && 'Consume el lote más reciente primero. Permite diferir impuestos en inflación.'}
                    {m === 'STANDARD_COST' && 'Usa un costo fijo definido por la empresa. Ideal para manufactura.'}
                  </p>
                  {m === 'STANDARD_COST' && valForm.valuationMethod === 'STANDARD_COST' && (
                    <input type="number" placeholder="Costo estándar unitario"
                      value={valForm.standardCost}
                      onChange={(e) => setValForm({ ...valForm, standardCost: e.target.value })}
                      className="mt-2 w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  )}
                </div>
              </label>
            ))}
            <button onClick={handleValSave} disabled={valLoading}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {valLoading ? 'Guardando...' : valSuccess ? '✓ Guardado' : 'Guardar Método'}
            </button>
          </div>
        )}

        {/* IMAGEN */}
        {activeTab === 'image' && (
          <div className="max-w-2xl">
            <h2 className="font-semibold text-sm text-surface-800 dark:text-white mb-3">Imagen del producto</h2>
            <p className="text-xs text-surface-500 mb-4">
              Sube una imagen referencial. Se mostrará en listados, escaneos y entradas rápidas. Formatos: PNG, JPG, WEBP, GIF (máx 5 MB).
            </p>
            <ProductImageUpload
              productId={product.id}
              currentImageUrl={product.imageUrl}
              onUploaded={(url) => setProduct({ ...product, imageUrl: url })}
              size="lg"
            />
          </div>
        )}

        {/* EDITAR */}
        {activeTab === 'edit' && (
          <div className="max-w-2xl">
            <h2 className="font-semibold text-sm text-surface-800 dark:text-white mb-4">Editar Producto</h2>
            {editSuccess && <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg text-sm mb-3">{editSuccess}</div>}
            {editError && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm mb-3">{editError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-surface-500 mb-1">Nombre *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">SKU</label>
                <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Código de Barras / QR</label>
                <div className="flex gap-1">
                  <input ref={barcodeInputRef} value={editForm.barcode} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    placeholder="Escanear o ingresar manualmente"
                    className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
                  <button onClick={() => barcodeInputRef.current?.focus()}
                    className="bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 px-2.5 rounded-lg text-sm" title="Listo para escanear">
                    ▌▌▌
                  </button>
                </div>
                <p className="text-xs text-surface-400 mt-0.5">Conecta un lector de código de barras USB y escanea directamente</p>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Precio de Venta ($)</label>
                <input type="number" value={editForm.salePrice} onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Unidad de medida</label>
                <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Stock Mínimo</label>
                <input type="number" value={editForm.minStock} onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Stock Máximo</label>
                <input type="number" value={editForm.maxStock} onChange={(e) => setEditForm({ ...editForm, maxStock: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">
                  Punto de Reorden <span className="text-surface-400 font-normal">(calculado automático o manual)</span>
                </label>
                <input type="number" value={editForm.reorderPoint} onChange={(e) => setEditForm({ ...editForm, reorderPoint: e.target.value })}
                  placeholder="0 = calculado automático"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Categoría</label>
                <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Sin categoría</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-surface-500 mb-1">Descripción</label>
                <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <div className="col-span-2 bg-surface-50 dark:bg-surface-900/40 border border-surface-200 dark:border-surface-700 rounded-lg p-3">
                <p className="text-sm font-medium text-surface-800 dark:text-white mb-1">Unidad de compra (opcional)</p>
                <p className="text-xs text-surface-500 mb-2">
                  Si el proveedor vende por CAJA/PAQUETE pero el stock y la venta siguen en {editForm.unit || 'la unidad de stock'},
                  configúralo acá — al crear la Orden de Compra podrás ingresar la cantidad en la unidad de compra y se convierte sola.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-surface-500 mb-1">Unidad de compra</label>
                    <input value={editForm.purchaseUnit} onChange={(e) => setEditForm({ ...editForm, purchaseUnit: e.target.value })}
                      placeholder="Ej: CAJA, PAQUETE, PALETA"
                      className="w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-surface-500 mb-1">
                      1 {editForm.purchaseUnit || 'unidad de compra'} = ? {editForm.unit || 'unidad de stock'}
                    </label>
                    <input type="number" min={0} step="any" disabled={!editForm.purchaseUnit.trim()}
                      value={editForm.purchaseConversionFactor}
                      onChange={(e) => setEditForm({ ...editForm, purchaseConversionFactor: e.target.value })}
                      className="w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50" />
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2.5">
                <input type="checkbox" id="allowNegativeStock" checked={editForm.allowNegativeStock}
                  onChange={(e) => setEditForm({ ...editForm, allowNegativeStock: e.target.checked })}
                  className="mt-0.5 rounded border-surface-300 text-amber-600 focus:ring-amber-500" />
                <label htmlFor="allowNegativeStock" className="text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                  <span className="font-medium">Permitir stock negativo</span>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Permite vender, despachar o transferir este producto sin existencia física
                    (venta contra pedido a proveedor, insumo que se repone el mismo día, etc.).
                    Por defecto está bloqueado: el sistema no deja bajar de cero.
                  </p>
                </label>
              </div>
              <div className="col-span-2 flex gap-2">
                <button onClick={handleEditSave} disabled={editLoading}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  {editLoading ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
