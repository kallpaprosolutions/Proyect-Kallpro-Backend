import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

const REGIMENES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'RIMPE_EMPRENDEDOR', label: 'RIMPE — Emprendedor' },
  { value: 'RIMPE_NEGOCIO_POPULAR', label: 'RIMPE — Negocio Popular' },
];

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function FiscalConfigPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [config, setConfig] = useState<any>(null);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    ruc: '', razonSocial: '', nombreComercial: '', obligadoContabilidad: true,
    contribuyenteEspecial: '', regimen: 'GENERAL',
  });
  const [newEst, setNewEst] = useState({ code: '', name: '', address: '', isMatriz: false });
  const [newPoint, setNewPoint] = useState<Record<string, { code: string; name: string }>>({});
  const [certForm, setCertForm] = useState<{ alias: string; password: string; file: File | null }>({ alias: '', password: '', file: null });
  const [uploadingCert, setUploadingCert] = useState(false);
  const [testingPoint, setTestingPoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ pointId: string; claveAcceso: string; signedXml: string } | null>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [changingTipoEmision, setChangingTipoEmision] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [retrying, setRetrying] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.allSettled([financialApi.getFiscalConfig(), financialApi.listCertificates(), financialApi.getProductionChecklist(), financialApi.getPendingSriDocuments()])
      .then((res) => {
        if (res[0].status === 'fulfilled' && res[0].value.data) {
          const c = res[0].value.data;
          setConfig(c);
          setForm({
            ruc: c.ruc, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial || '',
            obligadoContabilidad: c.obligadoContabilidad, contribuyenteEspecial: c.contribuyenteEspecial || '',
            regimen: c.regimen,
          });
        }
        if (res[1].status === 'fulfilled') setCerts(res[1].value.data);
        if (res[2].status === 'fulfilled') setChecklist(res[2].value.data);
        if (res[3].status === 'fulfilled') setPending(res[3].value.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const changeTipoEmision = async (tipoEmision: 'NORMAL' | 'CONTINGENCIA') => {
    if (tipoEmision === config?.tipoEmision) return;
    const ok = await confirm({
      title: tipoEmision === 'CONTINGENCIA' ? '¿Activar contingencia?' : '¿Volver a emisión normal?',
      message: tipoEmision === 'CONTINGENCIA'
        ? 'Úsalo SOLO si el servicio del SRI está caído y necesitas seguir emitiendo comprobantes (quedan marcados como contingencia en la clave de acceso). Vuelve a Normal en cuanto el SRI se restablezca.'
        : 'Los comprobantes nuevos volverán a emitirse en modo normal (no contingencia).',
      confirmLabel: 'Confirmar', variant: tipoEmision === 'CONTINGENCIA' ? 'danger' : 'default',
    });
    if (!ok) return;
    setChangingTipoEmision(true);
    try {
      await financialApi.setTipoEmision(tipoEmision);
      toast.success(`Tipo de emisión: ${tipoEmision === 'CONTINGENCIA' ? 'Contingencia' : 'Normal'}`, '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cambiar el tipo de emisión', 'Error');
    } finally { setChangingTipoEmision(false); }
  };

  const retryPending = async () => {
    setRetrying(true);
    try {
      const { data } = await financialApi.retryPendingSriDocuments();
      const autorizadas = data.filter((r: any) => r.after === 'AUTORIZADA').length;
      toast.success(`${autorizadas} de ${data.length} autorizado(s) ahora`, '✓ Reintento completado');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo reintentar', 'Error');
    } finally { setRetrying(false); }
  };

  const saveConfig = async () => {
    if (!/^\d{10}001$/.test(form.ruc)) { toast.error('El RUC debe tener 13 dígitos y terminar en 001', 'RUC inválido'); return; }
    setSaving(true);
    try {
      await financialApi.upsertFiscalConfig(form);
      toast.success('Datos fiscales guardados', '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar', 'Error');
    } finally { setSaving(false); }
  };

  const changeAmbiente = async (ambiente: 'PRUEBAS' | 'PRODUCCION') => {
    if (ambiente === config?.ambiente) return;
    const ok = await confirm({
      title: ambiente === 'PRODUCCION' ? '¿Pasar a Producción?' : '¿Volver a Pruebas?',
      message: ambiente === 'PRODUCCION'
        ? 'Desde este momento los comprobantes se enviarán al SRI real (cel.sri.gob.ec) con validez tributaria. Confirma que el certificado y los establecimientos están correctos.'
        : 'Los comprobantes volverán a enviarse solo al ambiente de certificación del SRI (celcer.sri.gob.ec), sin validez tributaria.',
      confirmLabel: ambiente === 'PRODUCCION' ? 'Sí, pasar a Producción' : 'Sí, volver a Pruebas',
      variant: ambiente === 'PRODUCCION' ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await financialApi.setFiscalAmbiente(ambiente);
      toast.success(`Ambiente cambiado a ${ambiente === 'PRODUCCION' ? 'Producción' : 'Pruebas'}`, '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cambiar el ambiente', 'Error');
    }
  };

  const addEstablishment = async () => {
    if (!/^\d{3}$/.test(newEst.code)) { toast.error('El código debe ser de 3 dígitos (ej. 001)', 'Código inválido'); return; }
    try {
      await financialApi.createEstablishment(newEst);
      setNewEst({ code: '', name: '', address: '', isMatriz: false });
      toast.success('Establecimiento creado', '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo crear', 'Error');
    }
  };

  const addEmissionPoint = async (establishmentId: string) => {
    const data = newPoint[establishmentId];
    if (!data?.code || !/^\d{3}$/.test(data.code)) { toast.error('El código debe ser de 3 dígitos (ej. 001)', 'Código inválido'); return; }
    try {
      await financialApi.createEmissionPoint(establishmentId, data);
      setNewPoint((p) => ({ ...p, [establishmentId]: { code: '', name: '' } }));
      toast.success('Punto de emisión creado', '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo crear', 'Error');
    }
  };

  const uploadCert = async () => {
    if (!certForm.file) { toast.error('Selecciona el archivo .p12/.pfx', 'Falta el archivo'); return; }
    if (!certForm.password) { toast.error('Ingresa la contraseña del certificado', 'Falta la contraseña'); return; }
    setUploadingCert(true);
    try {
      await financialApi.uploadCertificate(certForm.file, certForm.alias || certForm.file.name, certForm.password);
      toast.success('Certificado cargado y verificado', '✓');
      setCertForm({ alias: '', password: '', file: null });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cargar el certificado', 'Error');
    } finally { setUploadingCert(false); }
  };

  const testSignature = async (establishmentId: string, pointId: string) => {
    setTestingPoint(pointId);
    setTestResult(null);
    try {
      const r = await financialApi.previewSignedTest(establishmentId, pointId);
      toast.success(`Firmado correctamente. Clave de acceso: ${r.data.claveAcceso}`, '✓ Certificado válido');
      setTestResult({ pointId, claveAcceso: r.data.claveAcceso, signedXml: r.data.signedXml });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo firmar el comprobante de prueba', 'Error');
    } finally {
      setTestingPoint(null);
    }
  };

  const deactivateCert = async (id: string) => {
    const ok = await confirm({ title: '¿Desactivar certificado?', message: 'Ya no se usará para firmar comprobantes nuevos.', confirmLabel: 'Desactivar', variant: 'danger' });
    if (!ok) return;
    try { await financialApi.deactivateCertificate(id); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Error', 'Error'); }
  };

  if (loading) return <div className="text-center py-10 text-surface-400">Cargando…</div>;

  const activeCert = certs.find((c) => c.active);
  const certExpiringSoon = activeCert?.validTo && (new Date(activeCert.validTo).getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 30;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
        <strong>Base normativa de facturación electrónica SRI.</strong> Aquí se configura el ambiente,
        los establecimientos/puntos de emisión y el certificado de firma electrónica. La emisión real
        de comprobantes autorizados por el SRI se habilita en etapas siguientes de este módulo.
      </div>

      {/* Ambiente */}
      {config && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-white">Ambiente SRI</h3>
              <p className="text-sm text-surface-500">Determina si los comprobantes se envían al ambiente de certificación (sin validez tributaria) o al de producción.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${config.ambiente === 'PRODUCCION' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                {config.ambiente === 'PRODUCCION' ? '🔴 PRODUCCIÓN' : '🔵 PRUEBAS'}
              </span>
              <button
                onClick={() => changeAmbiente(config.ambiente === 'PRODUCCION' ? 'PRUEBAS' : 'PRODUCCION')}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
                Cambiar a {config.ambiente === 'PRODUCCION' ? 'Pruebas' : 'Producción'}
              </button>
            </div>
          </div>

          {config.ambiente === 'PRUEBAS' && checklist && (
            <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
              <p className="text-xs font-semibold text-surface-500 uppercase mb-1.5">Requisitos para pasar a Producción</p>
              <ul className="space-y-1 text-sm">
                <li className={checklist.hasActiveCertificate ? 'text-green-700 dark:text-green-400' : 'text-surface-400'}>
                  {checklist.hasActiveCertificate ? '✓' : '○'} Certificado de firma electrónica activo
                </li>
                <li className={checklist.hasActiveEstablishment ? 'text-green-700 dark:text-green-400' : 'text-surface-400'}>
                  {checklist.hasActiveEstablishment ? '✓' : '○'} Al menos un establecimiento activo
                </li>
                <li className={checklist.hasAuthorizedTestDocument ? 'text-green-700 dark:text-green-400' : 'text-surface-400'}>
                  {checklist.hasAuthorizedTestDocument ? '✓' : '○'} Al menos un comprobante AUTORIZADO por el SRI en Pruebas
                </li>
              </ul>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="text-sm font-semibold text-surface-800 dark:text-white">Tipo de emisión</h4>
              <p className="text-xs text-surface-500">Actívalo SOLO si el servicio del SRI está caído; vuelve a Normal en cuanto se restablezca.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${config.tipoEmision === 'CONTINGENCIA' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'}`}>
                {config.tipoEmision === 'CONTINGENCIA' ? '⚠️ CONTINGENCIA' : 'NORMAL'}
              </span>
              <button disabled={changingTipoEmision}
                onClick={() => changeTipoEmision(config.tipoEmision === 'CONTINGENCIA' ? 'NORMAL' : 'CONTINGENCIA')}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50">
                Cambiar a {config.tipoEmision === 'CONTINGENCIA' ? 'Normal' : 'Contingencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cola de reintentos (Etapa 5): comprobantes ENVIADA/RECIBIDA sin autorización aún */}
      {pending.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl shadow-soft p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">⏳ {pending.length} comprobante(s) pendiente(s) de autorización</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400">Quedaron esperando respuesta del SRI (red caída o servicio no disponible) — nada se perdió, solo falta reintentar.</p>
          </div>
          <button onClick={retryPending} disabled={retrying}
            className="text-sm px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium whitespace-nowrap">
            {retrying ? 'Reintentando…' : '🔁 Reintentar pendientes'}
          </button>
        </div>
      )}

      {/* Datos fiscales */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
        <h3 className="font-semibold text-surface-900 dark:text-white mb-3">Datos fiscales de la empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-500">RUC</label>
            <input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })}
              maxLength={13} placeholder="1790000000001"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Razón social</label>
            <input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Nombre comercial (opcional)</label>
            <input value={form.nombreComercial} onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Régimen tributario</label>
            <select value={form.regimen} onChange={(e) => setForm({ ...form, regimen: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm">
              {REGIMENES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500">Resolución de contribuyente especial (opcional)</label>
            <input value={form.contribuyenteEspecial} onChange={(e) => setForm({ ...form, contribuyenteEspecial: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm" />
          </div>
          <label className="flex items-center gap-2 mt-6 text-sm text-surface-700 dark:text-surface-300">
            <input type="checkbox" checked={form.obligadoContabilidad}
              onChange={(e) => setForm({ ...form, obligadoContabilidad: e.target.checked })} />
            Obligado a llevar contabilidad
          </label>
        </div>
        <button onClick={saveConfig} disabled={saving}
          className="mt-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {saving ? 'Guardando…' : 'Guardar datos fiscales'}
        </button>
      </div>

      {config && (
        <>
          {/* Establecimientos y puntos de emisión */}
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-3">Establecimientos y puntos de emisión</h3>
            <div className="space-y-3">
              {config.establishments?.map((est: any) => (
                <div key={est.id} className="border border-surface-200 dark:border-surface-700 rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-mono text-xs bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded mr-2">{est.code}</span>
                      <span className="font-medium text-surface-900 dark:text-white">{est.name}</span>
                      {est.isMatriz && <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">Matriz</span>}
                      <p className="text-xs text-surface-500">{est.address}</p>
                    </div>
                  </div>
                  <div className="mt-2 pl-4 border-l-2 border-surface-100 dark:border-surface-700 space-y-1">
                    {est.emissionPoints?.map((p: any) => (
                      <div key={p.id}>
                        <div className="text-sm flex items-center gap-2">
                          <span className="font-mono text-xs bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded">{p.code}</span>
                          <span className="text-surface-700 dark:text-surface-300">{p.name || 'Punto de emisión'}</span>
                          {!p.active && <span className="text-xs text-surface-400">(inactivo)</span>}
                          {config.ambiente === 'PRUEBAS' && certs.some((c) => c.active) && p.active && (
                            <button onClick={() => testSignature(est.id, p.id)} disabled={testingPoint === p.id}
                              className="ml-auto text-xs px-2 py-0.5 rounded border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50">
                              {testingPoint === p.id ? 'Firmando…' : '🔏 Probar firma'}
                            </button>
                          )}
                        </div>
                        {testResult && testResult.pointId === p.id && (
                          <details className="mt-1 text-xs bg-surface-50 dark:bg-surface-900 rounded p-2 border border-surface-200 dark:border-surface-700">
                            <summary className="cursor-pointer text-surface-600 dark:text-surface-400">
                              ✓ Firmado — clave de acceso <span className="font-mono">{testResult.claveAcceso}</span> (ver XML firmado)
                            </summary>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-surface-500">{testResult.signedXml}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-1">
                      <input placeholder="001" maxLength={3}
                        value={newPoint[est.id]?.code || ''}
                        onChange={(e) => setNewPoint((p) => ({ ...p, [est.id]: { ...p[est.id], code: e.target.value, name: p[est.id]?.name || '' } }))}
                        className="w-16 px-2 py-1 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
                      <input placeholder="Nombre (opcional, ej. Caja 1)"
                        value={newPoint[est.id]?.name || ''}
                        onChange={(e) => setNewPoint((p) => ({ ...p, [est.id]: { code: p[est.id]?.code || '', name: e.target.value } }))}
                        className="flex-1 px-2 py-1 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
                      <button onClick={() => addEmissionPoint(est.id)}
                        className="text-xs px-2 py-1 rounded bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200">
                        + Punto de emisión
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(!config.establishments || config.establishments.length === 0) && (
                <p className="text-sm text-surface-400 text-center py-3">Sin establecimientos — agrega el primero (normalmente la Matriz, código 001).</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-700 flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-xs text-surface-500">Código</label>
                <input placeholder="001" maxLength={3} value={newEst.code}
                  onChange={(e) => setNewEst({ ...newEst, code: e.target.value })}
                  className="block w-20 mt-1 px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-surface-500">Nombre</label>
                <input placeholder="Matriz" value={newEst.name}
                  onChange={(e) => setNewEst({ ...newEst, name: e.target.value })}
                  className="block w-full mt-1 px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-surface-500">Dirección</label>
                <input value={newEst.address}
                  onChange={(e) => setNewEst({ ...newEst, address: e.target.value })}
                  className="block w-full mt-1 px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-400 mb-1.5">
                <input type="checkbox" checked={newEst.isMatriz} onChange={(e) => setNewEst({ ...newEst, isMatriz: e.target.checked })} />
                Matriz
              </label>
              <button onClick={addEstablishment}
                className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium">
                + Establecimiento
              </button>
            </div>
          </div>

          {/* Certificado de firma electrónica */}
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-1">Certificado de firma electrónica (.p12)</h3>
            <p className="text-sm text-surface-500 mb-3">
              Se cifra en el servidor; la contraseña nunca se muestra de vuelta ni se comparte con nadie más que el firmador interno.
            </p>

            {activeCert && (
              <div className={`mb-3 p-3 rounded-lg border text-sm ${certExpiringSoon ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700' : 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'}`}>
                <p className="font-medium text-surface-900 dark:text-white">🔐 {activeCert.alias} — activo</p>
                <p className="text-xs text-surface-500">Vigente {fmtDate(activeCert.validFrom)} → {fmtDate(activeCert.validTo)}</p>
                {certExpiringSoon && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">⚠ Vence pronto — considera renovarlo.</p>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div>
                <label className="text-xs text-surface-500">Archivo (.p12/.pfx)</label>
                <input type="file" accept=".p12,.pfx"
                  onChange={(e) => setCertForm({ ...certForm, file: e.target.files?.[0] || null })}
                  className="block w-full mt-1 text-sm text-surface-700 dark:text-surface-300" />
              </div>
              <div>
                <label className="text-xs text-surface-500">Alias (opcional)</label>
                <input value={certForm.alias} onChange={(e) => setCertForm({ ...certForm, alias: e.target.value })}
                  placeholder="Certificado 2026"
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              </div>
              <div>
                <label className="text-xs text-surface-500">Contraseña</label>
                <input type="password" value={certForm.password} onChange={(e) => setCertForm({ ...certForm, password: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              </div>
            </div>
            <button onClick={uploadCert} disabled={uploadingCert}
              className="mt-3 px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium">
              {uploadingCert ? 'Verificando…' : '📤 Cargar y verificar certificado'}
            </button>

            {certs.length > 0 && (
              <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-700 space-y-1.5">
                {certs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className={c.active ? 'text-surface-900 dark:text-white' : 'text-surface-400 line-through'}>
                      {c.alias} <span className="text-xs text-surface-400">({fmtDate(c.validFrom)} – {fmtDate(c.validTo)})</span>
                    </span>
                    {c.active && (
                      <button onClick={() => deactivateCert(c.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                        Desactivar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
