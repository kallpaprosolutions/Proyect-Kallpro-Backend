import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

export const SRI_ESTADO_LABELS: Record<string, string> = {
  NO_ENVIADA: 'No enviada al SRI',
  ENVIADA: 'Enviada (esperando recepción)',
  RECIBIDA: 'Recibida (esperando autorización)',
  AUTORIZADA: 'Autorizada por el SRI',
  DEVUELTA: 'Devuelta por el SRI',
  RECHAZADA: 'No autorizada por el SRI',
};

const SRI_ESTADO_STYLES: Record<string, string> = {
  NO_ENVIADA: 'bg-surface-100 dark:bg-surface-500/20 text-surface-600 dark:text-surface-400',
  ENVIADA: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  RECIBIDA: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  AUTORIZADA: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  DEVUELTA: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  RECHAZADA: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};

const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('es-EC') : '—');

const BY_KIND = {
  invoice: {
    getStatus: financialApi.getInvoiceSriStatus, emitToSri: financialApi.emitInvoiceToSri,
    checkAuth: financialApi.checkInvoiceSriAuthorization, downloadXml: financialApi.downloadInvoiceSriXml,
  },
  creditNote: {
    getStatus: financialApi.getCreditNoteSriStatus, emitToSri: financialApi.emitCreditNoteToSri,
    checkAuth: financialApi.checkCreditNoteSriAuthorization, downloadXml: financialApi.downloadCreditNoteSriXml,
  },
  debitNote: {
    getStatus: financialApi.getDebitNoteSriStatus, emitToSri: financialApi.emitDebitNoteToSri,
    checkAuth: financialApi.checkDebitNoteSriAuthorization, downloadXml: financialApi.downloadDebitNoteSriXml,
  },
  deliveryGuide: {
    getStatus: financialApi.getDeliveryGuideSriStatus, emitToSri: financialApi.emitDeliveryGuideToSri,
    checkAuth: financialApi.checkDeliveryGuideSriAuthorization, downloadXml: financialApi.downloadDeliveryGuideSriXml,
  },
} as const;

export type SriDocKind = 'invoice' | 'creditNote' | 'debitNote' | 'deliveryGuide';

const DOC_LABELS: Record<SriDocKind, { title: string; doc: string; docCap: string }> = {
  invoice: { title: 'Facturación electrónica SRI', doc: 'la factura', docCap: 'Factura' },
  creditNote: { title: 'Facturación electrónica SRI (Nota de Crédito)', doc: 'la nota de crédito', docCap: 'Nota de crédito' },
  debitNote: { title: 'Facturación electrónica SRI (Nota de Débito)', doc: 'la nota de débito', docCap: 'Nota de débito' },
  deliveryGuide: { title: 'Facturación electrónica SRI (Guía de Remisión)', doc: 'la guía de remisión', docCap: 'Guía de remisión' },
};

/**
 * Panel de emisión electrónica de un comprobante de venta (factura o nota de crédito): estado
 * ante el SRI, clave de acceso, autorización, mensajes de error y bitácora de transmisiones.
 * Una factura solo puede emitirse si nació de un pedido de venta; una NC solo si su factura
 * sustento ya está AUTORIZADA (el backend valida ambas cosas, este panel solo refleja el motivo).
 */
export default function SriEmissionPanel({ docId, kind = 'invoice', onChanged }: { docId: string; kind?: SriDocKind; onChanged?: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [pointId, setPointId] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const labels = DOC_LABELS[kind];

  const { getStatus, emitToSri, checkAuth, downloadXml } = BY_KIND[kind];

  const load = () => {
    getStatus(docId).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  };
  useEffect(() => {
    load();
    financialApi.getFiscalConfig().then((r) => {
      setConfig(r.data);
      const firstPoint = r.data?.establishments?.flatMap((e: any) => e.emissionPoints.filter((p: any) => p.active).map((p: any) => ({ ...p, establishmentId: e.id })))?.[0];
      if (firstPoint) setPointId(firstPoint.id);
    }).catch(() => setConfig(null));
  }, [docId]);

  if (!status || (kind === 'invoice' && status.type !== 'SALES')) return null;
  const canEmitAtAll = kind === 'invoice' ? !!status.salesOrderId : true;

  const points: any[] = (config?.establishments ?? []).filter((e: any) => e.active).flatMap((e: any) =>
    e.emissionPoints.filter((p: any) => p.active).map((p: any) => ({ id: p.id, establishmentId: e.id, label: `${e.code}-${p.code} · ${e.name}${p.name ? ` / ${p.name}` : ''}` })),
  );
  const canEmit = ['NO_ENVIADA', 'DEVUELTA', 'RECHAZADA'].includes(status.sriEstado);
  const canCheck = ['ENVIADA', 'RECIBIDA'].includes(status.sriEstado);
  const mensajes: any[] = Array.isArray(status.sriMensajes) ? status.sriMensajes : [];

  const emit = async () => {
    const point = points.find((p) => p.id === pointId);
    if (!point) { toast.error('Selecciona un punto de emisión', 'Falta el punto de emisión'); return; }
    const isProd = config?.ambiente === 'PRODUCCION';
    const ok = await confirm({
      title: isProd ? 'Emitir al SRI en PRODUCCIÓN' : 'Emitir al SRI (ambiente de pruebas)',
      message: isProd
        ? `Se firmará y enviará ${labels.doc} al SRI real con validez tributaria. Una vez autorizada no se puede modificar. ¿Continuar?`
        : `Se firmará y enviará ${labels.doc} al ambiente de certificación del SRI (sin validez tributaria). ¿Continuar?`,
      confirmLabel: 'Emitir', variant: isProd ? 'danger' : 'default',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await emitToSri(docId, point.establishmentId, point.id);
      const estado = r.data.sriEstado as string;
      if (estado === 'AUTORIZADA') toast.success(`Autorización ${r.data.numeroAutorizacion}`, `✓ ${labels.docCap} autorizada por el SRI`);
      else if (estado === 'RECIBIDA') toast.info('El SRI recibió el comprobante; consulta la autorización en unos segundos', 'Recibida');
      else toast.error(r.data.mensajes?.[0]?.mensaje || SRI_ESTADO_LABELS[estado], SRI_ESTADO_LABELS[estado]);
      load(); onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || `No se pudo emitir ${labels.doc}`, 'Error');
      load();
    } finally { setBusy(false); }
  };

  const check = async () => {
    setBusy(true);
    try {
      const r = await checkAuth(docId);
      if (r.data.sriEstado === 'AUTORIZADA') toast.success(`Autorización ${r.data.numeroAutorizacion}`, `✓ ${labels.docCap} autorizada por el SRI`);
      else toast.error(r.data.mensajes?.[0]?.mensaje || SRI_ESTADO_LABELS[r.data.sriEstado], SRI_ESTADO_LABELS[r.data.sriEstado]);
      load(); onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo consultar la autorización', 'Error');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-white">{labels.title}</h2>
          {config && (
            <p className="text-xs text-surface-500">
              Ambiente: <span className={config.ambiente === 'PRODUCCION' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-blue-600 dark:text-blue-400 font-semibold'}>{config.ambiente === 'PRODUCCION' ? 'Producción' : 'Pruebas'}</span>
              {status.sriAmbiente && status.sriAmbiente !== config.ambiente && ` · emitida en ${status.sriAmbiente === 'PRODUCCION' ? 'Producción' : 'Pruebas'}`}
            </p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${SRI_ESTADO_STYLES[status.sriEstado] ?? ''}`}>
          {SRI_ESTADO_LABELS[status.sriEstado] ?? status.sriEstado}
        </span>
      </div>

      {!canEmitAtAll && (
        <p className="text-sm text-surface-500">Esta factura no proviene de un pedido de venta (sin cliente ni IVA por línea) — no puede emitirse electrónicamente.</p>
      )}

      {!config && canEmitAtAll && (
        <p className="text-sm text-amber-700 dark:text-amber-400">Configura primero los datos fiscales, un punto de emisión y el certificado en Contabilidad → Facturación Electrónica.</p>
      )}

      {status.claveAcceso && (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div><dt className="text-xs text-surface-500">Número SRI</dt><dd className="font-mono text-surface-900 dark:text-white">{status.establishment?.code}-{status.emissionPoint?.code}-{status.sriSecuencial}</dd></div>
          <div><dt className="text-xs text-surface-500">Último intento</dt><dd className="text-surface-700 dark:text-surface-300">{fmtDateTime(status.sriUltimoIntento)}</dd></div>
          <div className="md:col-span-2"><dt className="text-xs text-surface-500">Clave de acceso</dt><dd className="font-mono text-xs break-all text-surface-900 dark:text-white">{status.claveAcceso}</dd></div>
          {status.numeroAutorizacion && (
            <>
              <div className="md:col-span-2"><dt className="text-xs text-surface-500">Número de autorización</dt><dd className="font-mono text-xs break-all text-green-700 dark:text-green-400">{status.numeroAutorizacion}</dd></div>
              <div><dt className="text-xs text-surface-500">Fecha de autorización</dt><dd className="text-surface-700 dark:text-surface-300">{fmtDateTime(status.fechaAutorizacion)}</dd></div>
            </>
          )}
        </dl>
      )}

      {mensajes.length > 0 && status.sriEstado !== 'AUTORIZADA' && (
        <ul className="text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 space-y-1">
          {mensajes.map((m, i) => (
            <li key={i} className="text-red-700 dark:text-red-400">
              <span className="font-mono text-xs mr-1">[{m.identificador}]</span>{m.mensaje}
              {m.informacionAdicional && <span className="block text-xs text-red-600/80 dark:text-red-400/80 ml-8">{m.informacionAdicional}</span>}
            </li>
          ))}
        </ul>
      )}

      {config && canEmitAtAll && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {canEmit && (
            <>
              <select value={pointId} onChange={(e) => setPointId(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white">
                {points.length === 0 && <option value="">Sin puntos de emisión activos</option>}
                {points.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <button onClick={emit} disabled={busy || points.length === 0}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
                {busy ? 'Enviando al SRI…' : status.sriEstado === 'NO_ENVIADA' ? '📡 Emitir al SRI' : '🔁 Re-emitir al SRI'}
              </button>
            </>
          )}
          {canCheck && (
            <button onClick={check} disabled={busy}
              className="border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm font-medium">
              {busy ? 'Consultando…' : '🔎 Consultar autorización'}
            </button>
          )}
          {status.claveAcceso && (
            <button onClick={() => downloadXml(docId, `${status.claveAcceso}.xml`).catch(() => toast.error('No se pudo descargar el XML', 'Error'))}
              className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 px-4 py-1.5 rounded-lg text-sm">
              ⬇ XML
            </button>
          )}
          {status.transmissions?.length > 0 && (
            <button onClick={() => setShowLog((v) => !v)} className="ml-auto text-xs text-surface-500 hover:underline">
              {showLog ? 'Ocultar bitácora' : `Bitácora (${status.transmissions.length})`}
            </button>
          )}
        </div>
      )}

      {showLog && status.transmissions?.length > 0 && (
        <table className="w-full text-xs mt-1">
          <thead><tr className="text-surface-500 uppercase"><th className="text-left py-1">Fecha</th><th className="text-left">Operación</th><th className="text-left">Resultado</th><th className="text-left">Mensajes</th></tr></thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {status.transmissions.map((t: any) => (
              <tr key={t.id}>
                <td className="py-1 text-surface-600 dark:text-surface-400 whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                <td className="text-surface-700 dark:text-surface-300">{t.operacion === 'RECEPCION' ? 'Recepción' : 'Autorización'}</td>
                <td className="font-medium text-surface-900 dark:text-white">{t.resultado}</td>
                <td className="text-surface-600 dark:text-surface-400">{(Array.isArray(t.mensajes) ? t.mensajes : []).map((m: any) => `[${m.identificador}] ${m.mensaje}`).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
