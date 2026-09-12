import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { salesApi } from '../../api/sales';
import { getErrorMessage } from '../../api/client';
import ShipmentCard from '../../components/logistics/ShipmentCard';
import DispatchModal from '../../components/sales/DispatchModal';
import SmartButtons from '../../components/SmartButtons';
import Chatter from '../../components/Chatter';
import Activities from '../../components/Activities';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: '⏳ Pendiente de aprobación', color: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' },
  DRAFT:      { label: 'Borrador',    color: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300' },
  CONFIRMED:  { label: 'Confirmado',  color: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' },
  PICKING:    { label: 'Preparando',  color: 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300' },
  PARTIALLY_SHIPPED: { label: 'Despacho parcial', color: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300' },
  DISPATCHED: { label: 'Despachado',  color: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  DELIVERED:  { label: 'Entregado',   color: 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300' },
  PARTIALLY_INVOICED: { label: 'Facturación parcial', color: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300' },
  INVOICED:   { label: 'Facturado',   color: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' },
  COMPLETED:  { label: 'Completado',  color: 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300' },
  CANCELLED:  { label: 'Cancelado',   color: 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-400' },
};

// Chatter (A2.2) traduce logFrom/logTo con el mismo mapa de arriba, aplanado a { código: etiqueta }.
const SALES_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([code, v]) => [code, v.label]),
);

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [showDispatch, setShowDispatch] = useState(false);
  const [withholding, setWithholding] = useState<any>(null);

  // Preview de retenciones (neto a cobrar). Refrescable tras cada acción (DeepSeek #7).
  async function loadWithholding(oid: string) {
    try { const r = await salesApi.getWithholdingPreview(oid); setWithholding(r.data); }
    catch { setWithholding(null); }
  }

  useEffect(() => {
    if (!id) return;
    salesApi.getOrder(id)
      .then(r => setOrder(r.data))
      .catch(() => setError('No se pudo cargar el pedido'))
      .finally(() => setLoading(false));
    loadWithholding(id);
  }, [id]);

  async function handleAction(action: 'confirm' | 'dispatch') {
    if (!id) return;
    setActionLoading(action);
    setError('');
    try {
      if (action === 'confirm') {
        await salesApi.confirmOrder(id);
      } else {
        await salesApi.dispatchOrder(id);
      }
      const r = await salesApi.getOrder(id);
      setOrder(r.data);
      await loadWithholding(id);
    } catch (e: any) {
      setError(getErrorMessage(e, `Error al ${action === 'confirm' ? 'confirmar' : 'despachar'} pedido`));
    }
    setActionLoading('');
  }

  async function handleApprove() {
    if (!id) return;
    setActionLoading('approve');
    setError('');
    try {
      await salesApi.approveOrder(id);
      const r = await salesApi.getOrder(id);
      setOrder(r.data);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al aprobar el pedido'));
    }
    setActionLoading('');
  }

  async function handleReject() {
    if (!id) return;
    const reason = window.prompt('Motivo del rechazo:');
    if (!reason) return;
    setActionLoading('reject');
    setError('');
    try {
      await salesApi.rejectOrder(id, reason);
      const r = await salesApi.getOrder(id);
      setOrder(r.data);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al rechazar el pedido'));
    }
    setActionLoading('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!order) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <p className="text-red-500 dark:text-red-400 mb-4">{error || 'Pedido no encontrado'}</p>
        <Link to="/sales" className="text-brand-600 dark:text-brand-400 hover:underline text-sm">← Volver a Ventas</Link>
      </div>
    </div>
  );

  const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300' };

  return (
    <div className="max-w-5xl mx-auto">
      {showDispatch && (
        <DispatchModal
          order={order}
          onClose={() => setShowDispatch(false)}
          onDone={async () => {
            setShowDispatch(false);
            if (id) { const r = await salesApi.getOrder(id); setOrder(r.data); await loadWithholding(id); }
          }}
        />
      )}
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{order.orderNumber}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status === 'PENDING_APPROVAL' && (
            <>
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'approve' ? 'Aprobando...' : '✓ Aprobar'}
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'reject' ? 'Rechazando...' : '✕ Rechazar'}
              </button>
            </>
          )}
          {order.status === 'DRAFT' && (
            <button
              onClick={() => handleAction('confirm')}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'confirm' ? 'Confirmando...' : '✓ Confirmar Pedido'}
            </button>
          )}
          {['CONFIRMED', 'PICKING', 'PARTIALLY_SHIPPED'].includes(order.status) && (
            <button
              onClick={() => setShowDispatch(true)}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              🚚 Despachar
            </button>
          )}
          {order.invoices?.length > 0 && (
            <Link
              to={`/financial/invoices/${order.invoices[order.invoices.length - 1].id}`}
              className="px-4 py-2 bg-cyan-50 dark:bg-cyan-900/50 hover:bg-cyan-100 dark:hover:bg-cyan-800/50 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-sm rounded-lg font-medium transition-colors"
            >
              📑 {order.invoices.length === 1 ? `Ver Factura ${order.invoices[0].number}` : `Ver Facturas (${order.invoices.length})`}
            </Link>
          )}
        </div>
      </div>

      {/* Smart buttons (A4): asientos, facturas y envíos vinculados */}
      <SmartButtons entityType="SALES_ORDER" entityId={order.id} refreshKey={order.status} />

      <div className="space-y-6">
        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Aviso de disponibilidad antes de confirmar un pedido DRAFT (la reserva es el gate duro) */}
        {order.status === 'DRAFT' && (() => {
          const short = (order.items || []).filter((it: any) => typeof it.availableStock === 'number' && Number(it.quantity) > it.availableStock);
          if (short.length === 0) return null;
          return (
            <div className="text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              ⚠ {short.length} {short.length === 1 ? 'producto no tiene' : 'productos no tienen'} stock suficiente. Al confirmar, la reserva podría fallar (STOCK_ERROR); revisa la disponibilidad por línea o ajusta cantidades.
            </div>
          );
        })()}

        {/* Envío / tracking (la guía se crea cuando ya está despachado) */}
        <ShipmentCard
          orderType="SALES"
          orderId={order.id}
          enabled={['DISPATCHED', 'INVOICED', 'DELIVERED'].includes(order.status)}
        />

        {/* Info general */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cliente */}
          <div className="md:col-span-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5">
            <p className="text-xs text-surface-500 uppercase mb-3">Cliente</p>
            <p className="text-surface-900 dark:text-white font-semibold text-lg">{order.customer?.name}</p>
            {order.customer?.ruc && <p className="text-surface-500 text-sm mt-0.5">RUC: {order.customer.ruc}</p>}
            {order.customer?.email && <p className="text-surface-500 text-sm">{order.customer.email}</p>}
            {order.customer?.phone && <p className="text-surface-500 text-sm">{order.customer.phone}</p>}
            {order.customer?.address && <p className="text-surface-500 text-sm mt-1">{order.customer.address}</p>}
          </div>

          {/* Meta */}
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-xs text-surface-500 uppercase mb-1">Pedido</p>
              <p className="text-surface-900 dark:text-white font-mono">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500 uppercase mb-1">Fecha</p>
              <p className="text-surface-700 dark:text-surface-300 text-sm">{new Date(order.createdAt).toLocaleDateString('es-EC', { day:'2-digit', month:'short', year:'numeric' })}</p>
            </div>
            {order.deliveryDate && (
              <div>
                <p className="text-xs text-surface-500 uppercase mb-1">Entrega</p>
                <p className="text-surface-700 dark:text-surface-300 text-sm">{new Date(order.deliveryDate).toLocaleDateString('es-EC', { day:'2-digit', month:'short', year:'numeric' })}</p>
              </div>
            )}
            {order.quotation && (
              <div>
                <p className="text-xs text-surface-500 uppercase mb-1">Cotización origen</p>
                <p className="text-brand-600 dark:text-brand-400 text-sm font-mono">{order.quotation.quoteNumber}</p>
              </div>
            )}
          </div>
        </div>

        {/* Flujo de estado */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5">
          <p className="text-xs text-surface-500 uppercase mb-4">Progreso del pedido</p>
          <div className="flex items-center gap-0">
            {['DRAFT','CONFIRMED','PICKING','DISPATCHED','DELIVERED','INVOICED'].map((s, i, arr) => {
              const statuses = ['DRAFT','CONFIRMED','PICKING','DISPATCHED','DELIVERED','INVOICED','CANCELLED'];
              const currentIdx = statuses.indexOf(order.status);
              const stepIdx = statuses.indexOf(s);
              const done = currentIdx > stepIdx;
              const active = currentIdx === stepIdx;
              const cancelled = order.status === 'CANCELLED';
              return (
                <div key={s} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                      ${cancelled ? 'border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-surface-400'
                        : done ? 'border-green-500 bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                        : active ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300'
                        : 'border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-surface-400'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center leading-tight
                      ${cancelled ? 'text-surface-400'
                        : done ? 'text-green-600 dark:text-green-400'
                        : active ? 'text-brand-600 dark:text-brand-300'
                        : 'text-surface-400'}`}>
                      {STATUS_LABELS[s]?.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-5 ${done && !cancelled ? 'bg-green-400 dark:bg-green-700' : 'bg-surface-200 dark:bg-surface-700'}`} />
                  )}
                </div>
              );
            })}
            {order.status === 'CANCELLED' && (
              <div className="flex flex-col items-center flex-shrink-0 ml-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">✕</div>
                <span className="text-xs mt-1 text-red-600 dark:text-red-400">Cancelado</span>
              </div>
            )}
          </div>
        </div>

        {/* Ítems del pedido */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white">Productos del pedido</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-5 py-3">PRODUCTO</th>
                  <th className="text-right px-4 py-3 w-24">CANT.</th>
                  <th className="text-right px-4 py-3 w-28">P. UNIT.</th>
                  <th className="text-right px-4 py-3 w-20">DESC.</th>
                  <th className="text-right px-4 py-3 w-20">IVA</th>
                  <th className="text-right px-4 py-3 w-28">SUBTOTAL</th>
                  <th className="text-right px-5 py-3 w-28">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {(order.items || []).map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-surface-900 dark:text-white font-medium">{item.product?.name ?? item.productId}</p>
                      {item.description && <p className="text-surface-500 text-xs mt-0.5">{item.description}</p>}
                      {item.warehouse && <p className="text-surface-400 text-xs">Bodega: {item.warehouse.name}</p>}
                      {item.reservedQty > 0 && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Reservado: {Number(item.reservedQty).toFixed(2)}
                        </span>
                      )}
                      {order.status === 'DRAFT' && typeof item.availableStock === 'number' && Number(item.quantity) > item.availableStock && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 block" title="Disponible en bodega = físico − reservas de otros pedidos">
                          ⚠ Disponible: {item.availableStock} (faltan {(Number(item.quantity) - item.availableStock).toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{Number(item.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">${Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-surface-500">{Number(item.discount).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-surface-500">{Number(item.taxRate).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">${Number(item.subtotal).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-600 dark:text-green-400">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="px-5 py-4 border-t border-surface-200 dark:border-surface-700 flex justify-end">
            <div className="space-y-1.5 text-sm w-64">
              <div className="flex justify-between text-surface-500">
                <span>Subtotal:</span>
                <span>${Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-surface-500">
                <span>IVA:</span>
                <span>${Number(order.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-surface-900 dark:text-white font-bold text-base border-t border-surface-200 dark:border-surface-700 pt-2 mt-1">
                <span>TOTAL:</span>
                <span className="text-green-600 dark:text-green-400">${Number(order.total).toFixed(2)}</span>
              </div>

              {/* Retenciones que el cliente aplicará al facturar (mejora DeepSeek #3) */}
              {withholding && withholding.lines?.length > 0 && (
                <>
                  <div className="border-t border-dashed border-surface-200 dark:border-surface-700 pt-2 mt-2">
                    <p className="text-xs text-surface-500 uppercase mb-1">Retenciones aplicadas</p>
                    {withholding.lines.map((l: any, i: number) => (
                      <div key={i} className="flex justify-between text-amber-600 dark:text-amber-400 text-xs">
                        <span>{l.tipo} {l.codigo} ({Number(l.porcentaje)}%):</span>
                        <span>− ${Number(l.valor).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-surface-900 dark:text-white font-bold border-t border-surface-200 dark:border-surface-700 pt-1.5 mt-1">
                    <span>NETO A COBRAR:</span>
                    <span className="text-brand-600 dark:text-brand-400">${Number(withholding.netToCollect).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notas + Info adicional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {order.notes && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5">
              <p className="text-xs text-surface-500 uppercase mb-2">Notas</p>
              <p className="text-surface-700 dark:text-surface-300 text-sm whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
          {order.deliveryAddress && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5">
              <p className="text-xs text-surface-500 uppercase mb-2">Dirección de entrega</p>
              <p className="text-surface-700 dark:text-surface-300 text-sm">{order.deliveryAddress}</p>
            </div>
          )}
          {order.createdBy && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-5">
              <p className="text-xs text-surface-500 uppercase mb-2">Creado por</p>
              <p className="text-surface-700 dark:text-surface-300 text-sm">{order.createdBy}</p>
            </div>
          )}
        </div>

        {/* Facturas vinculadas (puede haber varias con despachos parciales) */}
        {order.invoices?.length > 0 && (
          <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 rounded-2xl p-5">
            <p className="text-xs text-cyan-600 dark:text-cyan-400 uppercase mb-2">
              {order.invoices.length === 1 ? 'Factura generada' : `Facturas generadas (${order.invoices.length})`}
            </p>
            <div className="space-y-2">
              {order.invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-surface-900 dark:text-white font-semibold">{inv.number}</p>
                    <p className="text-surface-500 text-sm mt-0.5">
                      ${Number(inv.totalAmount).toFixed(2)} · {inv.status}
                    </p>
                  </div>
                  <Link
                    to={`/financial/invoices/${inv.id}`}
                    className="px-4 py-2 bg-cyan-100 dark:bg-cyan-900/50 hover:bg-cyan-200 dark:hover:bg-cyan-800/60 border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 text-sm rounded-xl transition-colors"
                  >
                    Ver factura →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chatter (A2): hilo de mensajes del documento */}
        <Activities entityType="SALES_ORDER" entityId={order.id} />
        <Chatter entityType="SALES_ORDER" entityId={order.id} statusLabels={SALES_STATUS_LABELS} />
      </div>
    </div>
  );
}
