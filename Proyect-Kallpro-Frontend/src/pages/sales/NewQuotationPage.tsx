import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { salesApi } from '../../api/sales';
import { inventoryApi } from '../../api/inventory';
import { priceListsApi } from '../../api/priceLists';
import { getErrorMessage } from '../../api/client';
import { useToast } from '../../components/ui/Toast';

interface LineItem {
  productId: string;
  productName: string;
  unit: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  priceSource: 'PRICE_LIST' | 'PRODUCT_BASE';
  priceListName: string | null;
}

export default function NewQuotationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [discountCap, setDiscountCap] = useState(100);
  const [capRole, setCapRole] = useState('');
  // Chequeo blando de stock (Sprint 3): disponibilidad por producto, solo informativo.
  const [stockInfo, setStockInfo] = useState<Record<string, { available: number; sufficient: boolean; shortage: number; found: boolean }>>({});

  useEffect(() => {
    Promise.all([salesApi.getCustomers(), inventoryApi.getProducts(), priceListsApi.discountCap()])
      .then(([c, p, cap]) => { setCustomers(c.data); setProducts(p.data); setDiscountCap(cap.data.cap); setCapRole(cap.data.role); })
      .finally(() => setLoading(false));
  }, []);

  // Al cambiar las líneas, consulta disponibilidad (debounce 400ms). No bloquea: solo advierte.
  useEffect(() => {
    if (items.length === 0) { setStockInfo({}); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await inventoryApi.checkStock(items.map(it => ({ productId: it.productId, quantity: it.quantity })));
        const map: Record<string, any> = {};
        for (const line of data.items) map[line.productId] = line;
        setStockInfo(map);
      } catch { /* el chequeo es informativo: si falla, no interrumpe la cotización */ }
    }, 400);
    return () => clearTimeout(t);
  }, [items]);

  const stockWarnings = items.filter(it => { const s = stockInfo[it.productId]; return s && !s.sufficient; }).length;

  const filteredProducts = productSearch
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  async function addItem(product: any) {
    setProductSearch('');
    setShowProductSearch(false);
    setError('');
    // El precio sale de la lista vigente (no del catálogo): lo resolvemos en el backend.
    try {
      const { data } = await priceListsApi.resolve(product.id, 1);
      setItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        description: '',
        quantity: 1,
        unitPrice: data.unitPrice,
        discount: 0,
        taxRate: 15, // default IVA Ecuador
        priceSource: data.source,
        priceListName: data.priceListName,
      }]);
    } catch (e: any) {
      setError(getErrorMessage(e, `Sin precio disponible para ${product.name}`));
    }
  }

  function updateItem(index: number, field: keyof LineItem, value: any) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  // Al cambiar la cantidad, re-resolvemos el precio (escalones por volumen de la lista).
  async function changeQuantity(index: number, quantity: number) {
    updateItem(index, 'quantity', quantity);
    const it = items[index];
    if (!it) return;
    try {
      const { data } = await priceListsApi.resolve(it.productId, quantity);
      setItems(prev => prev.map((item, i) => i === index
        ? { ...item, quantity, unitPrice: data.unitPrice, priceSource: data.source, priceListName: data.priceListName }
        : item));
    } catch { /* mantenemos el precio actual si falla la resolución */ }
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, item) => {
    const lineSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return s + lineSubtotal;
  }, 0);

  const taxAmount = items.reduce((s, item) => {
    const lineSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return s + lineSubtotal * (item.taxRate / 100);
  }, 0);

  const total = subtotal + taxAmount;
  // Antes esto bloqueaba el envío del formulario (el vendedor no podía ni guardar el
  // borrador). Ahora es solo una advertencia: el backend enruta la cotización a
  // "Pendiente de aprobación" en vez de rechazarla — ver sales.service.ts (evaluateDiscountApproval).
  const discountOverCap = items.some(it => it.discount > discountCap);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { setError('Selecciona un cliente'); return; }
    if (items.length === 0) { setError('Agrega al menos un producto'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await salesApi.createQuotation({
        customerId,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        items: items.map(item => ({
          productId: item.productId,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
        })),
      });
      if (data.status === 'PENDING_APPROVAL') {
        toast.success('Cotización guardada y enviada a aprobación (descuento fuera de tope o venta bajo costo)');
      }
      navigate(`/sales?tab=quotations`);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al crear cotización'));
    }
    setSubmitting(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📋</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Cotización</h1>
          <p className="text-sm text-surface-500">Crea una nueva cotización para un cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente y validez */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">CLIENTE *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none">
              <option value="">Seleccionar cliente...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.ruc ? `(${c.ruc})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">VÁLIDA HASTA</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">NOTAS</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Condiciones, observaciones..."
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />
          </div>
        </div>

        {/* Líneas de productos */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-surface-900 dark:text-white">Productos</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500" title="Tope de descuento de tu rol">
                Tope desc.: {discountCap}% ({capRole})
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductSearch(true); }}
                onFocus={() => setShowProductSearch(true)}
                onBlur={() => setTimeout(() => setShowProductSearch(false), 200)}
                placeholder="+ Agregar producto..."
                className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none w-52"
              />
              {showProductSearch && filteredProducts.length > 0 && (
                <div className="absolute top-full right-0 mt-1 w-72 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg max-h-48 overflow-y-auto z-10 shadow-xl">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button" onMouseDown={() => addItem(p)}
                      className="w-full text-left px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-surface-500 text-xs">${Number(p.salePrice).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-surface-400 text-sm">Busca y agrega productos →</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left px-4 py-2.5">PRODUCTO</th>
                    <th className="text-right px-4 py-2.5 w-24">CANT.</th>
                    <th className="text-right px-4 py-2.5 w-28">P. UNITARIO</th>
                    <th className="text-right px-4 py-2.5 w-20">DESC. %</th>
                    <th className="text-right px-4 py-2.5 w-20">IVA %</th>
                    <th className="text-right px-4 py-2.5 w-28">TOTAL</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {items.map((item, i) => {
                    const lineSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
                    const lineTax = lineSubtotal * (item.taxRate / 100);
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <p className="text-surface-900 dark:text-white font-medium text-xs">{item.productName}</p>
                          <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="Descripción (opcional)"
                            className="mt-0.5 w-full bg-transparent text-surface-500 text-xs placeholder-surface-400 focus:outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" step="0.01" min="0.01" value={item.quantity} onChange={e => changeQuantity(i, parseFloat(e.target.value) || 1)}
                            className="w-20 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-right text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                          {(() => {
                            const s = stockInfo[item.productId];
                            if (!s) return null;
                            if (!s.found) return <p className="text-[10px] text-surface-400 mt-0.5 text-right">sin stock reg.</p>;
                            if (!s.sufficient) return <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 text-right" title="Disponible = físico − reservado">⚠ disp. {s.available}</p>;
                            return <p className="text-[10px] text-green-600 dark:text-green-500 mt-0.5 text-right">✓ {s.available} disp.</p>;
                          })()}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {/* Precio read-only: viene de la lista vigente (mejora DeepSeek #2) */}
                          <div className="font-mono text-sm text-surface-900 dark:text-white">${Number(item.unitPrice).toFixed(2)}</div>
                          <div className="text-[10px] mt-0.5">
                            {item.priceSource === 'PRICE_LIST'
                              ? <span className="px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">Lista: {item.priceListName}</span>
                              : <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-surface-500">Precio base</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" step="0.1" min="0" max="100" value={item.discount} onChange={e => updateItem(i, 'discount', parseFloat(e.target.value) || 0)}
                            className={`w-16 bg-surface-50 dark:bg-surface-900 border rounded px-2 py-1 text-right text-sm text-surface-900 dark:text-white focus:ring-2 focus:outline-none ${item.discount > discountCap ? 'border-red-500 focus:ring-red-500' : 'border-surface-200 dark:border-surface-700 focus:ring-brand-500'}`} />
                          {item.discount > discountCap && <p className="text-[10px] text-red-500 mt-0.5">máx {discountCap}%</p>}
                        </td>
                        <td className="px-2 py-2">
                          <select value={item.taxRate} onChange={e => updateItem(i, 'taxRate', parseFloat(e.target.value))}
                            className="w-16 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-1 py-1 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none">
                            <option value={0}>0%</option>
                            <option value={8}>8%</option>
                            <option value={12}>12%</option>
                            <option value={15}>15%</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400 text-sm">
                          ${(lineSubtotal + lineTax).toFixed(2)}
                        </td>
                        <td className="pr-3 py-2 text-center">
                          <button type="button" onClick={() => removeItem(i)} className="text-surface-400 hover:text-red-500 text-lg">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="px-5 py-4 border-t border-surface-200 dark:border-surface-700 flex justify-end">
              <div className="space-y-1 text-sm w-56">
                <div className="flex justify-between text-surface-500">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-surface-500">
                  <span>IVA:</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-surface-900 dark:text-white font-bold border-t border-surface-200 dark:border-surface-700 pt-1 mt-1">
                  <span>TOTAL:</span>
                  <span className="text-green-600 dark:text-green-400">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {stockWarnings > 0 && (
          <p className="text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            ⚠ {stockWarnings} {stockWarnings === 1 ? 'producto supera' : 'productos superan'} el stock disponible. Puedes cotizar igualmente; la disponibilidad se valida al confirmar el pedido.
          </p>
        )}

        {discountOverCap && (
          <p className="text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            ⏳ Hay descuentos por encima de tu tope de rol ({capRole}: {discountCap}%). La cotización se guardará como
            "Pendiente de aprobación" y un gerente deberá aprobarla antes de convertirla en pedido.
          </p>
        )}

        {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex gap-4">
          <Link to="/sales" className="flex-1 py-3 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm text-center hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</Link>
          <button type="submit" disabled={submitting}
            className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Guardando...' : discountOverCap ? '⏳ Enviar a aprobación' : '📄 Crear Cotización'}
          </button>
        </div>
      </form>
    </div>
  );
}
