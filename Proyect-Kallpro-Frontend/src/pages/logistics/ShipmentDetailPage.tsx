import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { logisticsApi, SHIPMENT_STATUS_META } from '../../api/logistics';
import { reportsApi } from '../../api/reports';
import TrackingTimeline from '../../components/logistics/TrackingTimeline';
import BackButton from '../../components/ui/BackButton';
import { useToast } from '../../components/ui/Toast';
import SriEmissionPanel from '../../components/financial/SriEmissionPanel';

/** Detalle de envío: guía grande + timeline courier + registrar evento + orden vinculada. */
export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: '', location: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // ── Guías de Remisión electrónicas (Etapa 4 del plan SRI, resto) ──
  const [guides, setGuides] = useState<any[]>([]);
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);
  const [grOpen, setGrOpen] = useState(false);
  const [grBusy, setGrBusy] = useState(false);
  const [grError, setGrError] = useState('');
  const [grForm, setGrForm] = useState({
    motivoTraslado: 'Venta', dirPartida: '', fechaIniTransporte: '', fechaFinTransporte: '',
    transportistaRazonSocial: '', transportistaTipoIdentificacion: 'RUC' as 'RUC' | 'CEDULA' | 'PASAPORTE',
    transportistaIdentificacion: '', placa: '',
  });

  const load = () => {
    if (!id) return;
    logisticsApi.getOne(id)
      .then((r) => { setS(r.data); setForm((f) => ({ ...f, status: r.data.nextStatuses[0] ?? '' })); })
      .catch(() => setS(null))
      .finally(() => setLoading(false));
  };
  const loadGuides = () => { if (id) logisticsApi.getDeliveryGuides(id).then((r) => setGuides(r.data)).catch(() => {}); };
  useEffect(() => { load(); loadGuides(); }, [id]);

  function openGR() {
    setGrError('');
    const today = new Date().toISOString().slice(0, 10);
    setGrForm({
      motivoTraslado: 'Venta', dirPartida: s?.order?.address || '', fechaIniTransporte: today, fechaFinTransporte: today,
      transportistaRazonSocial: '', transportistaTipoIdentificacion: 'RUC', transportistaIdentificacion: '', placa: '',
    });
    setGrOpen(true);
  }

  async function submitGR() {
    if (!grForm.dirPartida.trim()) { setGrError('Indica la dirección de partida'); return; }
    if (!grForm.transportistaRazonSocial.trim() || !grForm.transportistaIdentificacion.trim() || !grForm.placa.trim()) {
      setGrError('Completa los datos del transportista (razón social, identificación y placa)'); return;
    }
    setGrBusy(true);
    setGrError('');
    try {
      await logisticsApi.createDeliveryGuide(id!, {
        motivoTraslado: grForm.motivoTraslado.trim(),
        dirPartida: grForm.dirPartida.trim(),
        fechaIniTransporte: grForm.fechaIniTransporte,
        fechaFinTransporte: grForm.fechaFinTransporte,
        transportista: {
          razonSocial: grForm.transportistaRazonSocial.trim(),
          tipoIdentificacion: grForm.transportistaTipoIdentificacion,
          identificacion: grForm.transportistaIdentificacion.trim(),
          placa: grForm.placa.trim(),
        },
      });
      setGrOpen(false);
      loadGuides();
    } catch (e: any) {
      setGrError(e.response?.data?.message || e.response?.data?.error || 'Error al crear la guía de remisión');
    } finally { setGrBusy(false); }
  }

  async function registerEvent() {
    if (!form.status || saving) return;
    setSaving(true);
    try {
      await logisticsApi.addEvent(id!, { status: form.status, location: form.location || undefined, notes: form.notes || undefined });
      toast.success('Evento registrado');
      setForm({ status: '', location: '', notes: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo registrar el evento');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!s) return <p className="text-center text-surface-400 py-20">Envío no encontrado. <Link to="/logistica" className="text-brand-500 underline">Volver a Logística</Link></p>;

  const meta = SHIPMENT_STATUS_META[s.status];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton fallback="/logistica" label="Logística" />
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🚚</div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono text-surface-900 dark:text-white">{s.trackingNumber}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${meta?.tone}`}>{meta?.icon} {meta?.label}</span>
          </div>
          <p className="text-sm text-surface-500">
            {s.carrier ? `Courier: ${s.carrier}` : 'Transporte propio'}
            {s.carrierGuide && ` · guía externa ${s.carrierGuide}`}
            {s.estimatedDelivery && ` · ETA ${new Date(s.estimatedDelivery).toLocaleDateString('es')}`}
            {Number(s.freightCost) > 0 && ` · flete $${Number(s.freightCost).toFixed(2)}`}
          </p>
        </div>
        {s.orderType === 'SALES' && (
          <button
            onClick={openGR}
            title="Emite una guía de remisión electrónica para sustentar el traslado de esta mercadería"
            className="border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            📋 Guía de Remisión
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft">
          <h2 className="font-semibold text-surface-900 dark:text-white mb-4">📍 Historial de tracking</h2>
          <TrackingTimeline events={s.events} />
        </div>

        <div className="space-y-4">
          {/* Orden vinculada (bidireccional) */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-2">
              {s.orderType === 'SALES' ? '🎯 Pedido de venta' : '🛒 Orden de compra'}
            </h3>
            {s.order ? (
              <>
                <p className="font-mono text-brand-600 dark:text-brand-400">{s.order.number}</p>
                <p className="text-sm text-surface-500 mt-1">{s.order.party ?? '—'}</p>
                <Link to={s.order.url} className="inline-block mt-2 text-sm text-brand-500 hover:underline">Ver orden →</Link>
              </>
            ) : <p className="text-sm text-surface-400">Orden no disponible</p>}
          </div>

          {/* Destino */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-2">📦 Destino</h3>
            <p className="text-sm text-surface-700 dark:text-surface-200">{s.recipientName ?? '—'}</p>
            {s.recipientPhone && <p className="text-sm text-surface-500">{s.recipientPhone}</p>}
            <p className="text-sm text-surface-500 mt-1">{s.destAddress ?? 'Sin dirección registrada'}</p>
          </div>

          {/* Registrar evento */}
          {s.nextStatuses.length > 0 ? (
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft space-y-2">
              <h3 className="text-sm font-semibold text-surface-800 dark:text-white">➕ Registrar evento</h3>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
                {s.nextStatuses.map((st: string) => (
                  <option key={st} value={st}>{SHIPMENT_STATUS_META[st]?.icon} {SHIPMENT_STATUS_META[st]?.label ?? st}</option>
                ))}
              </select>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ubicación (ej. Quito - Hub norte)"
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white placeholder:text-surface-400" />
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas (opcional)"
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white placeholder:text-surface-400" />
              <button onClick={registerEvent} disabled={!form.status || saving}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Guardando…' : 'Registrar evento'}
              </button>
            </div>
          ) : (
            <div className={`rounded-2xl border p-4 text-center ${s.status === 'DELIVERED' ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800' : 'bg-surface-50 dark:bg-surface-900/40 border-surface-200 dark:border-surface-700'}`}>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                {s.status === 'DELIVERED' ? '🎉 Envío entregado' : 'Envío cerrado'}
              </p>
              {s.deliveredAt && <p className="text-xs text-surface-500 mt-1">{new Date(s.deliveredAt).toLocaleString('es')}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Guías de remisión emitidas */}
      {guides.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white">Guías de remisión</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Número</th>
                <th className="text-left px-4 py-2.5">Transportista</th>
                <th className="text-left px-4 py-2.5">Traslado</th>
                <th className="text-right px-4 py-2.5">SRI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {guides.map((g) => (
                <Fragment key={g.id}>
                  <tr>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => reportsApi.deliveryGuidePdf(g.id, g.number).catch(() => toast.error('No se pudo generar el PDF de la guía'))}
                        className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        title="Descargar PDF"
                      >
                        {g.number} 📄
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{g.transportistaRazonSocial} · {g.placa}</td>
                    <td className="px-4 py-2.5 text-surface-500">{new Date(g.fechaIniTransporte).toLocaleDateString('es')} — {new Date(g.fechaFinTransporte).toLocaleDateString('es')}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setExpandedGuideId((v) => (v === g.id ? null : g.id))} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        {expandedGuideId === g.id ? 'Ocultar ▲' : 'SRI ▾'}
                      </button>
                    </td>
                  </tr>
                  {expandedGuideId === g.id && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 bg-surface-50 dark:bg-surface-900/30">
                        <SriEmissionPanel docId={g.id} kind="deliveryGuide" onChanged={loadGuides} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Guía de Remisión */}
      {grOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !grBusy && setGrOpen(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900 dark:text-white">📋 Guía de Remisión · {s.trackingNumber}</h2>
              <button onClick={() => setGrOpen(false)} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
            </div>

            <div className="p-5 space-y-4">
              {grError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{grError}</div>
              )}

              <div>
                <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">MOTIVO DEL TRASLADO *</label>
                <input value={grForm.motivoTraslado} onChange={(e) => setGrForm({ ...grForm, motivoTraslado: e.target.value })}
                  placeholder="Venta, traslado entre bodegas…"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">DIRECCIÓN DE PARTIDA *</label>
                <input value={grForm.dirPartida} onChange={(e) => setGrForm({ ...grForm, dirPartida: e.target.value })}
                  placeholder="Bodega matriz, Quito…"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">INICIO DE TRANSPORTE *</label>
                  <input type="date" value={grForm.fechaIniTransporte} onChange={(e) => setGrForm({ ...grForm, fechaIniTransporte: e.target.value })}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">FIN DE TRANSPORTE *</label>
                  <input type="date" value={grForm.fechaFinTransporte} onChange={(e) => setGrForm({ ...grForm, fechaFinTransporte: e.target.value })}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
              </div>

              <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                <p className="text-xs font-semibold text-surface-500 uppercase mb-2">Transportista</p>
                <div className="space-y-3">
                  <input value={grForm.transportistaRazonSocial} onChange={(e) => setGrForm({ ...grForm, transportistaRazonSocial: e.target.value })}
                    placeholder="Razón social del transportista"
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  <div className="grid grid-cols-3 gap-3">
                    <select value={grForm.transportistaTipoIdentificacion} onChange={(e) => setGrForm({ ...grForm, transportistaTipoIdentificacion: e.target.value as any })}
                      className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none">
                      <option value="RUC">RUC</option>
                      <option value="CEDULA">Cédula</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                    <input value={grForm.transportistaIdentificacion} onChange={(e) => setGrForm({ ...grForm, transportistaIdentificacion: e.target.value })}
                      placeholder="Identificación"
                      className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                    <input value={grForm.placa} onChange={(e) => setGrForm({ ...grForm, placa: e.target.value.toUpperCase() })}
                      placeholder="Placa"
                      className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setGrOpen(false)} disabled={grBusy}
                  className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm hover:bg-surface-50 dark:hover:bg-surface-700">
                  Cancelar
                </button>
                <button onClick={submitGR} disabled={grBusy}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {grBusy ? 'Creando…' : 'Crear Guía de Remisión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
