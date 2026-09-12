import { useEffect, useMemo, useState } from 'react';
import BackButton from '../../components/ui/BackButton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useCan } from '../../hooks/useCan';
import { inventoryApi } from '../../api/inventory';
import { financialApi } from '../../api/financial';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputCls =
  'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente de aprobación', cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' },
  APPROVED_APPLIED: { label: 'Aprobado y aplicado', cls: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' },
};

const FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'APPROVED_APPLIED', label: 'Aprobados' },
  { key: 'REJECTED', label: 'Rechazados' },
];

export default function InventoryAdjustmentsPage() {
  const toast = useToast();
  const confirmAction = useConfirm();
  const { can } = useCan();
  const canApprove = can('approve', 'Inventory');

  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Trazabilidad: modal con el detalle del movimiento de stock o el asiento contable
  // generado al aplicar el ajuste (patrón de referencia: links "Movimientos productos" /
  // "Asientos contables" en el documento de inventario de Odoo).
  const [detail, setDetail] = useState<{ kind: 'movement' | 'journal'; loading: boolean; data: any } | null>(null);

  async function openMovement(id: string) {
    setDetail({ kind: 'movement', loading: true, data: null });
    try {
      const { data } = await inventoryApi.getMovement(id);
      setDetail({ kind: 'movement', loading: false, data });
    } catch {
      toast.error('No se pudo cargar el movimiento');
      setDetail(null);
    }
  }

  async function openJournalEntry(id: string) {
    setDetail({ kind: 'journal', loading: true, data: null });
    try {
      const { data } = await financialApi.getJournalEntry(id);
      setDetail({ kind: 'journal', loading: false, data });
    } catch {
      toast.error('No se pudo cargar el asiento contable');
      setDetail(null);
    }
  }

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    productSearch: '',
    warehouseId: '',
    type: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantity: '',
    unitCost: '',
    reason: '',
    notes: '',
  });

  const load = () => {
    setLoading(true);
    inventoryApi
      .getAdjustments(filter || undefined)
      .then((r) => setAdjustments(r.data))
      .catch((e) => toast.error(e?.response?.data?.error || 'Error al cargar ajustes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => {
    Promise.all([inventoryApi.getProducts(), inventoryApi.getWarehouses()]).then(([p, w]) => {
      setProducts(p.data);
      setWarehouses(w.data);
      const def = w.data.find((x: any) => x.isDefault) || w.data[0];
      if (def) setForm((f) => ({ ...f, warehouseId: def.id }));
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === form.productId);
  const filteredProducts = useMemo(() => {
    if (!form.productSearch) return products.slice(0, 8);
    const q = form.productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 8);
  }, [form.productSearch, products]);

  async function submitRequest() {
    if (!form.productId || !form.warehouseId || !form.quantity || Number(form.quantity) <= 0) {
      toast.error('Completa producto, bodega y cantidad');
      return;
    }
    if (form.reason.trim().length < 3) {
      toast.error('Indica el motivo del ajuste');
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.createAdjustment({
        productId: form.productId,
        warehouseId: form.warehouseId,
        type: form.type,
        quantity: Number(form.quantity),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        reason: form.reason.trim(),
        notes: form.notes.trim() || undefined,
      });
      toast.success('Ajuste enviado a aprobación de finanzas/gerencia');
      setShowForm(false);
      setForm((f) => ({ ...f, productId: '', productSearch: '', quantity: '', unitCost: '', reason: '', notes: '' }));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al solicitar el ajuste');
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    if (!await confirmAction({ title: 'Aprobar ajuste', message: '¿Aprobar y aplicar este ajuste al inventario? Esta acción mueve stock y genera el asiento contable.' })) return;
    setBusyId(id);
    try {
      await inventoryApi.approveAdjustment(id);
      toast.success('Ajuste aprobado y aplicado');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al aprobar');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Motivo del rechazo:');
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error('Indica el motivo del rechazo'); return; }
    setBusyId(id);
    try {
      await inventoryApi.rejectAdjustment(id, reason.trim());
      toast.success('Ajuste rechazado');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al rechazar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallback="/inventory" label="Inventario" />
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">⚖️</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Ajustes de Inventario</h1>
            <p className="text-sm text-surface-500">Doble autorización: el bodeguero solicita y finanzas/gerencia aprueba antes de mover stock.</p>
          </div>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
          + Solicitar ajuste
        </button>
      </div>

      {/* Banner informativo del aprobador */}
      {!canApprove && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700 rounded-xl p-3 mb-4 text-sm text-blue-700 dark:text-blue-300">
          ℹ️ Tu solicitud quedará <strong>pendiente</strong> hasta que un responsable de finanzas o gerencia la apruebe. No puedes aprobar tus propios ajustes.
        </div>
      )}

      {/* Formulario de solicitud */}
      {showForm && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-700/40 p-6 shadow-soft mb-6">
          <h2 className="font-semibold text-surface-800 dark:text-white mb-4">Nueva solicitud de ajuste</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Producto */}
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-500 mb-1">Producto *</label>
              {selectedProduct ? (
                <div className="flex items-center justify-between bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2">
                  <span className="text-sm text-surface-800 dark:text-white">{selectedProduct.name} {selectedProduct.sku && <span className="text-surface-500">#{selectedProduct.sku}</span>}</span>
                  <button onClick={() => setForm((f) => ({ ...f, productId: '', productSearch: '' }))} className="text-surface-400 hover:text-red-500 text-sm">cambiar</button>
                </div>
              ) : (
                <div className="relative">
                  <input value={form.productSearch} onChange={(e) => setForm((f) => ({ ...f, productSearch: e.target.value }))}
                    placeholder="Buscar por nombre o SKU..." className={inputCls} />
                  {form.productSearch && filteredProducts.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg max-h-44 overflow-y-auto shadow-lg">
                      {filteredProducts.map((p) => (
                        <button key={p.id} type="button"
                          onClick={() => setForm((f) => ({ ...f, productId: p.id, productSearch: p.name, unitCost: f.unitCost || String(p.avgCost ?? '') }))}
                          className="w-full text-left px-3 py-2 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 flex justify-between">
                          <span>{p.name}</span><span className="text-surface-500 text-xs">{p.sku || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Bodega */}
            <div>
              <label className="block text-xs text-surface-500 mb-1">Bodega *</label>
              <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (default)' : ''}</option>)}
              </select>
            </div>
            {/* Tipo */}
            <div>
              <label className="block text-xs text-surface-500 mb-1">Tipo de ajuste *</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, type: 'ADJUSTMENT_IN' }))}
                  className={`py-2 rounded-lg border text-sm font-medium ${form.type === 'ADJUSTMENT_IN' ? 'bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-600 text-green-700 dark:text-green-400' : 'border-surface-200 dark:border-surface-700 text-surface-500'}`}>
                  ⬆️ Entrada (+)
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, type: 'ADJUSTMENT_OUT' }))}
                  className={`py-2 rounded-lg border text-sm font-medium ${form.type === 'ADJUSTMENT_OUT' ? 'bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-400' : 'border-surface-200 dark:border-surface-700 text-surface-500'}`}>
                  ⬇️ Salida (−)
                </button>
              </div>
            </div>
            {/* Cantidad */}
            <div>
              <label className="block text-xs text-surface-500 mb-1">Cantidad *</label>
              <input type="number" min={0} step={0.01} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className={inputCls} placeholder="0" />
            </div>
            {/* Costo unitario (solo entradas) */}
            {form.type === 'ADJUSTMENT_IN' && (
              <div>
                <label className="block text-xs text-surface-500 mb-1">Costo unitario</label>
                <input type="number" min={0} step={0.0001} value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} className={inputCls} placeholder="0.00" />
              </div>
            )}
            {/* Motivo */}
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-500 mb-1">Motivo del ajuste *</label>
              <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={inputCls} placeholder="Ej. Merma por rotura / Diferencia de conteo / Producto vencido" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-500 mb-1">Notas (opcional)</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Detalle adicional..." />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={submitRequest} disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Enviando...' : 'Enviar solicitud'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-surface-200 dark:border-surface-700 px-4 py-2 rounded-lg text-sm text-surface-600 dark:text-surface-400">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f.key
              ? 'bg-brand-500 text-white border-brand-500'
              : 'bg-surface-50 dark:bg-surface-900/50 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:border-brand-400'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
        {loading ? (
          <div className="py-16 text-center text-surface-400">Cargando ajustes...</div>
        ) : adjustments.length === 0 ? (
          <div className="py-16 text-center text-surface-400">No hay ajustes registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Bodega</th>
                <th className="text-center px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-left px-4 py-3">Motivo</th>
                <th className="text-left px-4 py-3">Solicitante</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {adjustments.map((a) => {
                const meta = STATUS_META[a.status] ?? { label: a.status, cls: 'bg-surface-100 text-surface-500' };
                const isIn = a.type === 'ADJUSTMENT_IN';
                return (
                  <tr key={a.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors align-top">
                    <td className="px-4 py-3 font-mono text-brand-600 dark:text-brand-400">{a.adjNumber}</td>
                    <td className="px-4 py-3 text-surface-800 dark:text-white">{a.product?.name}{a.product?.sku && <span className="text-surface-500 text-xs"> #{a.product.sku}</span>}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{a.warehouse?.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isIn ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'}`}>
                        {isIn ? '⬆️ Entrada' : '⬇️ Salida'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">{Number(a.quantity).toLocaleString('es')} {a.product?.unit}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 max-w-[200px]">
                      {a.reason}
                      {a.status === 'REJECTED' && a.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">Rechazo: {a.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">
                      {a.requestedByName || '—'}
                      <p className="text-xs text-surface-400">{new Date(a.requestedAt).toLocaleDateString('es')}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      {a.status === 'APPROVED_APPLIED' && a.approvedByName && (
                        <p className="text-xs text-surface-400 mt-1">por {a.approvedByName}</p>
                      )}
                      {a.status === 'APPROVED_APPLIED' && (a.movementId || a.journalEntryId) && (
                        <p className="text-xs mt-1 space-x-2">
                          {a.movementId && (
                            <button onClick={() => openMovement(a.movementId)} className="text-brand-500 hover:underline">Ver movimiento</button>
                          )}
                          {a.journalEntryId && (
                            <button onClick={() => openJournalEntry(a.journalEntryId)} className="text-brand-500 hover:underline">Ver asiento</button>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {a.status === 'PENDING' && canApprove ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => approve(a.id)} disabled={busyId === a.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium">✓ Aprobar</button>
                          <button onClick={() => reject(a.id)} disabled={busyId === a.id}
                            className="border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-1 rounded-lg text-xs">✗ Rechazar</button>
                        </div>
                      ) : a.status === 'PENDING' ? (
                        <span className="text-xs text-surface-400 italic">Esperando finanzas/gerencia</span>
                      ) : (
                        <span className="text-xs text-surface-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de trazabilidad: movimiento de stock o asiento contable generado */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900 dark:text-white">
                {detail.kind === 'movement' ? '📦 Movimiento de inventario' : '📓 Asiento contable'}
              </h2>
              <button onClick={() => setDetail(null)} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
            </div>
            <div className="p-5">
              {detail.loading ? (
                <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
              ) : detail.kind === 'movement' ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-surface-500">Producto</span><span className="text-surface-900 dark:text-white">{detail.data.product?.name}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Bodega</span><span className="text-surface-900 dark:text-white">{detail.data.warehouse?.name}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Tipo</span><span className="text-surface-900 dark:text-white">{detail.data.type}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Cantidad</span><span className="font-mono text-surface-900 dark:text-white">{Number(detail.data.quantity).toLocaleString('es')}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Costo unitario</span><span className="font-mono text-surface-900 dark:text-white">{money(Number(detail.data.unitCost))}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Costo total</span><span className="font-mono text-surface-900 dark:text-white">{money(Number(detail.data.totalCost))}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Saldo después</span><span className="font-mono font-semibold text-surface-900 dark:text-white">{Number(detail.data.stockAfter).toLocaleString('es')}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Fecha</span><span className="text-surface-900 dark:text-white">{new Date(detail.data.createdAt).toLocaleString('es')}</span></div>
                  {detail.data.notes && <div className="pt-2 border-t border-surface-100 dark:border-surface-700 text-surface-600 dark:text-surface-300">{detail.data.notes}</div>}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-mono text-brand-600 dark:text-brand-400">{detail.data.entryNumber}</span>
                    <span className="text-surface-500">{new Date(detail.data.entryDate).toLocaleDateString('es')}</span>
                  </div>
                  <p className="text-surface-700 dark:text-surface-300">{detail.data.description}</p>
                  <table className="w-full text-xs">
                    <thead><tr className="text-surface-500"><th className="text-left py-1">Cuenta</th><th className="text-right py-1">Debe</th><th className="text-right py-1">Haber</th></tr></thead>
                    <tbody>
                      {detail.data.lines?.map((l: any) => (
                        <tr key={l.id} className="border-t border-surface-100 dark:border-surface-700">
                          <td className="py-1.5 text-surface-700 dark:text-surface-300"><span className="font-mono text-surface-500 mr-2">{l.accountCode}</span>{l.accountName}</td>
                          <td className="py-1.5 text-right font-mono">{Number(l.debit) > 0 ? money(Number(l.debit)) : ''}</td>
                          <td className="py-1.5 text-right font-mono">{Number(l.credit) > 0 ? money(Number(l.credit)) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
