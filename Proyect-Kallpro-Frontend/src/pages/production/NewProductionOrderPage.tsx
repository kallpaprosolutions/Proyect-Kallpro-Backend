import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import { inventoryApi } from '../../api/inventory';

export default function NewProductionOrderPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [mrp, setMrp] = useState<any[]>([]);
  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    bomId: '',
    quantity: '',
    plannedStart: '',
    plannedEnd: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      inventoryApi.getProducts(),
      inventoryApi.getWarehouses(),
      productionApi.listBOMs(),
    ]).then(([p, w, b]) => {
      setProducts(p.data.filter((x: any) => x.isActive));
      setWarehouses(w.data.filter((x: any) => x.isActive));
      setBoms(b.data.filter((x: any) => x.isActive));
    });
  }, []);

  // Filtrar BOMs del producto seleccionado
  const productBoms = boms.filter((b) => b.productId === form.productId);

  // Calcular MRP cuando hay producto + bodega + cantidad
  useEffect(() => {
    if (form.productId && form.warehouseId && form.quantity && Number(form.quantity) > 0) {
      productionApi.getMRPRequirements(form.productId, Number(form.quantity), form.warehouseId)
        .then((r) => setMrp(r.data))
        .catch(() => setMrp([]));
    } else {
      setMrp([]);
    }
  }, [form.productId, form.warehouseId, form.quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await productionApi.createOrder({
        productId: form.productId,
        warehouseId: form.warehouseId,
        bomId: form.bomId || undefined,
        quantity: parseFloat(form.quantity),
        plannedStart: form.plannedStart || undefined,
        plannedEnd: form.plannedEnd || undefined,
        notes: form.notes || undefined,
      });
      navigate(`/production/orders/${result.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear orden');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🔧</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Orden de Producción</h1>
          <p className="text-sm text-surface-500">Crea una nueva orden de producción</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-6 space-y-5">
        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Producto a producir *</label>
            <select required value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value, bomId: '' })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Selecciona un producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Bodega destino *</label>
            <select required value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Selecciona bodega</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Cantidad *</label>
            <input required type="number" min="0.01" step="0.01"
              value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Lista de Materiales (BOM)</label>
            <select value={form.bomId}
              onChange={(e) => setForm({ ...form, bomId: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Sin BOM</option>
              {productBoms.map((b) => <option key={b.id} value={b.id}>v{b.version} — {b.items?.length} componentes</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Inicio Planeado</label>
            <input type="date" value={form.plannedStart}
              onChange={(e) => setForm({ ...form, plannedStart: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Fin Planeado</label>
            <input type="date" value={form.plannedEnd}
              onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Notas</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>

        {/* MRP Preview */}
        {mrp.length > 0 && (
          <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div className="px-4 py-2 bg-surface-50 dark:bg-surface-900/50 text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Requerimientos MRP
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700 text-surface-500">
                  <th className="text-left px-3 py-2">Componente</th>
                  <th className="text-right px-3 py-2">Requerido</th>
                  <th className="text-right px-3 py-2">Disponible</th>
                  <th className="text-right px-3 py-2">Faltante</th>
                </tr>
              </thead>
              <tbody>
                {mrp.map((r: any) => (
                  <tr key={r.componentId} className={`border-b border-surface-100 dark:border-surface-700 ${!r.ok ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="px-3 py-1.5 text-surface-700 dark:text-surface-300">{r.componentName}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.required.toFixed(2)} {r.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.available.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.shortage > 0 ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'}`}>
                      {r.shortage > 0 ? `-${r.shortage.toFixed(2)}` : '✓'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium transition-colors">
          {loading ? 'Creando...' : '+ Crear Orden'}
        </button>
      </form>
    </div>
  );
}
