import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { purchasesApi } from '../../api/purchases';
import { inventoryApi } from '../../api/inventory';
import { reportsApi } from '../../api/reports';
import AttachmentUpload from '../../components/AttachmentUpload';
import SmartButtons from '../../components/SmartButtons';
import Chatter from '../../components/Chatter';
import Activities from '../../components/Activities';
import FlowGuideBanner, { type FlowStep } from '../../components/purchases/FlowGuideBanner';
import ShipmentCard from '../../components/logistics/ShipmentCard';
import { ApprovalStepIndicator } from '../../components/purchases/ApprovalStepIndicator';
import { useToast } from '../../components/ui/Toast';
import { ProgressBar } from 'react-bootstrap';
import { canDo } from '../../machines/purchaseOrder.machine';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:       'bg-surface-100 dark:bg-surface-700 text-surface-500',
  SUBMITTED:   'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PENDING_L1:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PENDING_L2:  'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L3:  'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400',
  PENDING_L4:  'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  PENDING_L5:  'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400',
  APPROVED:    'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  PARTIAL:     'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  RECEIVED:    'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED:    'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  CANCELLED:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviada',
  PENDING_L1: 'Pendiente L1', PENDING_L2: 'Pendiente L2',
  PENDING_L3: 'Pendiente L3', PENDING_L4: 'Pendiente L4', PENDING_L5: 'Pendiente L5',
  APPROVED: 'Aprobada', PARTIAL: 'Recepción parcial', RECEIVED: 'Recibida',
  REJECTED: 'Rechazada', CANCELLED: 'Cancelada',
};

function getPendingLevel(status: string): number | null {
  const m = status.match(/^PENDING_L(\d)$/);
  return m ? parseInt(m[1]) : null;
}

const STEPS = [
  { key: 'DRAFT',     label: 'Borrador',  icon: '📝' },
  { key: 'SUBMITTED', label: 'Enviada',   icon: '📨' },
  { key: 'APPROVED',  label: 'Aprobada',  icon: '✅' },
  { key: 'RECEIVED',  label: 'Recibida',  icon: '📦' },
];

function StatusStepper({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
        <span>❌</span><strong>Orden cancelada.</strong> No se procesará.
      </div>
    );
  }
  const isPartial = status === 'PARTIAL';
  const currentIdx = isPartial ? STEPS.findIndex((s) => s.key === 'RECEIVED') : STEPS.findIndex((s) => s.key === status);
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-surface-500 uppercase tracking-wider">Progreso de la orden</p>
        {isPartial && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 font-medium">
            Recepción parcial — falta recibir ítems
          </span>
        )}
      </div>
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const future = i > currentIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold transition-all ${
                  done ? 'bg-green-500 text-white shadow-md' :
                  active ? 'bg-brand-500 text-white ring-4 ring-brand-200 dark:ring-brand-900 animate-pulse' :
                  'bg-surface-100 dark:bg-surface-700 text-surface-400'
                }`}>
                  {done ? '✓' : step.icon}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  done ? 'text-green-600 dark:text-green-400' :
                  active ? 'text-brand-600 dark:text-brand-400' :
                  'text-surface-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                  future ? 'bg-surface-200 dark:bg-surface-700' : 'bg-green-500'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [showApprove, setShowApprove] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [qualityOk, setQualityOk] = useState(true);
  const [conformityNotes, setConformityNotes] = useState('');

  const load = () => {
    setLoading(true);
    purchasesApi.getOrder(id!).then((r) => {
      setOrder(r.data);
      setNotes(r.data?.notes || '');
      // Inicializar cantidades a recibir = pendiente de cada ítem
      const defaults: Record<string, string> = {};
      for (const it of r.data?.items || []) {
        const pending = (it.quantity ?? 0) - (it.receivedQuantity ?? 0);
        defaults[it.id] = String(Math.max(0, pending));
      }
      setReceiveQty(defaults);
    })
      .catch(() => setError('No se pudo cargar la orden de compra'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    inventoryApi.getWarehouses().then((r) => { setWarehouses(r.data); if (r.data.length > 0) setWarehouseId(r.data[0].id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatus = async (status: string) => {
    setLoading(true);
    try { await purchasesApi.updateStatus(id!, status); load(); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await purchasesApi.submitOrder(id!);
      toast.success('Orden enviada al flujo de aprobación');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al enviar la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const level = getPendingLevel(order?.status);
    if (!level) return;
    setLoading(true);
    try {
      await purchasesApi.approveOrder(id!, level, approveNotes || undefined);
      toast.success(`Nivel ${level} aprobado correctamente`);
      setApproveNotes('');
      setShowApprove(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al aprobar');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Ingresa un motivo de rechazo'); return; }
    setLoading(true);
    try {
      await purchasesApi.rejectOrder(id!, rejectReason);
      toast.error('Orden rechazada');
      setRejectReason('');
      setShowReject(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al rechazar');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!warehouseId) { setError('Selecciona una bodega'); return; }
    const lines = (order?.items || [])
      .map((it: any) => ({ itemId: it.id, quantity: Number(receiveQty[it.id] || 0) }))
      .filter((l: any) => l.quantity > 0);
    if (lines.length === 0) { setError('Indica al menos una cantidad a recibir'); return; }
    setLoading(true);
    setError('');
    try {
      await purchasesApi.receiveOrder(id!, warehouseId, lines, { qualityOk, conformityNotes: conformityNotes || undefined });
      toast.success('Recepción registrada');
      load();
    }
    catch (e: any) { setError(e.response?.data?.error || 'Error al recibir'); }
    finally { setLoading(false); }
  };

  const handlePayAdvance = async () => {
    setLoading(true);
    try { await purchasesApi.payAdvance(id!); toast.success('Anticipo pagado'); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error al pagar anticipo'); }
    finally { setLoading(false); }
  };

  const handlePayBalance = async () => {
    setLoading(true);
    try { await purchasesApi.payBalance(id!); toast.success('Saldo pagado'); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error al pagar saldo'); }
    finally { setLoading(false); }
  };

  // Avance de recepción (Σ recibido / Σ ordenado)
  const recvProgress = (() => {
    const its = order?.items || [];
    const ordered = its.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    const received = its.reduce((s: number, it: any) => s + Number(it.receivedQuantity || 0), 0);
    return ordered > 0 ? Math.round((received / ordered) * 100) : 0;
  })();

  if (loading && !order) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!order) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-red-600 dark:text-red-400">{error || 'Orden no encontrada'}</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/purchases" className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 text-sm">← Compras</Link>
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{order.poNumber}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="text-sm text-surface-500">{order.supplier?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={async () => {
              try { await reportsApi.poPdf(order.id, order.poNumber); }
              catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo generar el PDF'); }
            }}
            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">
            📄 PDF
          </button>
          {/* Acciones gateadas por el statechart canónico (purchaseOrder.machine) */}
          {canDo(order, 'SUBMIT') && (
            <>
              <button onClick={handleSubmit} disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Enviar a aprobación
              </button>
              {canDo(order, 'CANCEL') && (
                <button onClick={() => handleStatus('CANCELLED')} disabled={loading}
                  className="border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm transition-colors">
                  Cancelar
                </button>
              )}
            </>
          )}
          {/* Backward compatibility: old SUBMITTED status */}
          {order.status === 'SUBMITTED' && (
            <button onClick={() => setShowApprove(true)} disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
              Aprobar
            </button>
          )}
          {/* Multi-level approval buttons (visibilidad derivada del statechart) */}
          {getPendingLevel(order.status) !== null && canDo(order, 'APPROVE') && (
            <>
              <button onClick={() => setShowApprove(true)} disabled={loading}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                ✓ Aprobar Nivel {getPendingLevel(order.status)}
              </button>
              {canDo(order, 'REJECT') && (
                <button onClick={() => setShowReject(true)} disabled={loading}
                  className="border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm transition-colors">
                  Rechazar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Smart buttons (A4): asientos, envíos y docs SRI vinculados */}
      <SmartButtons entityType="PURCHASE_ORDER" entityId={order.id} refreshKey={order.status} />

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Guía del flujo de compras */}
        {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (() => {
          let guide: { step: FlowStep; nextLabel?: string } | null = null;
          if (order.status === 'DRAFT') {
            guide = { step: 4, nextLabel: 'Envía la OC a aprobación con el botón de arriba' };
          } else if (order.status === 'SUBMITTED' || order.status.startsWith('PENDING_L')) {
            const lvl = order.status.startsWith('PENDING_L') ? order.status.slice(-1) : '1';
            guide = { step: 4, nextLabel: `Aprueba el Nivel ${lvl} para habilitar pagos y recepción` };
          } else if (order.status === 'APPROVED' || order.status === 'PARTIAL') {
            guide = order.advanceStatus === 'PENDING'
              ? { step: 5, nextLabel: `Paga el anticipo (${order.advancePercent}%) en el panel de pagos` }
              : { step: 5, nextLabel: order.status === 'PARTIAL' ? 'Recibe el restante y registra la conformidad' : 'Recibe la mercadería verificando buen estado y entrega a tiempo' };
          } else if (order.status === 'RECEIVED') {
            guide = order.balanceStatus !== 'PAID'
              ? (order.qualityConformity
                  ? { step: 5, nextLabel: 'Paga el saldo contra entrega para cerrar la compra' }
                  : { step: 5, nextLabel: 'Recepción no conforme — gestiona con el proveedor antes de pagar el saldo' })
              : { step: 6 };
          }
          return guide ? <FlowGuideBanner step={guide.step} nextLabel={guide.nextLabel} /> : null;
        })()}

        {/* Status stepper */}
        <StatusStepper status={order.status} />

        {/* Seguimiento de entrega + pagos (anticipo / saldo) */}
        {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && getPendingLevel(order.status) === null && order.status !== 'DRAFT' && (
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft space-y-4">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white">📦 Seguimiento de entrega y pagos</h3>

            {/* Avance de recepción en tiempo real */}
            <div>
              <div className="flex justify-between text-xs text-surface-500 mb-1">
                <span>Avance de recepción</span>
                <span className="font-semibold text-surface-700 dark:text-surface-200">{recvProgress}%</span>
              </div>
              <ProgressBar now={recvProgress} variant={recvProgress >= 100 ? 'success' : 'primary'} style={{ height: '8px', borderRadius: '999px' }} className="bs-progress" />
            </div>

            {/* Ubicación de entrega */}
            {order.deliveryLocation && (
              <div className="text-sm text-surface-600 dark:text-surface-300">
                📍 Entrega en: <span className="font-medium">{order.deliveryLocation.warehouse?.name} · {order.deliveryLocation.code}</span>
                {order.deliveryLocation.zone && <span className="text-surface-400"> (Zona {order.deliveryLocation.zone}{order.deliveryLocation.rack ? `, Percha ${order.deliveryLocation.rack}` : ''}{order.deliveryLocation.level ? `, Piso ${order.deliveryLocation.level}` : ''})</span>}
              </div>
            )}

            {/* Estado de conformidad */}
            {order.conformityAt && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full font-medium ${order.qualityConformity ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                  {order.qualityConformity ? '✓ Buen estado' : '✕ No conforme'}
                </span>
                <span className={`px-2 py-1 rounded-full font-medium ${order.receivedOnTime ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                  {order.receivedOnTime ? '✓ A tiempo' : '⚠ Con retraso'}
                </span>
              </div>
            )}

            {/* Pagos: anticipo y saldo */}
            {(order.advancePercent > 0 || order.advanceStatus !== 'NONE') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-surface-100 dark:border-surface-700">
                <div className="bg-surface-50 dark:bg-surface-900/40 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-500">Anticipo ({order.advancePercent}%)</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.advanceStatus === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                      {order.advanceStatus === 'PAID' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">${Number(order.advanceAmount || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
                  {canDo(order, 'PAY_ADVANCE') && (
                    <button onClick={handlePayAdvance} disabled={loading}
                      className="mt-2 w-full bg-brand-500 hover:bg-brand-600 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                      Pagar anticipo
                    </button>
                  )}
                  {order.advanceStatus === 'PAID' && order.balanceStatus !== 'PAID' && !order.qualityConformity && (
                    <p className="mt-2 text-xs text-surface-500 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-lg px-2.5 py-2">
                      ✅ Anticipo pagado ({order.advancePercent}%). El saldo de
                      <span className="font-semibold"> ${(Number(order.totalAmount) - Number(order.advanceAmount || 0)).toLocaleString('es', { minimumFractionDigits: 2 })} </span>
                      se habilitará tras la recepción conforme (buen estado).
                    </p>
                  )}
                </div>
                <div className="bg-surface-50 dark:bg-surface-900/40 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-500">Saldo contra entrega</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.balanceStatus === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300'}`}>
                      {order.balanceStatus === 'PAID' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">${(Number(order.totalAmount) - Number(order.advanceAmount || 0)).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
                  {order.balanceStatus !== 'PAID' && (
                    <button onClick={handlePayBalance} disabled={loading || !canDo(order, 'PAY_BALANCE')}
                      title={!canDo(order, 'PAY_BALANCE') ? 'Requiere recepción conforme' : ''}
                      className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {canDo(order, 'PAY_BALANCE') ? 'Pagar saldo' : '🔒 Pagar saldo (requiere conformidad)'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Envío entrante del proveedor (tracking de la entrega de la OC) */}
        {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
          <ShipmentCard
            orderType="PURCHASE"
            orderId={order.id}
            enabled={['APPROVED', 'PARTIAL', 'RECEIVED'].includes(order.status)}
          />
        )}

        {/* Multi-level approval chain */}
        {order.requiredLevels > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-4">🔐 Cadena de Aprobación</h3>
            <ApprovalStepIndicator
              requiredLevels={order.requiredLevels}
              currentLevel={order.currentLevel}
              status={order.status}
              steps={[
                order.l1ApprovedAt && { level: 1, label: 'Jefe de Área', approverId: order.l1ApproverId, approvedAt: order.l1ApprovedAt, notes: order.l1Notes },
                order.l2ApprovedAt && { level: 2, label: 'Jefe de Compras', approverId: order.l2ApproverId, approvedAt: order.l2ApprovedAt, notes: order.l2Notes },
                order.l3ApprovedAt && { level: 3, label: 'Director Financiero', approverId: order.l3ApproverId, approvedAt: order.l3ApprovedAt, notes: order.l3Notes },
                order.l4ApprovedAt && { level: 4, label: 'Gerente General', approverId: order.l4ApproverId, approvedAt: order.l4ApprovedAt, notes: order.l4Notes },
                order.l5ApprovedAt && { level: 5, label: 'Directorio', approverId: order.l5ApproverId, approvedAt: order.l5ApprovedAt, notes: order.l5Notes },
              ].filter(Boolean) as any[]}
            />
            {order.rejectionReason && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700 text-sm text-red-700 dark:text-red-400">
                <strong>Motivo de rechazo:</strong> {order.rejectionReason}
              </div>
            )}
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">Proveedor</p>
            <p className="font-semibold text-surface-800 dark:text-white mt-1">{order.supplier.name}</p>
            {order.supplier.email && <p className="text-surface-500 text-sm">{order.supplier.email}</p>}
            <Link to={`/purchases/suppliers/${order.supplier.id}`} className="text-xs text-brand-500 hover:underline mt-2 inline-block">
              Ver perfil →
            </Link>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">Fechas</p>
            <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
              Creada: <span className="font-medium">{new Date(order.createdAt).toLocaleDateString('es')}</span>
            </p>
            <p className="text-sm text-surface-700 dark:text-surface-300">
              Entrega: <span className="font-medium">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('es') : '—'}</span>
            </p>
            {order.approvedAt && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                ✓ Aprobada: <span className="font-medium">{new Date(order.approvedAt).toLocaleDateString('es')}</span>
              </p>
            )}
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
              ${Number(order.totalAmount).toLocaleString('es', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-surface-400 mt-1">{order.items?.length || 0} ítem{order.items?.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h2 className="font-semibold text-surface-800 dark:text-white">Productos</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-right px-4 py-3">Precio Unit.</th>
                <th className="text-right px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {order.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  <td className="px-4 py-3 text-surface-800 dark:text-white">
                    {item.product?.name || 'Producto eliminado'}
                    {item.purchaseQuantity != null && item.purchaseUnitLabel && (
                      <span className="block text-xs text-blue-600 dark:text-blue-400 font-normal mt-0.5">
                        Se compró: {Number(item.purchaseQuantity)} {item.purchaseUnitLabel} ({item.quantity} {item.product?.unit || 'unidades'})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-surface-600 dark:text-surface-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-600 dark:text-surface-300">${Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-surface-800 dark:text-white">${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-surface-50 dark:bg-surface-900/50">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-surface-700 dark:text-surface-300">Total</td>
                <td className="px-4 py-3 text-right font-bold text-lg text-surface-900 dark:text-white">${Number(order.totalAmount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recepción */}
        {(order.status === 'APPROVED' || order.status === 'PARTIAL') && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-yellow-300 dark:border-yellow-600/40 p-6 space-y-4 shadow-soft">
            <h2 className="font-semibold text-yellow-700 dark:text-yellow-400">📦 Recibir Mercancía</h2>
            <p className="text-surface-500 text-sm">
              Ajusta la cantidad a recibir por ítem (recepción parcial permitida). El inventario sube solo por lo recibido,
              con costo promedio ponderado.
            </p>
            <div className="overflow-x-auto rounded-lg border border-surface-100 dark:border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-right px-3 py-2">Ordenado</th>
                    <th className="text-right px-3 py-2">Recibido</th>
                    <th className="text-right px-3 py-2">Pendiente</th>
                    <th className="text-right px-3 py-2">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {order.items.map((it: any) => {
                    const pending = (it.quantity ?? 0) - (it.receivedQuantity ?? 0);
                    return (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-surface-800 dark:text-white">{it.product?.name || 'Producto eliminado'}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-600 dark:text-surface-300">{it.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-500">{it.receivedQuantity ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600 dark:text-orange-400">{pending}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            inputMode="numeric"
                            value={receiveQty[it.id] ?? ''}
                            disabled={pending <= 0}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              const capped = raw === '' ? '' : String(Math.min(Number(raw), pending));
                              setReceiveQty((q) => ({ ...q, [it.id]: capped }));
                            }}
                            className="w-24 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Conformidad de calidad (buen estado) — se registra en la recepción final */}
            <div className="bg-surface-50 dark:bg-surface-900/40 rounded-lg p-4 border border-surface-100 dark:border-surface-700 space-y-2">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Conformidad de recepción</p>
              <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <input type="checkbox" checked={qualityOk} onChange={(e) => setQualityOk(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <span>La mercadería llegó en <strong>buen estado</strong> y conforme a lo solicitado</span>
              </label>
              <input value={conformityNotes} onChange={(e) => setConformityNotes(e.target.value)}
                placeholder="Observaciones de la recepción (opcional)"
                className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
              <p className="text-xs text-surface-400">La conformidad (buen estado) habilita el pago del saldo contra entrega. El cumplimiento a tiempo se calcula automáticamente.</p>
            </div>

            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Bodega destino</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <button onClick={handleReceive} disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                {loading ? 'Procesando...' : '✓ Confirmar Recepción'}
              </button>
            </div>
          </div>
        )}

        {order.status === 'RECEIVED' && (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-700 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-green-700 dark:text-green-400 text-sm flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span><strong>Orden recibida.</strong> Las entradas al inventario fueron registradas automáticamente.</span>
            </div>
            <Link to="/sri" className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
              📑 Registrar factura del proveedor
            </Link>
          </div>
        )}

        {order.status === 'PARTIAL' && (
          <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-700 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-orange-700 dark:text-orange-400 text-sm flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span><strong>Recepción parcial.</strong> Recibe el resto arriba; puedes ir registrando facturas de lo recibido.</span>
            </div>
            <Link to="/sri" className="text-sm px-4 py-2 border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg font-medium transition-colors whitespace-nowrap">
              📑 Registrar factura
            </Link>
          </div>
        )}

        {/* Notas */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft">
          <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-3">📝 Notas / Comentarios</h3>
          {order.notes ? (
            <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap bg-surface-50 dark:bg-surface-900/50 rounded-lg p-3 border border-surface-100 dark:border-surface-700">
              {order.notes}
            </p>
          ) : (
            <p className="text-sm text-surface-400">Sin notas registradas.</p>
          )}
          {order.status === 'DRAFT' && (
            <div className="mt-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Agrega notas internas sobre esta orden..."
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <p className="text-xs text-surface-400 mt-1">Las notas se guardarán cuando edites la OC.</p>
            </div>
          )}
        </div>

        {/* Adjuntos */}
        <AttachmentUpload entityType="purchases/orders" entityId={order.id} label="Documentos adjuntos" />

        {/* Chatter (A2): hilo de mensajes del documento */}
        <Activities entityType="PURCHASE_ORDER" entityId={order.id} />
        <Chatter entityType="PURCHASE_ORDER" entityId={order.id} statusLabels={STATUS_LABELS} />
      </div>

      {/* Approve dialog — multi-level */}
      {showApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
              ✓ Aprobar {getPendingLevel(order.status) ? `Nivel ${getPendingLevel(order.status)}` : 'Orden'}
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Orden <strong>{order.poNumber}</strong> —{' '}
              <strong>${Number(order.totalAmount).toLocaleString('es', { minimumFractionDigits: 2 })}</strong>
            </p>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Notas de aprobación (opcional)</label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                rows={3}
                placeholder="Ej: Conforme con el proveedor y precios cotizados"
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowApprove(false)} className="px-4 py-2 text-sm rounded-xl border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
                Cancelar
              </button>
              <button onClick={handleApprove} disabled={loading} className="px-5 py-2 text-sm rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-60 transition-colors">
                {loading ? 'Procesando...' : 'Confirmar aprobación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">✕ Rechazar Orden</h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Orden <strong>{order.poNumber}</strong>. Indica el motivo del rechazo.
            </p>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Motivo de rechazo <span className="text-red-500">*</span></label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Ej: Precio fuera de mercado, requiere nueva cotización"
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 text-sm rounded-xl border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
                Cancelar
              </button>
              <button onClick={handleReject} disabled={loading || !rejectReason.trim()} className="px-5 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60 transition-colors">
                {loading ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
