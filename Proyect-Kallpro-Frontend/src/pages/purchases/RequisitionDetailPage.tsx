import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { requisitionsApi } from '../../api/requisitions';
import { purchasesApi } from '../../api/purchases';
import { companyApi } from '../../api/company';
import { procurementApi } from '../../api/procurement';
import BackButton from '../../components/ui/BackButton';
import Chatter from '../../components/Chatter';
import Activities from '../../components/Activities';
import { reportsApi } from '../../api/reports';
import AttachmentUpload from '../../components/AttachmentUpload';
import SupplierScoreCard from '../../components/SupplierScoreCard';
import FlowGuideBanner, { type FlowStep } from '../../components/purchases/FlowGuideBanner';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_L1: 'Pendiente L1', PENDING_L2: 'Pendiente L2',
  PENDING_L3: 'Pendiente Gerencia', APPROVED: 'Aprobada', QUOTED: 'En Cotización',
  PO_CREATED: 'OC Generada', REJECTED: 'Rechazada',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-surface-100 dark:bg-surface-700 text-surface-500',
  PENDING_L1: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PENDING_L2: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L3: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  APPROVED:   'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  QUOTED:     'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  PO_CREATED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};

function ApprovalStep({ level, label, approvedAt, notes, status, currentStatus }: any) {
  const isActive = currentStatus === `PENDING_L${level}`;
  const isDone = !!approvedAt;
  const isRejected = status === 'REJECTED';
  return (
    <div className={`flex gap-3 items-start p-3 rounded-lg border ${
      isDone    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-500/5' :
      isActive  ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-500/5' :
      isRejected? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-500/5' :
                  'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
        ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-500'}`}>
        {isDone ? '✓' : level}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-surface-800 dark:text-white">{label}</p>
        {isDone && <p className="text-xs text-surface-500 mt-0.5">Aprobado {new Date(approvedAt).toLocaleDateString('es')}</p>}
        {notes && <p className="text-xs text-surface-500 mt-0.5 italic">"{notes}"</p>}
        {isActive && <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 animate-pulse">Esperando aprobación...</p>}
      </div>
    </div>
  );
}

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [req, setReq] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteData, setQuoteData] = useState({ supplierId: '', deliveryDays: 5, paymentTerms: '30 días', quoteNumber: '', notes: '' });
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [saving, setSaving]               = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAI, setLoadingAI]         = useState(false);
  const [selectedAiScore, setSelectedAiScore] = useState<string | null>(null);
  const [minQuotations, setMinQuotations] = useState(3);

  useEffect(() => {
    companyApi.getSettings()
      .then((r) => setMinQuotations(r.data?.settings?.purchases?.minQuotations ?? 3))
      .catch(() => {});
  }, []);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      requisitionsApi.getOne(id),
      purchasesApi.getSuppliers(),
    ]).then(([r, s]) => {
      setReq(r.data);
      setSuppliers(s.data);
      if (r.data.items) {
        setQuoteItems(r.data.items.map((item: any) => ({
          requisitionItemId: item.id,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: 0,
          brand: '',
          notes: '',
        })));
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  async function loadAISuggestions() {
    if (!id) return;
    setLoadingAI(true);
    try {
      const res = await procurementApi.getSupplierRecommendation(id);
      setAiSuggestions(res.data);
    } catch {
      setAiSuggestions({ aiNarrative: 'No se pudo conectar con Ollama. Verifica que esté activo en puerto 11434.', topSuppliers: [] });
    }
    setLoadingAI(false);
  }

  const handleApprove = async (level: number) => {
    setSaving(true);
    try {
      await requisitionsApi.approve(id!, level, approveNotes);
      load();
      setApproveNotes('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al aprobar');
    } finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!rejectReason) { toast.warning('Ingrese el motivo del rechazo'); return; }
    setSaving(true);
    try {
      await requisitionsApi.reject(id!, rejectReason);
      load();
      setShowReject(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al rechazar');
    } finally { setSaving(false); }
  };

  const handleAddQuote = async () => {
    if (!quoteData.supplierId) { toast.warning('Seleccione un proveedor'); return; }
    if (quoteItems.some((i) => !i.unitPrice)) { toast.warning('Complete todos los precios unitarios'); return; }
    setSaving(true);
    try {
      await requisitionsApi.addQuotation(id!, {
        ...quoteData,
        deliveryDays: Number(quoteData.deliveryDays),
        items: quoteItems,
      });
      load();
      setShowQuoteForm(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al agregar cotización');
    } finally { setSaving(false); }
  };

  const handleSelectWinner = async (quotationId: string) => {
    if ((req?.quotations?.length ?? 0) < minQuotations) {
      toast.warning(`Se requieren al menos ${minQuotations} cotizaciones de proveedores antes de seleccionar al ganador.`);
      return;
    }
    const ok = await confirmAction({ title: 'Seleccionar ganador', message: '¿Confirmar selección de proveedor ganador y generar OC?' });
    if (!ok) return;
    setSaving(true);
    try {
      const { data } = await requisitionsApi.selectWinner(id!, quotationId);
      toast.success(`OC ${data.purchaseOrder.poNumber} generada exitosamente`);
      navigate(`/purchases/${data.purchaseOrder.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al seleccionar ganador');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!req) return (
    <div className="flex items-center justify-center py-20 text-surface-500">Requisición no encontrada</div>
  );

  const isPending = ['PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(req.status);
  const canAddQuote = ['APPROVED', 'QUOTED'].includes(req.status) && (req.quotations?.length ?? 0) < 3;

  // Guía del flujo: en qué paso está esta compra y qué sigue
  const quoteCount = req.quotations?.length ?? 0;
  const hasWinner = req.quotations?.some((q: any) => q.isWinner) ?? false;
  let guide: { step: FlowStep; nextLabel?: string; nextUrl?: string; ctaText?: string } | null = null;
  if (req.status.startsWith('PENDING_L')) {
    guide = { step: 1, nextLabel: `Aprueba el Nivel ${req.status.slice(-1)} con los botones de arriba` };
  } else if (req.status === 'PO_CREATED' || hasWinner) {
    guide = { step: 4, nextLabel: 'OC generada — continúa con su aprobación', nextUrl: '/compras/ordenes', ctaText: 'Ver órdenes →' };
  } else if (['APPROVED', 'QUOTED'].includes(req.status)) {
    guide = quoteCount >= minQuotations
      ? { step: 3, nextLabel: 'Compara las cotizaciones según los pesos y elige al ganador', nextUrl: `/purchases/requisitions/${id}/compare`, ctaText: 'Ir al comparativo →' }
      : { step: 2, nextLabel: `Carga ${minQuotations} cotizaciones de proveedores antes de avanzar (${quoteCount}/${minQuotations}) — ${minQuotations - quoteCount === 1 ? 'falta 1' : `faltan ${minQuotations - quoteCount}`}` };
  }
  // Se exige un mínimo configurable de cotizaciones para habilitar el comparativo y elegir ganador
  const canCompare = quoteCount >= minQuotations;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallback="/purchases/requisitions" label="Requisiciones" />
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📄</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{req.reqNumber} — {req.title}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
              {req.budgetExceeded && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">⚠ Excede Presupuesto</span>
              )}
              {req.neededBy && (() => {
                const overdue = new Date(req.neededBy) < new Date() && !['PO_CREATED', 'REJECTED'].includes(req.status);
                return (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${overdue ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                    {overdue ? '⚠ Vencida' : 'Necesaria'}: {new Date(req.neededBy).toLocaleDateString('es')}
                  </span>
                );
              })()}
            </div>
            <p className="text-sm text-surface-500">{req.department?.name ?? 'Sin departamento'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={async () => {
              try { await reportsApi.requisitionPdf(req.id, req.reqNumber); }
              catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo generar el PDF'); }
            }}
            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">
            📄 PDF
          </button>
          {isPending && (
            <>
              {req.status === 'PENDING_L1' && (
                <button onClick={() => handleApprove(1)} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  ✓ Aprobar (L1)
                </button>
              )}
              {req.status === 'PENDING_L2' && (
                <button onClick={() => handleApprove(2)} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  ✓ Aprobar (L2)
                </button>
              )}
              {req.status === 'PENDING_L3' && (
                <button onClick={() => handleApprove(3)} disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  ✓ Aprobar Gerencia (L3)
                </button>
              )}
              <button onClick={() => setShowReject(!showReject)}
                className="border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-1.5 rounded-lg text-sm transition-colors">
                ✗ Rechazar
              </button>
            </>
          )}
          {canAddQuote && (
            <button onClick={() => setShowQuoteForm(!showQuoteForm)}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
              + Agregar Cotización ({req.quotations?.length ?? 0}/3)
            </button>
          )}
          {req.status === 'QUOTED' && (
            canCompare ? (
              <Link to={`/purchases/requisitions/${id}/compare`}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                📊 Ver Comparativo
              </Link>
            ) : (
              <span title={`Necesitas ${minQuotations} cotizaciones para comparar (${quoteCount}/${minQuotations})`}
                className="bg-surface-200 dark:bg-surface-700 text-surface-400 px-4 py-1.5 rounded-lg text-sm font-medium cursor-not-allowed inline-flex items-center gap-1">
                🔒 Comparativo ({quoteCount}/{minQuotations})
              </span>
            )
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Guía del flujo de compras */}
        {req.status !== 'REJECTED' && guide && (
          <FlowGuideBanner step={guide.step} nextLabel={guide.nextLabel} nextUrl={guide.nextUrl} ctaText={guide.ctaText} />
        )}

        {/* Notas de aprobación */}
        {isPending && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <label className="block text-sm text-blue-700 dark:text-blue-300 mb-1">Notas de aprobación (opcional)</label>
            <input value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)}
              className={inputCls} placeholder="Comentarios para el siguiente nivel..." />
          </div>
        )}

        {/* Panel de rechazo */}
        {showReject && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-700 rounded-xl p-4">
            <label className="block text-sm text-red-700 dark:text-red-300 mb-1">Motivo de rechazo *</label>
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              className={inputCls} placeholder="Explique el motivo del rechazo..." />
            <div className="flex gap-2 mt-3">
              <button onClick={handleReject} disabled={saving}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Confirmar Rechazo
              </button>
              <button onClick={() => setShowReject(false)}
                className="border border-surface-200 dark:border-surface-700 px-4 py-2 rounded-lg text-sm text-surface-600 dark:text-surface-400 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Cadena de aprobación */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft">
          <h2 className="font-semibold text-surface-800 dark:text-white mb-4">Cadena de Aprobación</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ApprovalStep level={1} label="Nivel 1 — Supervisor"
              approverId={req.l1ApproverId} approvedAt={req.l1ApprovedAt} notes={req.l1Notes}
              status={req.status} currentStatus={req.status} />
            <ApprovalStep level={2} label="Nivel 2 — Gerente"
              approverId={req.l2ApproverId} approvedAt={req.l2ApprovedAt} notes={req.l2Notes}
              status={req.status} currentStatus={req.status} />
            <ApprovalStep level={3} label="Nivel 3 — Gerencia General"
              approverId={req.l3ApproverId} approvedAt={req.l3ApprovedAt} notes={req.l3Notes}
              status={req.status} currentStatus={req.status} />
          </div>
          {req.status === 'REJECTED' && (
            <div className="mt-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-700 rounded-lg p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">Rechazada: <strong>{req.rejectionReason}</strong></p>
            </div>
          )}
        </div>

        {/* Ítems */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
          <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center">
            <h2 className="font-semibold text-surface-800 dark:text-white">Ítems Solicitados</h2>
            <span className="text-surface-500 text-sm">Total estimado: <span className="text-surface-900 dark:text-white font-bold">
              ${Number(req.totalEstimated).toLocaleString('es', { minimumFractionDigits: 2 })}
            </span></span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Descripción</th>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-left px-4 py-3">Unidad</th>
                <th className="text-right px-4 py-3">Costo Est.</th>
                <th className="text-right px-4 py-3">Total Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {req.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  <td className="px-4 py-3 text-surface-800 dark:text-white">{item.description}</td>
                  <td className="px-4 py-3 text-surface-500 text-sm">{item.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">{Number(item.quantity).toLocaleString('es')}</td>
                  <td className="px-4 py-3 text-surface-500 text-sm">{item.unit}</td>
                  <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">${Number(item.estimatedCost).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-surface-800 dark:text-white">
                    ${(Number(item.quantity) * Number(item.estimatedCost)).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formulario de cotización */}
        {showQuoteForm && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-700/40 p-6 shadow-soft">
            <h2 className="font-semibold text-surface-800 dark:text-white mb-4">Nueva Cotización de Proveedor</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Proveedor *</label>
                <select value={quoteData.supplierId} onChange={(e) => setQuoteData({ ...quoteData, supplierId: e.target.value })} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">N° Cotización Proveedor</label>
                <input value={quoteData.quoteNumber} onChange={(e) => setQuoteData({ ...quoteData, quoteNumber: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Días de entrega</label>
                <input type="number" value={quoteData.deliveryDays} onChange={(e) => setQuoteData({ ...quoteData, deliveryDays: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Condiciones de pago</label>
                <input value={quoteData.paymentTerms} onChange={(e) => setQuoteData({ ...quoteData, paymentTerms: e.target.value })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-surface-500 mb-1">Notas</label>
                <input value={quoteData.notes} onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })} className={inputCls} />
              </div>
            </div>
            <h3 className="text-sm text-surface-600 dark:text-surface-400 mb-2">Precios por ítem</h3>
            <div className="space-y-2 mb-4">
              {quoteItems.map((qi, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-surface-50 dark:bg-surface-900/50 rounded-lg p-3 border border-surface-200 dark:border-surface-700">
                  <div className="flex-1 text-sm text-surface-800 dark:text-white">{qi.description} <span className="text-surface-500">(x{qi.quantity})</span></div>
                  <div className="w-36">
                    <input type="number" min="0" step="0.01" placeholder="Precio unitario"
                      value={qi.unitPrice || ''}
                      onChange={(e) => {
                        const v = [...quoteItems];
                        v[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setQuoteItems(v);
                      }}
                      className={inputCls} />
                  </div>
                  <div className="w-24 text-right text-sm font-mono text-surface-700 dark:text-surface-300">
                    ${(qi.quantity * qi.unitPrice).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddQuote} disabled={saving}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Guardar Cotización
              </button>
              <button onClick={() => setShowQuoteForm(false)}
                className="border border-surface-200 dark:border-surface-700 px-4 py-2 rounded-lg text-sm text-surface-600 dark:text-surface-400 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Cotizaciones */}
        {(req.quotations?.length ?? 0) > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-surface-800 dark:text-white">Cotizaciones ({req.quotations.length}/3)</h2>
              {req.status === 'QUOTED' && canCompare && (
                <Link to={`/purchases/requisitions/${id}/compare`}
                  className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 text-sm">📊 Ver comparativo →</Link>
              )}
            </div>

            {/* Progreso de proveedores: mínimo configurable de cotizaciones para avanzar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-2">
                {Array.from({ length: minQuotations }).map((_, i) => {
                  const filled = i < quoteCount;
                  return (
                    <div key={i}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg border text-sm font-bold ${filled
                        ? 'bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-600 text-green-700 dark:text-green-400'
                        : 'bg-surface-50 dark:bg-surface-900/50 border-dashed border-surface-300 dark:border-surface-600 text-surface-400'}`}>
                      {filled ? '✓' : i + 1}
                    </div>
                  );
                })}
              </div>
              <p className={`text-sm ${canCompare ? 'text-green-600 dark:text-green-400' : 'text-surface-500'}`}>
                {canCompare
                  ? `${minQuotations} cotizaciones cargadas — listo para comparar`
                  : `${quoteCount}/${minQuotations} cotizaciones — ${minQuotations - quoteCount === 1 ? 'falta 1 proveedor' : `faltan ${minQuotations - quoteCount} proveedores`} para habilitar el comparativo`}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {req.quotations.map((q: any) => (
                <div key={q.id} className={`rounded-xl border p-4 ${q.isWinner
                  ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-500/5'
                  : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50'}`}>
                  {q.isWinner && <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-2">🏆 GANADOR</div>}
                  <p className="font-medium text-surface-800 dark:text-white">{q.supplier.name}</p>
                  <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">
                    ${Number(q.totalAmount).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="text-xs text-surface-500 mt-1 space-y-0.5">
                    <p>📅 Entrega: {q.deliveryDays ?? '?'} días</p>
                    <p>💳 Pago: {q.paymentTerms ?? '—'}</p>
                  </div>
                  {req.status === 'QUOTED' && !q.isWinner && (
                    <button onClick={() => handleSelectWinner(q.id)} disabled={saving || !canCompare}
                      title={canCompare ? undefined : `Necesitas ${minQuotations} cotizaciones para elegir ganador (${quoteCount}/${minQuotations})`}
                      className="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      {canCompare ? '🏆 Seleccionar Ganador' : `🔒 Faltan ${minQuotations - quoteCount}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OCs generadas */}
        {req.purchaseOrders?.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
            <h2 className="font-semibold text-surface-800 dark:text-white mb-3">Órdenes de Compra Generadas</h2>
            <div className="space-y-2">
              {req.purchaseOrders.map((po: any) => (
                <div key={po.id} className="flex justify-between items-center py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <span className="font-mono text-brand-600 dark:text-brand-400">{po.poNumber}</span>
                  <span className="text-surface-700 dark:text-surface-300">{po.supplier?.name}</span>
                  <span className="font-bold text-surface-900 dark:text-white">${Number(po.totalAmount).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
                  <Link to={`/purchases/${po.id}`} className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 text-sm">Ver OC →</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Supplier Suggestion */}
        {['APPROVED','QUOTED'].includes(req.status) && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-surface-800 dark:text-white">🤖 Sugerencia Inteligente de Proveedores</h2>
              <button onClick={loadAISuggestions} disabled={loadingAI}
                className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                {loadingAI ? '⏳ Analizando...' : aiSuggestions ? '🔄 Re-analizar' : '✨ Sugerir proveedores'}
              </button>
            </div>
            {aiSuggestions ? (
              <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                  <p className="text-surface-700 dark:text-surface-300 text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestions.aiNarrative}</p>
                </div>
                {aiSuggestions.topSuppliers?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {aiSuggestions.topSuppliers.map((s: any) => (
                      <button key={s.id}
                        onClick={() => setSelectedAiScore(selectedAiScore === s.id ? null : s.id)}
                        className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 hover:border-purple-400 dark:hover:border-purple-700 text-surface-700 dark:text-surface-300 rounded-lg transition-colors">
                        {s.name} · <span className={`font-bold ${s.totalScore >= 75 ? 'text-green-600 dark:text-green-400' : s.totalScore >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{Math.round(s.totalScore)}</span> pts
                      </button>
                    ))}
                  </div>
                )}
                {selectedAiScore && (() => {
                  const sup = aiSuggestions.topSuppliers?.find((s: any) => s.id === selectedAiScore);
                  return sup ? <div className="max-w-xs"><SupplierScoreCard score={sup} /></div> : null;
                })()}
              </div>
            ) : (
              <p className="text-surface-400 text-sm text-center py-4">
                Haz clic en "Sugerir proveedores" para que la IA analice el historial y recomiende los mejores para esta requisición.
              </p>
            )}
          </div>
        )}

        {/* Attachments */}
        {id && <AttachmentUpload entityType="requisitions" entityId={id} />}

        {/* Chatter (A2): hilo de mensajes del documento */}
        {id && <Activities entityType="REQUISITION" entityId={id} />}
        {id && <Chatter entityType="REQUISITION" entityId={id} statusLabels={STATUS_LABELS} />}
      </div>
    </div>
  );
}
