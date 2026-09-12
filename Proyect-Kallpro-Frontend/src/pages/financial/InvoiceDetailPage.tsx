import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { financialApi } from '../../api/financial';
import { reportsApi } from '../../api/reports';
import SmartButtons from '../../components/SmartButtons';
import Chatter from '../../components/Chatter';
import Activities from '../../components/Activities';
import SriEmissionPanel from '../../components/financial/SriEmissionPanel';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-surface-100 dark:bg-surface-500/20 text-surface-500 dark:text-surface-400',
  SENT: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PAID: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  OVERDUE: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  CANCELLED: 'bg-surface-100 dark:bg-surface-600/20 text-surface-400 dark:text-surface-500',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Notas de crédito (Sprint 4) ──
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [ncOpen, setNcOpen] = useState(false);
  const [expandedNcId, setExpandedNcId] = useState<string | null>(null);
  const [creditable, setCreditable] = useState<any[]>([]);
  const [ncQty, setNcQty] = useState<Record<string, number>>({});
  const [ncReason, setNcReason] = useState('');
  const [ncRestock, setNcRestock] = useState(true);
  const [ncBusy, setNcBusy] = useState(false);

  // ── Notas de débito (Etapa 4 del plan SRI, resto) ──
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [ndOpen, setNdOpen] = useState(false);
  const [expandedNdId, setExpandedNdId] = useState<string | null>(null);
  const [ndReason, setNdReason] = useState('');
  const [ndTaxRate, setNdTaxRate] = useState(15);
  const [ndConcepts, setNdConcepts] = useState<Array<{ description: string; amount: string }>>([{ description: '', amount: '' }]);
  const [ndBusy, setNdBusy] = useState(false);

  const load = () => financialApi.getInvoice(id!).then((r) => setInvoice(r.data));
  const loadCreditNotes = () => financialApi.getCreditNotes(id!).then((r) => setCreditNotes(r.data)).catch(() => {});
  const loadDebitNotes = () => financialApi.getDebitNotes(id!).then((r) => setDebitNotes(r.data)).catch(() => {});
  useEffect(() => { load(); loadCreditNotes(); loadDebitNotes(); }, [id]);

  async function openNC() {
    setError('');
    try {
      const { data } = await financialApi.getCreditableLines(id!);
      setCreditable(data.lines || []);
      setNcQty({});
      setNcReason('');
      setNcRestock(true);
      setNcOpen(true);
    } catch (e: any) { setError(e.response?.data?.error || 'No se pudieron cargar las líneas a acreditar'); }
  }

  const ncTotal = creditable.reduce((s, l) => {
    const q = Number(ncQty[l.salesOrderItemId] || 0);
    const sub = q * l.unitPrice * (1 - l.discount / 100);
    return s + sub * (1 + l.taxRate / 100);
  }, 0);

  async function submitNC() {
    const lines = creditable
      .map((l) => ({ salesOrderItemId: l.salesOrderItemId, quantity: Number(ncQty[l.salesOrderItemId] || 0) }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) { setError('Indica al menos una cantidad a acreditar'); return; }
    if (!ncReason.trim()) { setError('Indica el motivo de la nota de crédito'); return; }
    setNcBusy(true);
    setError('');
    try {
      await financialApi.createCreditNote(id!, { reason: ncReason.trim(), restock: ncRestock, lines });
      setNcOpen(false);
      load();
      loadCreditNotes();
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Error al emitir la nota de crédito');
    } finally { setNcBusy(false); }
  }

  function openND() {
    setError('');
    setNdReason('');
    setNdTaxRate(15);
    setNdConcepts([{ description: '', amount: '' }]);
    setNdOpen(true);
  }

  const ndSubtotal = ndConcepts.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const ndTotal = ndSubtotal * (1 + ndTaxRate / 100);

  async function submitND() {
    const concepts = ndConcepts
      .map((c) => ({ description: c.description.trim(), amount: parseFloat(c.amount) || 0 }))
      .filter((c) => c.description && c.amount > 0);
    if (concepts.length === 0) { setError('Indica al menos un concepto con descripción y valor'); return; }
    if (!ndReason.trim()) { setError('Indica el motivo de la nota de débito'); return; }
    setNdBusy(true);
    setError('');
    try {
      await financialApi.createDebitNote(id!, { reason: ndReason.trim(), taxRate: ndTaxRate, concepts });
      setNdOpen(false);
      loadDebitNotes();
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Error al emitir la nota de débito');
    } finally { setNdBusy(false); }
  }

  const handleStatus = async (status: string) => {
    setLoading(true);
    setError('');
    try {
      await financialApi.updateStatus(id!, status);
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setError('Ingresa un monto válido'); return; }
    setLoading(true);
    setError('');
    try {
      const newPaid = Number(invoice.paidAmount) + amount;
      const status = newPaid >= Number(invoice.totalAmount) ? 'PAID' : 'SENT';
      await financialApi.updateStatus(id!, status, newPaid);
      setPayAmount('');
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  if (!invoice) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  const saldo = Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🧾</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{invoice.number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>{STATUS_LABELS[invoice.status]}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${invoice.type === 'SALES' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                {invoice.type === 'SALES' ? 'Venta' : 'Compra'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.type === 'SALES' && (
            <button
              onClick={() => reportsApi.salesInvoicePdf(id!, invoice.number).catch(() => setError('No se pudo generar el PDF de la factura'))}
              className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              📄 PDF
            </button>
          )}
          {invoice.status === 'DRAFT' && (
            <button onClick={() => handleStatus('SENT')} disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">Enviar</button>
          )}
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && !invoice.salesOrderId && (
            <button onClick={() => handleStatus('CANCELLED')} disabled={loading}
              className="border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
          )}
          {invoice.type === 'SALES' && invoice.salesOrderId && invoice.status !== 'CANCELLED' && (
            <button
              onClick={openNC}
              disabled={loading}
              title="Emite una nota de crédito para devolver/anular total o parcialmente esta factura"
              className="border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ↩ Nota de Crédito
            </button>
          )}
          {invoice.type === 'SALES' && invoice.status !== 'CANCELLED' && (
            <button
              onClick={openND}
              disabled={loading}
              title="Emite una nota de débito para cargar un valor adicional sobre esta factura (interés, gasto no facturado)"
              className="border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ➕ Nota de Débito
            </button>
          )}
        </div>
      </div>

      {/* Smart buttons (A4): asientos, pagos, retenciones y NC vinculados */}
      <SmartButtons entityType="INVOICE" entityId={id!} refreshKey={`${invoice.status}-${invoice.paidAmount}-${creditNotes.length}-${debitNotes.length}`} />

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {invoice.type === 'SALES' && <SriEmissionPanel docId={id!} kind="invoice" onChanged={load} />}

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Total</p>
            <p className="text-2xl font-bold mt-1 text-surface-900 dark:text-white">${Number(invoice.totalAmount).toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Pagado</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">${Number(invoice.paidAmount).toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Saldo Pendiente</p>
            <p className={`text-2xl font-bold mt-1 ${saldo > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>${saldo.toFixed(2)}</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white">Detalle</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Descripción</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-right px-4 py-3">P. Unit.</th>
                <th className="text-right px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {invoice.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-surface-900 dark:text-white">{item.description}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">${Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-surface-900 dark:text-white">${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-surface-50 dark:bg-surface-900/50">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-surface-700 dark:text-surface-300">Total</td>
                <td className="px-4 py-3 text-right font-bold text-lg text-surface-900 dark:text-white">${Number(invoice.totalAmount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Registrar pago */}
        {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && saldo > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-700 shadow-soft p-6 space-y-4">
            <h2 className="font-semibold text-brand-600 dark:text-brand-400">Registrar Pago</h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Monto a pagar (saldo: ${saldo.toFixed(2)})</label>
                <input
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={saldo.toFixed(2)}
                />
              </div>
              <button onClick={handlePay} disabled={loading}
                className="bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                {loading ? 'Procesando...' : '✓ Confirmar Pago'}
              </button>
            </div>
          </div>
        )}

        {invoice.status === 'PAID' && (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-700 rounded-xl p-4 text-green-600 dark:text-green-400 text-sm">
            ✓ Factura pagada completamente.
          </div>
        )}

        {/* Notas de crédito emitidas */}
        {creditNotes.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
              <h2 className="font-semibold text-surface-900 dark:text-white">Notas de crédito</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Documento sustento: Factura de Venta {invoice.number}
                {invoice.issueDate && ` · emitida el ${new Date(invoice.issueDate).toLocaleDateString('es')}`}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-2.5">Número</th>
                  <th className="text-left px-4 py-2.5">Motivo</th>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                  <th className="text-right px-4 py-2.5">SRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {creditNotes.map((cn) => (
                  <Fragment key={cn.id}>
                    <tr>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => reportsApi.creditNotePdf(cn.id, cn.number).catch(() => setError('No se pudo generar el PDF de la nota de crédito'))}
                          className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
                          title="Descargar PDF"
                        >
                          {cn.number} 📄
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{cn.reason}{cn.restock === false && <span className="ml-1 text-[10px] text-amber-600">(merma)</span>}</td>
                      <td className="px-4 py-2.5 text-surface-500">{new Date(cn.createdAt).toLocaleDateString('es')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">-${Number(cn.total).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setExpandedNcId((v) => (v === cn.id ? null : cn.id))} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                          {expandedNcId === cn.id ? 'Ocultar ▲' : 'SRI ▾'}
                        </button>
                      </td>
                    </tr>
                    {expandedNcId === cn.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 bg-surface-50 dark:bg-surface-900/30">
                          <SriEmissionPanel docId={cn.id} kind="creditNote" onChanged={loadCreditNotes} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notas de débito emitidas */}
        {debitNotes.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
              <h2 className="font-semibold text-surface-900 dark:text-white">Notas de débito</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Documento sustento: Factura de Venta {invoice.number}
                {invoice.issueDate && ` · emitida el ${new Date(invoice.issueDate).toLocaleDateString('es')}`}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-2.5">Número</th>
                  <th className="text-left px-4 py-2.5">Motivo</th>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                  <th className="text-right px-4 py-2.5">SRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {debitNotes.map((dn) => (
                  <Fragment key={dn.id}>
                    <tr>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => reportsApi.debitNotePdf(dn.id, dn.number).catch(() => setError('No se pudo generar el PDF de la nota de débito'))}
                          className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
                          title="Descargar PDF"
                        >
                          {dn.number} 📄
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{dn.reason}</td>
                      <td className="px-4 py-2.5 text-surface-500">{new Date(dn.createdAt).toLocaleDateString('es')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">+${Number(dn.total).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setExpandedNdId((v) => (v === dn.id ? null : dn.id))} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                          {expandedNdId === dn.id ? 'Ocultar ▲' : 'SRI ▾'}
                        </button>
                      </td>
                    </tr>
                    {expandedNdId === dn.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 bg-surface-50 dark:bg-surface-900/30">
                          <SriEmissionPanel docId={dn.id} kind="debitNote" onChanged={loadDebitNotes} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chatter (A2): hilo de mensajes del documento */}
        <Activities entityType="INVOICE" entityId={id!} />
        <Chatter entityType="INVOICE" entityId={id!} statusLabels={STATUS_LABELS} />
      </div>

      {/* Modal de Nota de Crédito */}
      {ncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !ncBusy && setNcOpen(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900 dark:text-white">↩ Nota de Crédito · {invoice.number}</h2>
              <button onClick={() => setNcOpen(false)} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
            </div>

            <div className="p-5 space-y-4">
              {creditable.length === 0 ? (
                <p className="text-sm text-surface-500 py-6 text-center">No hay cantidades pendientes de acreditar en esta factura.</p>
              ) : (
                <>
                  <div className="overflow-x-auto border border-surface-200 dark:border-surface-700 rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                          <th className="text-left px-3 py-2.5">Producto</th>
                          <th className="text-right px-3 py-2.5 w-24">Facturado</th>
                          <th className="text-right px-3 py-2.5 w-24">Acreditable</th>
                          <th className="text-right px-3 py-2.5 w-28">Devolver</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                        {creditable.map((l) => (
                          <tr key={l.salesOrderItemId}>
                            <td className="px-3 py-2 text-surface-900 dark:text-white">{l.productName}</td>
                            <td className="px-3 py-2 text-right text-surface-500">{l.invoicedQty}</td>
                            <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.creditableQty}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" min={0} max={l.creditableQty} step="0.01"
                                value={ncQty[l.salesOrderItemId] ?? ''}
                                onChange={(e) => {
                                  const v = Math.min(l.creditableQty, Math.max(0, parseFloat(e.target.value) || 0));
                                  setNcQty((prev) => ({ ...prev, [l.salesOrderItemId]: v }));
                                }}
                                placeholder="0"
                                className="w-24 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-right text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">MOTIVO *</label>
                    <input value={ncReason} onChange={(e) => setNcReason(e.target.value)}
                      placeholder="Devolución de mercancía, error de facturación…"
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                    <input type="checkbox" checked={ncRestock} onChange={(e) => setNcRestock(e.target.checked)} className="rounded" />
                    Devolver la mercancía a stock (desmarcar si es merma/avería)
                  </label>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                    <span className="text-sm text-surface-500">Total a acreditar</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">-${ncTotal.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setNcOpen(false)} disabled={ncBusy}
                  className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm hover:bg-surface-50 dark:hover:bg-surface-700">
                  Cancelar
                </button>
                <button onClick={submitNC} disabled={ncBusy || creditable.length === 0 || ncTotal <= 0}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {ncBusy ? 'Emitiendo…' : 'Emitir Nota de Crédito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nota de Débito */}
      {ndOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !ndBusy && setNdOpen(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900 dark:text-white">➕ Nota de Débito · {invoice.number}</h2>
              <button onClick={() => setNdOpen(false)} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-surface-600 dark:text-surface-400 block">CONCEPTOS *</label>
                {ndConcepts.map((c, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input value={c.description}
                      onChange={(e) => setNdConcepts((prev) => prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p)))}
                      placeholder="Interés por mora, gasto no facturado…"
                      className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                    <input type="number" min={0} step="0.01" value={c.amount}
                      onChange={(e) => setNdConcepts((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)))}
                      placeholder="0.00"
                      className="w-28 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-right text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                    <button onClick={() => setNdConcepts((prev) => prev.filter((_, i) => i !== idx))} disabled={ndConcepts.length === 1}
                      className="px-2 text-surface-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed">×</button>
                  </div>
                ))}
                <button onClick={() => setNdConcepts((prev) => [...prev, { description: '', amount: '' }])}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Agregar concepto</button>
              </div>

              <div>
                <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">IVA (%)</label>
                <select value={ndTaxRate} onChange={(e) => setNdTaxRate(Number(e.target.value))}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none">
                  <option value={0}>0%</option>
                  <option value={8}>8%</option>
                  <option value={12}>12%</option>
                  <option value={15}>15%</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">MOTIVO *</label>
                <input value={ndReason} onChange={(e) => setNdReason(e.target.value)}
                  placeholder="Interés por mora en el pago…"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                <span className="text-sm text-surface-500">Total a cargar</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">+${ndTotal.toFixed(2)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setNdOpen(false)} disabled={ndBusy}
                  className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm hover:bg-surface-50 dark:hover:bg-surface-700">
                  Cancelar
                </button>
                <button onClick={submitND} disabled={ndBusy || ndTotal <= 0}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {ndBusy ? 'Emitiendo…' : 'Emitir Nota de Débito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
