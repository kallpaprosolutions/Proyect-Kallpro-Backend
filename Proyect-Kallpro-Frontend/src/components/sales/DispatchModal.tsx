import { useMemo, useState } from 'react';
import { salesApi } from '../../api/sales';

interface Props {
  order: any;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Modal de despacho. Permite despachar TODO lo pendiente o elegir cantidades por
 * producto (despacho parcial). El parcial requiere `sales.allowPartialDispatch` activo
 * en Configuración; si está deshabilitado, el backend responde con un error claro.
 */
export default function DispatchModal({ order, onClose, onDone }: Props) {
  const pending = useMemo(
    () =>
      (order.items || [])
        .map((it: any) => {
          const remaining = Number(it.quantity) - Number(it.shippedQty ?? 0);
          const available = it.availableStock != null ? Number(it.availableStock) : remaining;
          return { ...it, remaining, available, maxDispatch: Math.min(remaining, available) };
        })
        .filter((it: any) => it.remaining > 1e-6),
    [order],
  );
  const [qty, setQty] = useState<Record<string, number>>(
    () => Object.fromEntries(pending.map((it: any) => [it.id, it.maxDispatch])),
  );
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const setItemQty = (id: string, value: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(value, max)) }));

  async function run(kind: 'all' | 'partial') {
    setError('');
    let items: Array<{ salesOrderItemId: string; quantity: number }> | undefined;
    if (kind === 'partial') {
      items = pending
        .map((it: any) => ({ salesOrderItemId: it.id, quantity: Number(qty[it.id] ?? 0) }))
        .filter((x: any) => x.quantity > 0);
      if (!items || items.length === 0) { setError('Indica al menos una cantidad a despachar'); return; }
    }
    setLoading(kind);
    try {
      await salesApi.dispatchOrder(order.id, items);
      onDone();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al despachar');
    }
    setLoading('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h3 className="font-semibold text-surface-900 dark:text-white">Despachar {order.orderNumber}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">✕</button>
        </div>

        <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {pending.length === 0 ? (
            <p className="text-surface-500 text-sm">No queda nada por despachar en este pedido.</p>
          ) : (
            pending.map((it: any) => {
              const stockLimited = it.available < it.remaining - 1e-6;
              return (
                <div key={it.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-surface-900 dark:text-white text-sm font-medium truncate">{it.product?.name ?? it.productId}</p>
                    <p className="text-surface-500 text-xs">
                      Pendiente: {it.remaining.toFixed(2)} de {Number(it.quantity).toFixed(2)} · Stock: {it.available.toFixed(2)}
                    </p>
                    {stockLimited && (
                      <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">⚠ El stock físico limita el despacho a {it.maxDispatch.toFixed(2)}</p>
                    )}
                  </div>
                  <input
                    type="number" min={0} max={it.maxDispatch} step="0.01"
                    value={qty[it.id] ?? 0}
                    onChange={(e) => setItemQty(it.id, Number(e.target.value), it.maxDispatch)}
                    className={`w-24 px-2 py-1.5 text-right text-sm rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-white ${
                      stockLimited ? 'border-amber-400 dark:border-amber-600' : 'border-surface-300 dark:border-surface-600'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {error && <p className="px-5 pb-1 text-red-500 text-sm">{error}</p>}

        <div className="px-5 py-4 border-t border-surface-200 dark:border-surface-700 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300">
            Cancelar
          </button>
          <button onClick={() => run('all')} disabled={!!loading || pending.length === 0}
            className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm rounded-lg disabled:opacity-50">
            {loading === 'all' ? 'Despachando...' : '🚚 Despachar todo'}
          </button>
          <button onClick={() => run('partial')} disabled={!!loading || pending.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg disabled:opacity-50">
            {loading === 'partial' ? 'Despachando...' : 'Despachar seleccionado'}
          </button>
        </div>
      </div>
    </div>
  );
}
