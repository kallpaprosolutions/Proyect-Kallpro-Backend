import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { salesApi } from '../../api/sales';
import { inventoryApi } from '../../api/inventory';
import { useToast } from '../../components/ui/Toast';

/**
 * Venta Rápida — POS de UNA sola pantalla.
 * Izquierda: busca/escanea productos y agrégalos con un clic.
 * Derecha: carrito editable + cliente + un solo botón "Confirmar venta"
 * que encadena crear → confirmar (reserva stock) → despachar (factura).
 */

const IVA_RATE = 15;
const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CartLine { productId: string; name: string; sku: string | null; quantity: number; unitPrice: number; stock: number; warehouseId: string | null; }

/** Bodega con mayor stock disponible (cantidad − reservado) para despachar el ítem */
function bestWarehouse(p: any): { id: string | null; available: number } {
  const stocks: any[] = p.stocks ?? [];
  let best: { id: string | null; available: number } = { id: null, available: 0 };
  for (const s of stocks) {
    const available = Number(s.quantity) - Number(s.reserved ?? 0);
    if (available > best.available) best = { id: s.warehouseId, available };
  }
  return best;
}

export default function QuickSalePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState<{ name: string; ruc: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<{ step: string; message: string; orderId?: string } | null>(null);

  useEffect(() => {
    inventoryApi.getProducts().then((r) => setProducts(Array.isArray(r.data) ? r.data : r.data?.data ?? [])).catch(() => {});
    salesApi.getCustomers().then((r) => setCustomers(r.data)).catch(() => {});
    searchRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 12);
    return products.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '') === q
    ).slice(0, 12);
  }, [products, search]);

  const totalStock = (p: any) => Number(p.totalStock ?? p.stock ?? p.stocks?.reduce((s: number, x: any) => s + Number(x.quantity), 0) ?? 0);

  const addToCart = (p: any) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.productId === p.id);
      if (ex) return prev.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      const wh = bestWarehouse(p); // se despacha desde la bodega con más disponible
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, quantity: 1, unitPrice: Number(p.salePrice ?? 0), stock: wh.available, warehouseId: wh.id }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const setLine = (productId: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => l.productId === productId ? { ...l, ...patch } : l));
  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const iva = subtotal * (IVA_RATE / 100);
  const total = subtotal + iva;

  const canSubmit = cart.length > 0 && cart.every((l) => l.quantity > 0) && (customerId || (newCustomer?.name?.trim()));

  async function confirmSale() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setStepError(null);
    let step = 'cliente';
    let orderId: string | undefined;
    try {
      // 0) cliente nuevo inline si aplica
      let cid = customerId;
      if (!cid && newCustomer) {
        const c = await salesApi.createCustomer({ name: newCustomer.name.trim(), ruc: newCustomer.ruc.trim() || undefined });
        cid = c.data.id;
      }
      // 1) crear pedido
      step = 'crear el pedido';
      const order = await salesApi.createOrder({
        customerId: cid,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: IVA_RATE, ...(l.warehouseId ? { warehouseId: l.warehouseId } : {}) })),
        notes: 'Venta rápida (POS)',
      });
      orderId = order.data.id;
      // 2) confirmar (reserva stock)
      step = 'confirmar (reserva de stock)';
      await salesApi.confirmOrder(orderId!);
      // 3) despachar (consume stock + factura)
      step = 'despachar y facturar';
      await salesApi.dispatchOrder(orderId!);
      toast.success(`Venta ${order.data.orderNumber ?? ''} completada y facturada 🎉`);
      navigate(`/sales/orders/${orderId}`);
    } catch (e: any) {
      const message = e?.response?.data?.error || e?.response?.data?.message || 'Error inesperado';
      setStepError({ step, message, orderId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">⚡</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Venta Rápida</h1>
            <p className="text-sm text-surface-500">Busca, agrega y confirma — todo en una pantalla</p>
          </div>
        </div>
        <Link to="/sales/quotations/new" className="text-sm text-surface-500 hover:text-brand-500 underline-offset-2 hover:underline">
          ¿Necesitas cotizar primero? → Nueva cotización
        </Link>
      </div>

      {stepError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm">
          <p className="text-red-700 dark:text-red-400">
            ⚠️ Falló al <strong>{stepError.step}</strong>: {stepError.message}
          </p>
          {stepError.orderId && (
            <p className="text-surface-600 dark:text-surface-300 mt-1">
              El pedido quedó creado en borrador/confirmado — puedes continuar desde{' '}
              <Link to={`/sales/orders/${stepError.orderId}`} className="text-brand-500 underline">su detalle</Link>.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Izquierda: búsqueda + grid de productos */}
        <div className="lg:col-span-3 space-y-3">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Busca por nombre, SKU o escanea el código de barras…"
            className="w-full bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-brand-500 rounded-xl px-4 py-3 text-base text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none shadow-soft"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.map((p) => {
              const stock = totalStock(p);
              return (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="text-left bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-soft hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-card transition-all group">
                  <p className="font-medium text-surface-900 dark:text-white text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">{p.name}</p>
                  <p className="text-xs text-surface-400 font-mono">{p.sku || '—'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono font-bold text-surface-900 dark:text-white">{money(Number(p.salePrice ?? 0))}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${stock > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                      {stock > 0 ? `${stock} disp.` : 'Sin stock'}
                    </span>
                  </div>
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="col-span-full text-center text-surface-400 text-sm py-8">Sin productos que coincidan con «{search}».</p>
            )}
          </div>
        </div>

        {/* Derecha: carrito + cliente + confirmar */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-soft overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900 dark:text-white">🛒 Carrito</h2>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-surface-400 hover:text-red-500">Vaciar</button>}
            </div>

            {/* Cliente */}
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 space-y-2">
              {!newCustomer ? (
                <div className="flex gap-2">
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                    className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
                    <option value="">Selecciona cliente…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.razonSocial || c.name}</option>)}
                  </select>
                  <button onClick={() => { setNewCustomer({ name: '', ruc: '' }); setCustomerId(''); }}
                    className="text-xs px-3 py-2 border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 whitespace-nowrap">
                    + Nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Nombre del cliente *" autoFocus
                      className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
                    <input value={newCustomer.ruc} onChange={(e) => setNewCustomer({ ...newCustomer, ruc: e.target.value })}
                      placeholder="RUC / Cédula"
                      className="w-32 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
                  </div>
                  <button onClick={() => setNewCustomer(null)} className="text-xs text-surface-400 hover:underline">← Elegir cliente existente</button>
                </div>
              )}
            </div>

            {/* Líneas */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-700">
              {cart.length === 0 && (
                <p className="text-center text-surface-400 text-sm py-10">Agrega productos con un clic en el panel izquierdo.</p>
              )}
              {cart.map((l) => (
                <div key={l.productId} className="px-4 py-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-900 dark:text-white truncate">{l.name}</p>
                    {l.quantity > l.stock && <p className="text-xs text-red-500">⚠ Stock disponible: {l.stock}</p>}
                  </div>
                  <input type="number" min={1} value={l.quantity}
                    onChange={(e) => setLine(l.productId, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-16 text-center bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-1 py-1.5 text-sm text-surface-900 dark:text-white" />
                  <input type="number" min={0} step={0.01} value={l.unitPrice}
                    onChange={(e) => setLine(l.productId, { unitPrice: Math.max(0, Number(e.target.value)) })}
                    className="w-20 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm font-mono text-surface-900 dark:text-white" />
                  <span className="w-20 text-right font-mono text-sm text-surface-900 dark:text-white">{money(l.quantity * l.unitPrice)}</span>
                  <button onClick={() => removeLine(l.productId)} className="text-surface-300 hover:text-red-500 px-1">✕</button>
                </div>
              ))}
            </div>

            {/* Totales + CTA */}
            <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 space-y-1.5 bg-surface-50/60 dark:bg-surface-900/40">
              <div className="flex justify-between text-sm text-surface-500"><span>Subtotal</span><span className="font-mono">{money(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-surface-500"><span>IVA {IVA_RATE}%</span><span className="font-mono">{money(iva)}</span></div>
              <div className="flex justify-between text-lg font-bold text-surface-900 dark:text-white"><span>Total</span><span className="font-mono">{money(total)}</span></div>
              <button onClick={confirmSale} disabled={!canSubmit || submitting}
                className="w-full mt-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-base transition-colors shadow-soft">
                {submitting ? 'Procesando…' : `Confirmar venta · ${money(total)}`}
              </button>
              <p className="text-[11px] text-surface-400 text-center">Crea el pedido, reserva stock, despacha y factura en un solo paso.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
