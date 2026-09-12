import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesApi } from '../../api/purchases';
import { inventoryApi } from '../../api/inventory';

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const inputSmCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

interface Item { productId: string; quantity: string; unitPrice: string; quantityUnit: 'STOCK' | 'PURCHASE'; }

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierId: '', deliveryDate: '', notes: '', advancePercent: '0', deliveryLocationId: '' });
  const [items, setItems] = useState<Item[]>([{ productId: '', quantity: '', unitPrice: '', quantityUnit: 'STOCK' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([purchasesApi.getSuppliers(), inventoryApi.getProducts(), inventoryApi.getLocations()]).then(([s, p, l]) => {
      setSuppliers(s.data);
      setProducts(p.data);
      setLocations(l.data);
      if (s.data.length > 0) setForm((f) => ({ ...f, supplierId: s.data[0].id }));
    });
  }, []);

  const setItem = (i: number, k: keyof Item, v: string) => {
    const updated = [...items];
    if (k === 'quantity' || k === 'unitPrice') v = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    updated[i] = { ...updated[i], [k]: v as any };
    // Auto-fill unit price from product avg cost, y vuelve a "unidad de stock" (el avgCost
    // siempre está en unidad de stock, no tendría sentido dejarlo marcado en compra al cambiar de producto).
    if (k === 'productId') {
      const prod = products.find((p) => p.id === v);
      if (prod) updated[i].unitPrice = Number(prod.avgCost).toFixed(2);
      updated[i].quantityUnit = 'STOCK';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, { productId: '', quantity: '', unitPrice: '', quantityUnit: 'STOCK' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const productOf = (id: string) => products.find((p) => p.id === id);
  const hasPurchaseUnit = (p: any) => p?.purchaseUnit && Number(p.purchaseConversionFactor) !== 1 && p.purchaseUnit !== p.unit;

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
  const advancePct = Math.max(0, Math.min(100, parseFloat(form.advancePercent) || 0));
  const advanceAmount = (total * advancePct) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await purchasesApi.createOrder({
        supplierId: form.supplierId,
        deliveryDate: form.deliveryDate || undefined,
        notes: form.notes || undefined,
        advancePercent: advancePct,
        deliveryLocationId: form.deliveryLocationId || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          quantityUnit: it.quantityUnit,
        })),
      });
      navigate('/purchases');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear orden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🛒</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Orden de Compra</h1>
          <p className="text-sm text-surface-500">Completa los datos para generar la orden</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Cabecera */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4 shadow-soft">
          <h2 className="font-semibold text-surface-800 dark:text-white">Información General</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Proveedor *</label>
              <select required value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Fecha de Entrega</label>
              <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Ubicación de entrega</label>
              <select value={form.deliveryLocationId} onChange={(e) => setForm({ ...form, deliveryLocationId: e.target.value })} className={inputCls}>
                <option value="">Sin ubicación asignada</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse?.name} · {l.code}{l.zone ? ` (Zona ${l.zone}${l.rack ? `, Percha ${l.rack}` : ''}${l.level ? `, Piso ${l.level}` : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Anticipo (%)</label>
              <input type="number" min={0} max={100} step={5} value={form.advancePercent}
                onChange={(e) => setForm({ ...form, advancePercent: e.target.value })} className={inputCls} placeholder="0" />
              {advancePct > 0 && (
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  Anticipo: ${advanceAmount.toLocaleString('es', { minimumFractionDigits: 2 })} · Saldo contra entrega: ${(total - advanceAmount).toLocaleString('es', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Notas</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Observaciones..." />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4 shadow-soft">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-surface-800 dark:text-white">Productos</h2>
            <button type="button" onClick={addItem} className="text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 text-sm font-medium">+ Agregar línea</button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => {
              const prod = productOf(item.productId);
              const showUnitToggle = hasPurchaseUnit(prod);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      {i === 0 && <label className="block text-xs text-surface-500 mb-1">Producto</label>}
                      <select required value={item.productId} onChange={(e) => setItem(i, 'productId', e.target.value)} className={inputSmCls}>
                        <option value="">Seleccionar...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className="block text-xs text-surface-500 mb-1">Cantidad {showUnitToggle ? `(${item.quantityUnit === 'PURCHASE' ? prod.purchaseUnit : prod.unit})` : ''}</label>}
                      <input required inputMode="decimal" value={item.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} className={inputSmCls} placeholder="0" />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className="block text-xs text-surface-500 mb-1">Precio Unit. {showUnitToggle ? `(por ${item.quantityUnit === 'PURCHASE' ? prod.purchaseUnit : prod.unit})` : ''}</label>}
                      <input required inputMode="decimal" value={item.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)} className={inputSmCls} placeholder="0.00" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none">×</button>
                      )}
                    </div>
                  </div>
                  {showUnitToggle && (
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-xs text-surface-500">Cargar cantidad/precio en:</span>
                      <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden text-xs">
                        <button type="button"
                          onClick={() => setItem(i, 'quantityUnit', 'PURCHASE')}
                          className={`px-2.5 py-1 font-medium ${item.quantityUnit === 'PURCHASE' ? 'bg-brand-500 text-white' : 'bg-surface-50 dark:bg-surface-900 text-surface-600 dark:text-surface-400'}`}>
                          {prod.purchaseUnit} (compra)
                        </button>
                        <button type="button"
                          onClick={() => setItem(i, 'quantityUnit', 'STOCK')}
                          className={`px-2.5 py-1 font-medium ${item.quantityUnit === 'STOCK' ? 'bg-brand-500 text-white' : 'bg-surface-50 dark:bg-surface-900 text-surface-600 dark:text-surface-400'}`}>
                          {prod.unit} (stock)
                        </button>
                      </div>
                      {item.quantityUnit === 'PURCHASE' && (
                        <span className="text-xs text-surface-400">1 {prod.purchaseUnit} = {Number(prod.purchaseConversionFactor)} {prod.unit}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2 border-t border-surface-100 dark:border-surface-700">
            <div className="text-right">
              <p className="text-surface-500 text-sm">Total</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">${total.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            {loading ? 'Creando...' : 'Crear Orden de Compra'}
          </button>
          <button type="button" onClick={() => navigate('/purchases')} className="px-6 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
