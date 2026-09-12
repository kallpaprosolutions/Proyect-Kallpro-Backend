import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financialApi } from '../../api/financial';

interface Item { description: string; quantity: string; unitPrice: string; }

export default function NewInvoicePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ type: 'SALES', dueDate: '', notes: '' });
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '', unitPrice: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setItem = (i: number, k: keyof Item, v: string) => {
    const updated = [...items];
    if (k === 'quantity' || k === 'unitPrice') v = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    updated[i] = { ...updated[i], [k]: v };
    setItems(updated);
  };

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await financialApi.createInvoice({
        type: form.type,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
        })),
      });
      navigate('/financial');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear factura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🧾</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Factura</h1>
          <p className="text-sm text-surface-500">Crea una nueva factura de venta o compra</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-6 space-y-4">
          <h2 className="font-semibold text-surface-900 dark:text-white">Información General</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Tipo *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="SALES">Factura de Venta</option>
                <option value="PURCHASE">Factura de Compra</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Fecha de Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Notas</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-surface-900 dark:text-white">Líneas de Factura</h2>
            <button type="button" onClick={() => setItems([...items, { description: '', quantity: '', unitPrice: '' }])}
              className="text-brand-600 dark:text-brand-400 hover:underline text-sm">+ Agregar línea</button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-6">
                  {i === 0 && <label className="block text-xs text-surface-600 dark:text-surface-400 mb-1">Descripción</label>}
                  <input required value={item.description} onChange={(e) => setItem(i, 'description', e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    placeholder="Descripción del servicio o producto" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-surface-600 dark:text-surface-400 mb-1">Cantidad</label>}
                  <input required inputMode="decimal" value={item.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    placeholder="1" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-xs text-surface-600 dark:text-surface-400 mb-1">Precio Unitario</label>}
                  <input required inputMode="decimal" value={item.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    placeholder="0.00" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-400 text-lg">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-surface-100 dark:border-surface-700">
            <div className="text-right">
              <p className="text-surface-500 text-sm">Total</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">${total.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium transition-colors">
            {loading ? 'Creando...' : 'Crear Factura'}
          </button>
          <button type="button" onClick={() => navigate('/financial')}
            className="px-6 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
