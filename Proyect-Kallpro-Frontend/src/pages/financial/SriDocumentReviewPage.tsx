import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { sriApi } from '../../api/sriDocuments';
import { procurementApi } from '../../api/procurement';
import { purchasesApi } from '../../api/purchases';
import { useConfirm } from '../../hooks/useConfirm';

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  CONFIRMED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente de revisión',
  CONFIRMED: 'Confirmado — Inventario actualizado',
  REJECTED: 'Rechazado',
};

const TIPO_ITEM_OPTIONS = [
  { value: 'PRODUCTO', label: 'Producto (afecta inventario)' },
  { value: 'SERVICIO', label: 'Servicio (gasto directo)' },
];

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Checklist de validación automática — determinístico, sobre datos reales del documento (sin
 * score de confianza inventado). Cada ítem se apoya en un campo que ya existe: no fabrica
 * información que el sistema no tiene (p.ej. no hay "centro de costo" para compras directas).
 */
function computeChecklist(doc: any, possibleDuplicates: any[], journalPreview: any, previewLoading: boolean) {
  const mathTotal = round2(
    Number(doc.subtotal0) + Number(doc.subtotal8) + Number(doc.subtotal12) + Number(doc.subtotal15) +
    Number(doc.subtotalNoObj) + Number(doc.subtotalExento) - Number(doc.totalDescuento) +
    Number(doc.ice) + Number(doc.iva) + Number(doc.irbpnr) + Number(doc.propina),
  );
  const mathOk = Math.abs(mathTotal - Number(doc.total)) <= 0.02;

  return [
    {
      ok: !!doc.claveAcceso, label: 'Documento válido',
      detail: doc.claveAcceso?.startsWith('MANUAL-') ? 'Cargado manualmente (sin XML/clave de acceso)' : 'Clave de acceso SRI presente',
    },
    {
      ok: !!doc.supplierId, label: 'Proveedor identificado',
      detail: doc.supplierId ? (doc.supplier?.razonSocial || doc.supplier?.name) : 'Sin vincular — asígnalo en "Detalles del documento"',
    },
    { ok: !!doc.rucEmisor, label: 'RUC identificado', detail: doc.rucEmisor || 'No detectado' },
    {
      ok: possibleDuplicates.length === 0, label: 'Sin duplicado detectado',
      detail: possibleDuplicates.length > 0 ? `${possibleDuplicates.length} posible${possibleDuplicates.length === 1 ? '' : 's'} — revisa el aviso arriba` : 'No se encontraron coincidencias por proveedor+número o monto+fecha',
    },
    {
      ok: mathOk, label: 'Valores matemáticamente correctos',
      detail: mathOk ? `Subtotales + impuestos cuadran con el total (${money(doc.total)})` : `Los componentes suman ${money(mathTotal)} pero el total es ${money(doc.total)}`,
    },
    { ok: true, label: 'Impuestos identificados', detail: `IVA: ${money(doc.iva)}${Number(doc.ice) > 0 ? ` · ICE: ${money(doc.ice)}` : ''}` },
    { ok: !!doc.formaPago, label: 'Forma de pago identificada', detail: doc.formaPago || 'No especificada en el documento' },
    {
      ok: !!doc.supplier?.paymentTerms, label: 'Plazo de pago identificado',
      detail: doc.supplier?.paymentTerms ? `${doc.supplier.paymentTerms} (configurado en el proveedor)` : 'Sin plazo configurado en el proveedor — se aplicará el plazo por defecto',
    },
    {
      ok: doc.purchaseOrderId ? true : (previewLoading ? null : !!journalPreview),
      label: 'Cuenta contable sugerida',
      detail: doc.purchaseOrderId
        ? 'Ya se registró en la recepción de la orden de compra vinculada'
        : previewLoading ? 'Calculando…'
        : journalPreview ? journalPreview.lines.filter((l: any) => l.debit > 0).map((l: any) => l.accountName).join(' + ')
        : 'No aplica para este tipo de documento (ej. nota de crédito)',
    },
  ];
}

export default function SriDocumentReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const possibleDuplicates: any[] = (location.state as any)?.possibleDuplicates ?? [];
  const confirmAction = useConfirm();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [deleting, setDeleting]     = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Vinculación manual de OC
  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [linkPoId, setLinkPoId] = useState('');
  const [linking, setLinking] = useState(false);

  // Items editables (tipo + producto asignado)
  const [items, setItems] = useState<any[]>([]);

  // Asiento sugerido (checklist + contabilización propuesta)
  const [journalPreview, setJournalPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const runMatch = async () => {
    setLoadingMatch(true);
    try {
      const res = await procurementApi.validateThreeWayMatch(id!);
      setMatchResult(res.data);
    } catch (e: any) {
      setMatchResult({ status: 'ERROR', message: e.response?.data?.error || 'Error al validar' });
    }
    setLoadingMatch(false);
  };

  const load = () =>
    sriApi.get(id!).then((r) => {
      setDoc(r.data);
      setItems(r.data.items.map((it: any) => ({
        id: it.id,
        tipoItem: it.tipoItem,
        productId: it.productId ?? null,
      })));
      // Conciliación automática si hay OC vinculada y sigue pendiente
      if (r.data.purchaseOrderId && r.data.status === 'PENDING_REVIEW') runMatch();
    });

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!id || !doc || doc.status !== 'PENDING_REVIEW') return;
    setPreviewLoading(true);
    sriApi.journalPreview(id).then((r) => setJournalPreview(r.data)).catch(() => setJournalPreview(null)).finally(() => setPreviewLoading(false));
  }, [id, doc?.status, doc?.purchaseOrderId, doc?.total, doc?.iva]);

  // Cargar OCs abiertas del proveedor para vinculación manual
  useEffect(() => {
    if (doc && !doc.purchaseOrderId && doc.supplierId && doc.status === 'PENDING_REVIEW') {
      purchasesApi.getOrders().then((r) => {
        setOpenPOs((r.data || []).filter((o: any) =>
          o.supplierId === doc.supplierId && ['APPROVED', 'PARTIAL', 'RECEIVED'].includes(o.status)));
      }).catch(() => {});
    }
  }, [doc]);

  const handleLinkPO = async () => {
    if (!linkPoId) return;
    setLinking(true);
    try {
      await sriApi.update(id!, { purchaseOrderId: linkPoId });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al vincular OC');
    } finally {
      setLinking(false);
    }
  };

  const hasDiscrepancy = matchResult?.status === 'DISCREPANCY';

  const handleConfirm = async () => {
    if (hasDiscrepancy && (!override || !overrideReason.trim())) {
      setError('Hay discrepancias en la conciliación. Marca el override e indica un motivo para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Primero guardar cambios en ítems
      await sriApi.update(id!, { items });
      // Luego confirmar (con override si aplica)
      const res = await sriApi.confirm(id!, hasDiscrepancy ? { override: true, overrideReason } : undefined);
      setSuccess('Documento confirmado. ' + (res.data.inventoryResults?.join(' | ') ?? ''));
      load();
    } catch (e: any) {
      if (e.response?.status === 409 && e.response.data?.matchResult) {
        setMatchResult(e.response.data.matchResult);
        setError(e.response.data.error || 'Discrepancia en conciliación 3 vías.');
      } else {
        setError(e.response?.data?.error || 'Error al confirmar');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirmAction({ title: 'Eliminar documento', message: '¿Eliminar este documento permanentemente? No se puede deshacer.', variant: 'danger' })) return;
    setDeleting(true);
    try {
      await sriApi.delete(id!);
      navigate('/sri');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al eliminar');
      setDeleting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectMotivo.trim()) { setError('Ingresa un motivo de rechazo'); return; }
    setLoading(true);
    setError('');
    try {
      await sriApi.reject(id!, rejectMotivo);
      navigate('/sri');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (itemId: string, field: string, value: any) => {
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, [field]: value } : it));
  };

  if (!doc) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  const warnings: string[] = doc.parseWarnings ? JSON.parse(doc.parseWarnings) : [];
  const isPending = doc.status === 'PENDING_REVIEW';
  const productsToLoad = items.filter((it) => it.tipoItem === 'PRODUCTO' && it.productId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📑</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{doc.numeroDoc || doc.claveAcceso?.slice(0, 16) + '...'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
                {STATUS_LABELS[doc.status]}
              </span>
              <span className="text-surface-500 text-xs">{doc.fileType}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {doc.status !== 'CONFIRMED' && (
            <button
              onClick={handleDelete}
              disabled={deleting || loading}
              className="border border-surface-200 dark:border-surface-700 text-surface-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 disabled:opacity-40 px-3 py-2 rounded-lg text-sm transition-colors"
              title="Eliminar documento"
            >
              {deleting ? '...' : '🗑 Eliminar'}
            </button>
          )}
          {isPending && (
            <>
              <button
                onClick={() => setShowReject(!showReject)}
                disabled={loading}
                className="border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || (hasDiscrepancy && (!override || !overrideReason.trim()))}
                className="bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Procesando...' : '✓ Confirmar'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Rechazo */}
        {showReject && isPending && (
          <div className="bg-white dark:bg-surface-800 border border-red-300 dark:border-red-800 rounded-xl shadow-soft p-4 space-y-3">
            <h3 className="text-red-600 dark:text-red-400 font-semibold text-sm">Motivo de rechazo</h3>
            <input
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Ej: Factura duplicada, datos incorrectos..."
            />
            <button
              onClick={handleReject}
              disabled={loading}
              className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Confirmar rechazo
            </button>
          </div>
        )}

        {/* Posible factura duplicada (B1): mismo proveedor + monto similar + fecha cercana */}
        {isPending && possibleDuplicates.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl p-4">
            <p className="text-orange-700 dark:text-orange-400 text-sm font-semibold mb-2">
              ⚠ Posible factura duplicada — revisa antes de confirmar
            </p>
            <ul className="text-orange-700 dark:text-orange-300 text-xs space-y-1.5">
              {possibleDuplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>{d.reason}: doc. <strong>{d.numeroDoc || d.id}</strong> por ${Number(d.total).toFixed(2)} ({d.fechaEmision ? new Date(d.fechaEmision).toLocaleDateString('es') : 'sin fecha'})</span>
                  <Link to={`/sri/${d.id}`} className="text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap">Ver →</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Checklist de validación automática + asiento sugerido — el "centro de trabajo" de la factura */}
        {isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
              <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-3">✅ Validación automática</h3>
              <ul className="space-y-2">
                {computeChecklist(doc, possibleDuplicates, journalPreview, previewLoading).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 mt-0.5">{c.ok === null ? '⏳' : c.ok ? '✓' : '⚠'}</span>
                    <div className="min-w-0">
                      <p className={c.ok === false ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-surface-700 dark:text-surface-300 font-medium'}>{c.label}</p>
                      <p className="text-xs text-surface-500 truncate">{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
              <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-1">📒 Contabilización sugerida</h3>
              {doc.purchaseOrderId ? (
                <p className="text-xs text-surface-500 mt-2">El pasivo con el proveedor ya se registró en la recepción de la orden de compra vinculada. Al confirmar solo se ajustan retenciones (si aplica).</p>
              ) : previewLoading ? (
                <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
              ) : !journalPreview ? (
                <p className="text-xs text-surface-500 mt-2">Este tipo de documento aún no genera contabilización automática sugerida.</p>
              ) : (
                <>
                  <p className="text-xs text-surface-500 mb-3">Se registrará al confirmar el documento.</p>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {journalPreview.lines.map((l: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 text-surface-700 dark:text-surface-300">{l.accountCode} — {l.accountName}</td>
                          <td className="py-1.5 text-right font-mono">{l.debit > 0 ? money(l.debit) : ''}</td>
                          <td className="py-1.5 text-right font-mono text-surface-500">{l.credit > 0 ? money(l.credit) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}

        {/* Advertencias de parseo */}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-600 dark:text-yellow-400 text-sm font-semibold mb-2">
              ⚠ Advertencias del parseo (confianza: {doc.parseConfidence}%)
            </p>
            <ul className="text-yellow-700 dark:text-yellow-300 text-xs space-y-1">
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>
        )}

        {/* Match con OC */}
        {doc.purchaseOrder && (
          <div className={`rounded-xl p-4 border ${
            isPending ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-700' : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700'
          } shadow-soft`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-brand-600 dark:text-brand-400 text-sm font-semibold">OC Vinculada</p>
              <Link to={`/purchases/${doc.purchaseOrder.id}`} className="text-xs text-brand-500 hover:underline">Ver orden →</Link>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-surface-700 dark:text-surface-300">
                <span className="text-surface-500">N°:</span> {doc.purchaseOrder.poNumber}
              </span>
              <span className="text-surface-700 dark:text-surface-300">
                <span className="text-surface-500">Total OC:</span> ${Number(doc.purchaseOrder.totalAmount).toFixed(2)}
              </span>
              <span className="text-surface-700 dark:text-surface-300">
                <span className="text-surface-500">Estado:</span> {doc.purchaseOrder.status}
              </span>
            </div>
          </div>
        )}

        {/* Vinculación manual de OC (cuando no se vinculó automáticamente) */}
        {isPending && !doc.purchaseOrderId && (
          <div className="rounded-xl p-4 border bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-700 shadow-soft">
            <p className="text-yellow-700 dark:text-yellow-400 text-sm font-semibold mb-2">Sin OC vinculada</p>
            {openPOs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <select value={linkPoId} onChange={(e) => setLinkPoId(e.target.value)}
                  className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Selecciona una OC abierta del proveedor...</option>
                  {openPOs.map((o) => (
                    <option key={o.id} value={o.id}>{o.poNumber} — ${Number(o.totalAmount).toFixed(2)} ({o.status})</option>
                  ))}
                </select>
                <button onClick={handleLinkPO} disabled={!linkPoId || linking}
                  className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  {linking ? 'Vinculando...' : 'Vincular OC'}
                </button>
              </div>
            ) : (
              <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                No hay OCs abiertas de este proveedor para vincular. Puedes confirmar como factura directa (cargará inventario).
              </p>
            )}
          </div>
        )}

        {/* Cabecera del documento */}
        <div className="grid grid-cols-2 gap-4">
          {/* Emisor */}
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 space-y-3">
            <h2 className="font-semibold text-sm text-surface-500 uppercase tracking-wide">Emisor</h2>
            <div>
              <p className="text-surface-900 dark:text-white font-medium">{doc.razonSocialEmisor}</p>
              {doc.nombreComercial && <p className="text-surface-500 text-sm">{doc.nombreComercial}</p>}
              <p className="text-brand-600 dark:text-brand-400 font-mono text-sm mt-1">RUC: {doc.rucEmisor}</p>
              {doc.contribuyenteEspecial && (
                <p className="text-xs text-surface-400 mt-1">Contribuyente Especial #{doc.contribuyenteEspecial}</p>
              )}
              {doc.obligadoContabilidad && (
                <p className="text-xs text-surface-400">Obligado a llevar contabilidad</p>
              )}
            </div>
            {doc.supplier ? (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2">
                <p className="text-green-600 dark:text-green-400 text-xs font-semibold">✓ Proveedor en ERP</p>
                <p className="text-green-700 dark:text-green-300 text-sm">{doc.supplier.name}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-700 rounded-lg px-3 py-2">
                <p className="text-yellow-600 dark:text-yellow-400 text-xs font-semibold">⚠ Proveedor no encontrado en ERP</p>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs">Agrega RUC {doc.rucEmisor} al proveedor correspondiente</p>
              </div>
            )}
          </div>

          {/* Receptor + datos del comprobante */}
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 space-y-3">
            <h2 className="font-semibold text-sm text-surface-500 uppercase tracking-wide">Comprobante</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">N° Autorización</span>
                <span className="text-surface-900 dark:text-white font-mono text-xs">{doc.numeroDoc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Tipo</span>
                <span className="text-surface-900 dark:text-white">{doc.tipoDocumento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Fecha emisión</span>
                <span className="text-surface-900 dark:text-white">{new Date(doc.fechaEmision).toLocaleDateString('es')}</span>
              </div>
              {doc.fechaAutorizacion && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Fecha autorización</span>
                  <span className="text-surface-900 dark:text-white">{new Date(doc.fechaAutorizacion).toLocaleString('es')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-surface-500">Ambiente</span>
                <span className={doc.ambiente === 'PRODUCCION' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                  {doc.ambiente}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
              <p className="text-surface-400 text-xs mb-1">Receptor</p>
              <p className="text-surface-900 dark:text-white text-sm">{doc.razonSocialComprador}</p>
              <p className="text-surface-500 text-xs font-mono">{doc.idComprador}</p>
            </div>
          </div>
        </div>

        {/* Documento sustento (modificado): solo en NC/ND recibidas del proveedor.
            Viene directo del XML del SRI (codDocModificado/numDocModificado/fechaEmisionDocSustento). */}
        {(doc.tipoDocumento === 'NOTA_CREDITO' || doc.tipoDocumento === 'NOTA_DEBITO') && (
          <div className="bg-surface-50 dark:bg-surface-900/40 border border-surface-200 dark:border-surface-700 rounded-xl p-4">
            <h2 className="font-semibold text-xs text-surface-500 uppercase tracking-wide mb-2">
              Documento Sustento (Modificado)
            </h2>
            {doc.docModificadoNumero ? (
              <p className="text-sm text-surface-900 dark:text-white">
                Tipo: <span className="font-medium">{doc.docModificadoTipo ?? '—'}</span>
                <span className="mx-2 text-surface-300">·</span>
                Nº: <span className="font-mono">{doc.docModificadoNumero}</span>
                <span className="mx-2 text-surface-300">·</span>
                Fecha de emisión:{' '}
                <span className="font-medium">
                  {doc.docModificadoFecha ? new Date(doc.docModificadoFecha).toLocaleDateString('es') : '—'}
                </span>
              </p>
            ) : (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠ El XML no traía el documento sustento (codDocModificado/numDocModificado) — revisa el comprobante manualmente.
              </p>
            )}
          </div>
        )}

        {/* Totales tributarios */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5">
          <h2 className="font-semibold text-surface-900 dark:text-white mb-4">Resumen Tributario</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Number(doc.subtotal15) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">Base Imponible 15%</p>
                <p className="text-surface-900 dark:text-white font-mono font-medium">${Number(doc.subtotal15).toFixed(2)}</p>
              </div>
            )}
            {Number(doc.subtotal12) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">Base Imponible 12%</p>
                <p className="text-surface-900 dark:text-white font-mono font-medium">${Number(doc.subtotal12).toFixed(2)}</p>
              </div>
            )}
            {Number(doc.subtotal8) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">Base Imponible 8%</p>
                <p className="text-surface-900 dark:text-white font-mono font-medium">${Number(doc.subtotal8).toFixed(2)}</p>
              </div>
            )}
            {Number(doc.subtotal0) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">Base Imponible 0%</p>
                <p className="text-surface-900 dark:text-white font-mono font-medium">${Number(doc.subtotal0).toFixed(2)}</p>
              </div>
            )}
            {Number(doc.subtotalNoObj) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">No Objeto IVA</p>
                <p className="text-surface-900 dark:text-white font-mono font-medium">${Number(doc.subtotalNoObj).toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-surface-500 text-xs">IVA</p>
              <p className="text-purple-600 dark:text-purple-400 font-mono font-medium">${Number(doc.iva).toFixed(2)}</p>
            </div>
            {Number(doc.totalDescuento) > 0 && (
              <div>
                <p className="text-surface-500 text-xs">Total Descuento</p>
                <p className="text-yellow-600 dark:text-yellow-400 font-mono font-medium">-${Number(doc.totalDescuento).toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-surface-500 text-xs font-semibold">TOTAL</p>
              <p className="text-surface-900 dark:text-white font-mono text-lg font-bold">${Number(doc.total).toFixed(2)}</p>
            </div>
          </div>
          {doc.formaPago && (
            <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 text-xs text-surface-500">
              Forma de pago: {doc.formaPago} — ${Number(doc.valorFormaPago ?? doc.total).toFixed(2)}
            </div>
          )}
        </div>

        {/* Ítems */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center">
            <h2 className="font-semibold text-surface-900 dark:text-white">Detalle de ítems</h2>
            {isPending && (
              <p className="text-xs text-surface-500">
                Asigna tipo y producto ERP a cada ítem para actualizar inventario
              </p>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Descripción</th>
                <th className="text-right px-4 py-3">Cant.</th>
                <th className="text-right px-4 py-3">P. Unit.</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">IVA %</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Producto ERP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {doc.items.map((item: any) => {
                const editItem = items.find((it) => it.id === item.id) ?? item;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs text-surface-500">{item.codPrincipal}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-900 dark:text-white">{item.descripcion}</p>
                      {item.detAdicional && (
                        <p className="text-surface-500 text-xs">{item.detAdicional}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">{Number(item.cantidad)}</td>
                    <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">${Number(item.precioUnitario).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-surface-900 dark:text-white">${Number(item.precioTotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.codigoTarifa === '0' ? 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                        : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                      }`}>
                        {item.tarifaIva}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isPending ? (
                        <select
                          value={editItem.tipoItem}
                          onChange={(e) => updateItem(item.id, 'tipoItem', e.target.value)}
                          className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {TIPO_ITEM_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.tipoItem === 'PRODUCTO'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                            : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                        }`}>
                          {item.tipoItem}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editItem.tipoItem === 'PRODUCTO' ? (
                        item.product ? (
                          <span className="text-green-600 dark:text-green-400 text-xs">✓ {item.product.name}</span>
                        ) : (
                          <span className="text-yellow-600 dark:text-yellow-400 text-xs">Sin asignar</span>
                        )
                      ) : (
                        <span className="text-surface-400 text-xs">N/A — Servicio</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Resumen de qué se cargará al inventario */}
        {isPending && productsToLoad.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold mb-2">
              Al confirmar se cargarán al inventario:
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              {productsToLoad.length} producto(s) con producto ERP asignado.
              Los servicios se registrarán como gasto directo.
            </p>
          </div>
        )}

        {isPending && productsToLoad.length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-sm text-yellow-700 dark:text-yellow-300">
            ⚠ Ningún ítem tiene tipo PRODUTO con producto ERP asignado.
            El inventario no se actualizará, pero el documento quedará registrado.
          </div>
        )}

        {/* 3-Way Match (visible only if PO linked) */}
        {doc.purchaseOrderId && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-surface-900 dark:text-white">🔍 Verificación 3 Vías</h2>
              <button
                onClick={runMatch}
                disabled={loadingMatch}
                className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {loadingMatch ? '⏳ Validando...' : '🔄 Revalidar Match'}
              </button>
            </div>
            {matchResult ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
                  matchResult.status === 'MATCHED' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' :
                  matchResult.status === 'DISCREPANCY' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' :
                  'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
                }`}>
                  {matchResult.message}
                </div>
                {matchResult.poNumber && (
                  <p className="text-xs text-surface-500">
                    OC: <span className="font-mono text-brand-600 dark:text-brand-400">{matchResult.poNumber}</span>
                    {' · '}OC Total: <span className="text-surface-900 dark:text-white">${Number(matchResult.poTotal).toFixed(2)}</span>
                    {' · '}SRI Total: <span className="text-surface-900 dark:text-white">${Number(matchResult.sriTotal).toFixed(2)}</span>
                    {' · '}Variación: <span className={matchResult.amountMatch ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {matchResult.amountVariancePct?.toFixed(2)}%
                    </span>
                  </p>
                )}
                {matchResult.details?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-surface-500 border-b border-surface-100 dark:border-surface-700">
                          <th className="text-left py-2 pr-4">Línea</th>
                          <th className="text-left py-2 pr-4">Descripción</th>
                          <th className="text-right py-2 pr-3">OC Qty</th>
                          <th className="text-right py-2 pr-3">SRI Qty</th>
                          <th className="text-right py-2 pr-3">OC Precio</th>
                          <th className="text-right py-2 pr-3">SRI Precio</th>
                          <th className="text-center py-2">Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                        {matchResult.details.map((d: any) => (
                          <tr key={d.line}>
                            <td className="py-1.5 pr-4 text-surface-500">{d.line}</td>
                            <td className="py-1.5 pr-4 text-surface-700 dark:text-surface-300 truncate max-w-32">{d.description}</td>
                            <td className="py-1.5 pr-3 text-right text-surface-700 dark:text-surface-300">{d.poQty}</td>
                            <td className={`py-1.5 pr-3 text-right ${d.qtyMatch ? 'text-surface-700 dark:text-surface-300' : 'text-red-600 dark:text-red-400 font-bold'}`}>{d.sriQty}</td>
                            <td className="py-1.5 pr-3 text-right text-surface-700 dark:text-surface-300">${d.poPrice?.toFixed(2)}</td>
                            <td className={`py-1.5 pr-3 text-right ${d.priceMatch ? 'text-surface-700 dark:text-surface-300' : 'text-red-600 dark:text-red-400 font-bold'}`}>${d.sriPrice?.toFixed(2)}</td>
                            <td className="py-1.5 text-center">
                              {d.qtyMatch && d.priceMatch
                                ? <span className="text-green-600 dark:text-green-400">✓</span>
                                : <span className="text-red-600 dark:text-red-400">✗ {d.priceVariancePct?.toFixed(1)}%</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {hasDiscrepancy && isPending && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 font-medium cursor-pointer">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                      Confirmar de todos modos (override de la discrepancia)
                    </label>
                    {override && (
                      <input
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Motivo del override (obligatorio)"
                        className="w-full bg-white dark:bg-surface-900 border border-red-200 dark:border-red-800 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-surface-400 text-sm text-center py-3">
                Este documento tiene una OC vinculada ({doc.purchaseOrderId.slice(0, 8)}...).
                Haz clic en "Revalidar Match" para comparar cantidades y precios.
              </p>
            )}
          </div>
        )}

        {/* Clave de acceso */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-4">
          <p className="text-surface-400 text-xs mb-1">Clave de Acceso SRI (49 dígitos)</p>
          <p className="font-mono text-xs text-surface-500 break-all">{doc.claveAcceso}</p>
        </div>
      </div>
    </div>
  );
}
