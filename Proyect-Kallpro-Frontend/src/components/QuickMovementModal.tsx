import { useState, useEffect } from 'react';
import { inventoryApi } from '../api/inventory';
import { ollamaApi } from '../api/ollama';
import { useToast } from './ui/Toast';

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER';

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  avgCost: number;
  valuationMethod: string;
  stocks: { warehouseId: string; quantity: number; reserved: number; warehouse: { id: string; name: string } }[];
}

interface Warehouse {
  id: string;
  name: string;
  code?: string;
}

interface Props {
  productId?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;   // alias — se acepta cualquiera de los dos
}

const TYPE_CONFIG = {
  IN:              { label: 'Entrada',       color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700',  icon: '📥' },
  OUT:             { label: 'Salida',        color: 'text-red-400',    bg: 'bg-red-900/30 border-red-700',      icon: '📤' },
  TRANSFER:        { label: 'Transferencia', color: 'text-blue-400',   bg: 'bg-blue-900/30 border-blue-700',    icon: '🔄' },
  ADJUSTMENT_IN:   { label: 'Ajuste +',     color: 'text-cyan-400',   bg: 'bg-cyan-900/30 border-cyan-700',    icon: '⬆️' },
  ADJUSTMENT_OUT:  { label: 'Ajuste -',     color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-700',icon: '⬇️' },
};

export default function QuickMovementModal({ productId, onClose, onSuccess, onSaved }: Props) {
  const toast = useToast();
  const notifySuccess = () => { onSuccess?.(); onSaved?.(); };
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedProductId, setSelectedProductId] = useState(productId || '');
  const [movType, setMovType] = useState<MovementType>('IN');
  const [warehouseId, setWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    Promise.all([inventoryApi.getProducts(), inventoryApi.getWarehouses()])
      .then(([pr, wr]) => {
        setProducts(pr.data);
        setWarehouses(wr.data);
        if (wr.data.length > 0) setWarehouseId(wr.data[0].id);
        if (productId) {
          const p = pr.data.find((x: Product) => x.id === productId);
          if (p) {
            setUnitCost(String(p.avgCost));
            setProductSearch(p.name);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const filteredProducts = productSearch
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
      )
    : products.slice(0, 10);

  const availableStock = selectedProduct
    ? selectedProduct.stocks
        .filter(s => s.warehouseId === warehouseId)
        .reduce((sum, s) => sum + s.quantity - s.reserved, 0)
    : 0;

  async function suggestCost() {
    if (!selectedProduct) return;
    setAiLoading(true);
    try {
      const res = await ollamaApi.ask(
        `El producto "${selectedProduct.name}" tiene un costo promedio actual de $${selectedProduct.avgCost}. ` +
        `Sugiere un costo unitario razonable para una nueva entrada considerando que la unidad es "${selectedProduct.unit}". ` +
        `Responde SOLO con el número, sin símbolos ni texto adicional.`,
        'inventario'
      );
      const num = parseFloat(res.data.answer?.replace(/[^0-9.]/g, '') || '');
      if (!isNaN(num) && num > 0) setUnitCost(String(num));
    } catch { /* noop */ }
    setAiLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId || !warehouseId || !quantity) {
      setError('Completa producto, bodega y cantidad');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (movType === 'TRANSFER') {
        if (!toWarehouseId || toWarehouseId === warehouseId) {
          setError('Selecciona una bodega destino diferente');
          setSubmitting(false);
          return;
        }
        await inventoryApi.transferStock({
          fromWarehouseId: warehouseId,
          toWarehouseId,
          productId: selectedProductId,
          quantity: parseFloat(quantity),
          notes,
        });
      } else if (movType === 'ADJUSTMENT_IN' || movType === 'ADJUSTMENT_OUT') {
        // Los ajustes pasan por doble autorización: se crea una SOLICITUD pendiente,
        // el stock solo cambia cuando finanzas/gerencia la aprueba.
        if (!notes || notes.trim().length < 3) {
          setError('Indica el motivo del ajuste en el campo Notas (mín. 3 caracteres)');
          setSubmitting(false);
          return;
        }
        await inventoryApi.createAdjustment({
          productId: selectedProductId,
          warehouseId,
          type: movType,
          quantity: parseFloat(quantity),
          unitCost: unitCost ? parseFloat(unitCost) : undefined,
          reason: notes.trim(),
          notes: reference || undefined,
        });
        toast.success('Ajuste enviado a aprobación de finanzas/gerencia. El stock cambiará cuando sea aprobado.');
      } else {
        // Incluir nº lote en referencia si se ingresó
        const refWithLot = lotNumber
          ? `${reference || ''} LOT:${lotNumber}`.trim()
          : reference || undefined;
        await inventoryApi.registerMovement({
          productId: selectedProductId,
          warehouseId,
          type: movType,
          quantity: parseFloat(quantity),
          unitCost: unitCost ? parseFloat(unitCost) : undefined,
          reference: refWithLot,
          notes: notes || undefined,
        });
      }
      // Auto-limpiar campos después de guardar exitosamente
      setQuantity('');
      setUnitCost(selectedProduct ? String(selectedProduct.avgCost) : '');
      setReference('');
      setNotes('');
      setLotNumber('');
      setExpiryDate('');
      setError('');
      notifySuccess();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al registrar movimiento');
    }
    setSubmitting(false);
  }

  const cfg = TYPE_CONFIG[movType];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl p-8 text-gray-400 text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-lg">⚡ Movimiento Rápido</h2>
            <p className="text-gray-500 text-xs mt-0.5">Registra una transacción de inventario</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo de movimiento */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">TIPO DE MOVIMIENTO</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(TYPE_CONFIG) as MovementType[]).map(t => {
                const c = TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMovType(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                      movType === t ? c.bg + ' ' + c.color : 'border-gray-700 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-base">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
            {(movType === 'ADJUSTMENT_IN' || movType === 'ADJUSTMENT_OUT') && (
              <p className="mt-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
                ⚖️ Los ajustes requieren aprobación de finanzas/gerencia. Se enviará como <strong>solicitud pendiente</strong> y el motivo (campo Notas) es obligatorio.
              </p>
            )}
          </div>

          {/* Producto */}
          {!productId && (
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">PRODUCTO</label>
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setSelectedProductId(''); }}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-600 focus:outline-none"
                />
                {productSearch && !selectedProductId && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg max-h-40 overflow-y-auto z-10">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch(p.name);
                          setUnitCost(String(p.avgCost));
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-gray-500 text-xs">{p.sku || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {productId && selectedProduct && (
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
              <span className="text-white font-medium">{selectedProduct.name}</span>
              {selectedProduct.sku && <span className="text-gray-500 ml-2">#{selectedProduct.sku}</span>}
            </div>
          )}

          {/* Bodegas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {movType === 'TRANSFER' ? 'BODEGA ORIGEN' : 'BODEGA'}
              </label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {(movType === 'OUT' || movType === 'TRANSFER' || movType === 'ADJUSTMENT_OUT') && availableStock >= 0 && warehouseId && (
                <p className="text-xs text-gray-500 mt-1">Disponible: <span className={availableStock > 0 ? 'text-green-400' : 'text-red-400'}>{availableStock}</span> {selectedProduct?.unit}</p>
              )}
            </div>
            {movType === 'TRANSFER' && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">BODEGA DESTINO</label>
                <select
                  value={toWarehouseId}
                  onChange={e => setToWarehouseId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.filter(w => w.id !== warehouseId).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cantidad y costo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">CANTIDAD</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
              />
            </div>
            {(movType === 'IN' || movType === 'ADJUSTMENT_IN') && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block flex items-center justify-between">
                  COSTO UNITARIO
                  <button type="button" onClick={suggestCost} disabled={aiLoading || !selectedProductId} className="text-cyan-500 hover:text-cyan-400 text-xs disabled:opacity-40">
                    {aiLoading ? '⏳' : '🤖 IA'}
                  </button>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Lote y expiración (solo para entradas) */}
          {movType === 'IN' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">NÚMERO DE LOTE</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  placeholder="LOT-001 (opcional)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">FECHA EXPIRACIÓN</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Referencia y notas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">REFERENCIA</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="OC-001, PV-010..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">NOTAS</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Resumen */}
          {quantity && unitCost && (movType === 'IN' || movType === 'ADJUSTMENT_IN') && (
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs flex justify-between">
              <span className="text-gray-400">Total estimado:</span>
              <span className="text-white font-medium">${(parseFloat(quantity || '0') * parseFloat(unitCost || '0')).toFixed(2)}</span>
            </div>
          )}

          {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-600 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                movType === 'IN' || movType === 'ADJUSTMENT_IN'
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : movType === 'TRANSFER'
                  ? 'bg-blue-700 hover:bg-blue-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {submitting ? 'Registrando...' : `${cfg.icon} ${cfg.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
