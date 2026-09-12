import { useEffect, useState } from 'react';
import { productionApi, QUALITY_STATUS_LABELS, NC_LABELS } from '../../api/production';
import { getErrorMessage } from '../../api/client';
import { useConfirm } from '../../hooks/useConfirm';

// ============================================================
// PANEL DE CALIDAD DEL LOTE (Sprint 12)
// ============================================================
// Reúne en el detalle de la orden todo lo que exige una auditoría:
//  · ficha del lote (nº, elaboración, vencimiento) — rotulado ARCSA
//  · estado de liberación (ISO 9001 §8.6) con firma de quien autoriza
//  · inspecciones con sus mediciones vs especificación
//  · no conformidades y su tratamiento CAPA (ISO 9001 §8.7 / §10.2)
//  · trazabilidad hacia atrás y hacia adelante (§8.5.2 · recall ARCSA)
//  · Certificado de Análisis imprimible

const dateEs = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-EC') : '—');
const money = (n: number) => `$${Number(n).toFixed(2)}`;

// ─── Modal contenedor reusable (ventana emergente pequeña y amigable) ───
function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between sticky top-0 bg-white dark:bg-surface-800">
          <h2 className="font-semibold text-surface-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none';

// ─── Modal: registrar inspección ───────────────────────────────
function InspectionModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const [params, setParams] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    productionApi.listParameters(order.product.id)
      .then((r) => setParams(r.data))
      .catch(() => setParams([]));
  }, [order.product.id]);

  const setVal = (id: string, patch: Record<string, unknown>) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], ...patch } }));

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await productionApi.createInspection({
        productionOrderId: order.id,
        productId: order.product.id,
        type: 'FINAL',
        lotNumber: order.lotNumber,
        notes,
        measurements: params.map((p) => ({
          parameterId: p.id,
          valueNumeric: p.type === 'NUMERIC' ? (values[p.id]?.valueNumeric ?? null) : null,
          valueBoolean: p.type === 'BOOLEAN' ? (values[p.id]?.valueBoolean ?? null) : null,
          valueText: p.type === 'TEXT' ? (values[p.id]?.valueText ?? null) : null,
          observation: values[p.id]?.observation ?? null,
        })),
      });
      onSaved(); onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo registrar la inspección'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="🔬 Registrar inspección de calidad" onClose={onClose} wide>
      {params.length === 0 ? (
        <p className="text-sm text-surface-500 py-4 text-center">
          Este producto no tiene parámetros de calidad definidos.<br />
          Configúralos en <strong>Producción → Calidad → Especificaciones</strong>.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-surface-500">
            El resultado lo determina el sistema comparando cada medición con su especificación (ISO 9001 §8.6).
          </p>
          {params.map((p) => (
            <div key={p.id} className="border border-surface-200 dark:border-surface-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <span className="text-sm font-medium text-surface-900 dark:text-white">
                  {p.name}
                  {p.isCritical && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">PCC</span>}
                </span>
                <span className="text-xs text-surface-400">
                  {p.type === 'NUMERIC'
                    ? `${p.minValue != null ? Number(p.minValue) : '—'} a ${p.maxValue != null ? Number(p.maxValue) : '—'} ${p.unit ?? ''}`
                    : p.type === 'BOOLEAN' ? 'Verificación' : 'Texto'}
                  {p.norm && ` · ${p.norm}`}
                </span>
              </div>
              {p.type === 'NUMERIC' && (
                <input type="number" step="any" placeholder={`Medición ${p.unit ? `(${p.unit})` : ''}`}
                  className={inputCls}
                  onChange={(e) => setVal(p.id, { valueNumeric: e.target.value === '' ? null : Number(e.target.value) })} />
              )}
              {p.type === 'BOOLEAN' && (
                <div className="flex gap-2">
                  {[{ v: true, l: 'Sí / Presente' }, { v: false, l: 'No / Ausente' }].map(({ v, l }) => (
                    <button key={String(v)} type="button" onClick={() => setVal(p.id, { valueBoolean: v })}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        values[p.id]?.valueBoolean === v
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                      }`}>{l}</button>
                  ))}
                </div>
              )}
              {p.type === 'TEXT' && (
                <input placeholder="Valor observado" className={inputCls}
                  onChange={(e) => setVal(p.id, { valueText: e.target.value })} />
              )}
              {p.method && <p className="text-[11px] text-surface-400 mt-1">Método: {p.method}</p>}
            </div>
          ))}
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones generales de la inspección…" className={inputCls} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-600 dark:text-surface-300">Cancelar</button>
            <button onClick={submit} disabled={busy}
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {busy ? 'Evaluando…' : 'Registrar y evaluar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Modal: nueva no conformidad ───────────────────────────────
function NcModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ source: 'PRODUCTION', severity: 'MINOR', description: '', dueDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await productionApi.createNonConformity({
        ...form,
        productionOrderId: order.id,
        productId: order.product.id,
        lotNumber: order.lotNumber,
        dueDate: form.dueDate || undefined,
      });
      onSaved(); onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo registrar la no conformidad'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="⚠️ Registrar no conformidad" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Origen</label>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls}>
              {Object.entries(NC_LABELS.source).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Severidad</label>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inputCls}>
              {Object.entries(NC_LABELS.severity).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Descripción del hallazgo *</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Qué se detectó, dónde y cuándo…" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Fecha compromiso de solución</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-600 dark:text-surface-300">Cancelar</button>
          <button onClick={submit} disabled={busy || !form.description.trim()}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {busy ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: tratamiento CAPA de una no conformidad ─────────────
const NEXT_STATUS: Record<string, string> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'VERIFICATION', VERIFICATION: 'CLOSED' };

function CapaModal({ nc, onClose, onSaved }: { nc: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    disposition: nc.disposition ?? '', rootCause: nc.rootCause ?? '',
    correctiveAction: nc.correctiveAction ?? '', effectivenessCheck: nc.effectivenessCheck ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = NEXT_STATUS[nc.status];

  const save = async (advance: boolean) => {
    setBusy(true); setError('');
    try {
      await productionApi.updateNonConformity(nc.id, {
        ...form,
        disposition: form.disposition || undefined,
        ...(advance && next ? { status: next } : {}),
      });
      onSaved(); onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo actualizar'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`${nc.ncNumber} · Tratamiento (CAPA)`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 text-sm">
          <p className="text-surface-700 dark:text-surface-300">{nc.description}</p>
          <p className="text-xs text-surface-500 mt-1">
            {NC_LABELS.source[nc.source]} · Severidad {NC_LABELS.severity[nc.severity]} · Estado: <strong>{NC_LABELS.status[nc.status]}</strong>
          </p>
        </div>

        <div>
          <label className="block text-xs text-surface-500 mb-1">Disposición del producto (ISO 9001 §8.7)</label>
          <select value={form.disposition} onChange={(e) => setForm({ ...form, disposition: e.target.value })} className={inputCls}>
            <option value="">— Sin definir —</option>
            {Object.entries(NC_LABELS.disposition).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Causa raíz (§10.2)</label>
          <textarea rows={2} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
            placeholder="¿Por qué ocurrió? (5 porqués, Ishikawa…)" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Acción correctiva (§10.2)</label>
          <textarea rows={2} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            placeholder="Qué se hará para que no vuelva a ocurrir" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Verificación de eficacia (requerida para cerrar)</label>
          <textarea rows={2} value={form.effectivenessCheck} onChange={(e) => setForm({ ...form, effectivenessCheck: e.target.value })}
            placeholder="Evidencia de que la acción funcionó" className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={() => save(false)} disabled={busy}
            className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-600 dark:text-surface-300 disabled:opacity-50">
            Guardar
          </button>
          {next && (
            <button onClick={() => save(true)} disabled={busy}
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              Avanzar a «{NC_LABELS.status[next]}»
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: trazabilidad del lote ──────────────────────────────
function TraceabilityModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { productionApi.getTraceability(orderId).then((r) => setData(r.data)).catch(() => setData(null)); }, [orderId]);

  return (
    <Modal title="🔗 Trazabilidad del lote" onClose={onClose} wide>
      {!data ? <p className="text-sm text-surface-400 text-center py-6">Cargando…</p> : (
        <div className="space-y-4 text-sm">
          <div className="bg-brand-50/60 dark:bg-brand-900/20 rounded-xl p-3">
            <p className="font-semibold text-surface-900 dark:text-white">{data.product.name} · Lote {data.order.lotNumber ?? '—'}</p>
            <p className="text-xs text-surface-500">
              Elaborado {dateEs(data.order.manufacturingDate)} · Vence {dateEs(data.order.expiryDate)} · {data.order.quantity} unidades
              {data.product.sanitaryRegistry && ` · Registro sanitario ${data.product.sanitaryRegistry}`}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-surface-800 dark:text-surface-100 mb-1">⬅ Hacia atrás: materias primas consumidas</h3>
            {data.backward.length === 0 ? <p className="text-surface-400 text-xs">Sin consumos registrados.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="text-surface-500 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-1.5">Componente</th><th className="text-left">Lote</th>
                  <th className="text-left">Lote proveedor</th><th className="text-right">Cantidad</th><th className="text-right">Costo</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {data.backward.map((b: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1.5 text-surface-800 dark:text-surface-200">{b.componentName}</td>
                      <td className="font-mono text-surface-500">{b.lotNumber ?? '—'}</td>
                      <td className="font-mono text-surface-500">{b.supplierBatch ?? '—'}</td>
                      <td className="text-right font-mono">{Number(b.quantity).toFixed(2)}</td>
                      <td className="text-right font-mono">{money(b.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 className="font-medium text-surface-800 dark:text-surface-100 mb-1">➡ Hacia adelante: salidas del lote (retiro de mercado)</h3>
            {data.forward.length === 0 ? <p className="text-surface-400 text-xs">El lote aún no ha salido de bodega.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="text-surface-500 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-1.5">Fecha</th><th className="text-right">Cantidad</th><th className="text-left">Referencia</th><th className="text-left">Detalle</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {data.forward.map((f: any) => (
                    <tr key={f.movementId}>
                      <td className="py-1.5">{dateEs(f.date)}</td>
                      <td className="text-right font-mono">{Number(f.quantity).toFixed(2)}</td>
                      <td className="font-mono text-brand-600 dark:text-brand-400">{f.reference ?? '—'}</td>
                      <td className="text-surface-500">{f.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Certificado de Análisis (COA) imprimible ──────────────────
function printCoa(order: any, inspection: any) {
  const rows = (inspection.results ?? []).map((r: any) => {
    const val = r.valueNumeric != null ? `${Number(r.valueNumeric)} ${r.parameter.unit ?? ''}`
      : r.valueBoolean != null ? (r.valueBoolean ? 'Sí / Presente' : 'No / Ausente')
      : (r.valueText ?? '—');
    const spec = r.parameter.type === 'NUMERIC'
      ? `${r.parameter.minValue != null ? Number(r.parameter.minValue) : '—'} a ${r.parameter.maxValue != null ? Number(r.parameter.maxValue) : '—'} ${r.parameter.unit ?? ''}`
      : (r.parameter.expectedText ?? 'Conforme');
    return `<tr>
      <td>${r.parameter.name}${r.parameter.isCritical ? ' <b>(PCC)</b>' : ''}</td>
      <td>${spec}</td><td>${val}</td>
      <td style="color:${r.passed ? '#15803d' : '#b91c1c'}">${r.passed ? 'CONFORME' : 'NO CONFORME'}</td>
      <td>${r.parameter.method ?? '—'}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>Certificado de Análisis ${inspection.inspectionNumber}</title>
  <style>
    body{font-family:system-ui,Segoe UI,sans-serif;padding:32px;color:#111}
    h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;color:#555;margin:0 0 20px;font-weight:500}
    table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f5f5f5}
    .box{border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}
    .res{margin-top:18px;padding:12px;border-radius:8px;font-weight:700;text-align:center;
         background:${inspection.status === 'PASSED' ? '#dcfce7' : '#fee2e2'};
         color:${inspection.status === 'PASSED' ? '#15803d' : '#b91c1c'}}
    .firma{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:12px}
    .firma div{border-top:1px solid #333;padding-top:6px;text-align:center}
    small{color:#666}
  </style></head><body>
  <h1>CERTIFICADO DE ANÁLISIS</h1>
  <h2>${inspection.inspectionNumber} · Emitido el ${new Date().toLocaleDateString('es-EC')}</h2>
  <div class="box"><div class="grid">
    <div><b>Producto:</b> ${order.product.name}</div>
    <div><b>Lote:</b> ${order.lotNumber ?? '—'}</div>
    <div><b>Orden de producción:</b> ${order.poNumber}</div>
    <div><b>Cantidad:</b> ${Number(order.quantity)} ${order.product.unit ?? ''}</div>
    <div><b>Fecha de elaboración:</b> ${dateEs(order.manufacturingDate)}</div>
    <div><b>Fecha de vencimiento:</b> ${dateEs(order.expiryDate)}</div>
    <div><b>Registro sanitario:</b> ${order.product.sanitaryRegistry ?? 'No declarado'}</div>
    <div><b>Fecha de análisis:</b> ${dateEs(inspection.inspectedAt)}</div>
  </div></div>
  <table><thead><tr><th>Parámetro</th><th>Especificación</th><th>Resultado</th><th>Conformidad</th><th>Método</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="res">${inspection.status === 'PASSED' ? 'LOTE CONFORME — APTO PARA LIBERACIÓN' : 'LOTE NO CONFORME — RETENIDO'}</div>
  <div class="firma"><div>Analista de Calidad</div><div>Responsable de Liberación</div></div>
  <p style="margin-top:24px"><small>Documento generado por KallpaPro ERP · Control de calidad conforme a ISO 9001:2015 §8.6 y normativa ARCSA. Este certificado ampara únicamente el lote indicado.</small></p>
  </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ─── Panel principal ───────────────────────────────────────────
export default function QualityPanel({ order, onChanged }: { order: any; onChanged: () => void }) {
  const confirmAction = useConfirm();
  const [showInspection, setShowInspection] = useState(false);
  const [showNc, setShowNc] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [capaNc, setCapaNc] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const status = QUALITY_STATUS_LABELS[order.qualityStatus] ?? QUALITY_STATUS_LABELS.PENDING;
  const produced = order.status === 'COMPLETED';
  const lastPassed = (order.inspections ?? []).find((i: any) => i.status === 'PASSED');

  const release = async (approve: boolean) => {
    if (!await confirmAction({
      title: approve ? 'Liberar lote' : 'Rechazar lote',
      message: approve
        ? '¿Liberar el lote? Quedará disponible para la venta y se registrará tu autorización.'
        : '¿Rechazar el lote? No podrá venderse.',
      variant: approve ? 'default' : 'danger',
    })) return;
    setBusy(true); setError('');
    try {
      await productionApi.releaseLot(order.id, approve);
      onChanged();
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo actualizar el estado del lote'));
    } finally { setBusy(false); }
  };

  const openCoa = async () => {
    if (!lastPassed) return;
    const { data } = await productionApi.getInspection(lastPassed.id);
    printCoa(order, data);
  };

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-surface-900 dark:text-white">🧪 Calidad y trazabilidad del lote</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.className}`}>{status.label}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Aviso de registro sanitario ARCSA */}
        {order.sanitary && order.sanitary.level !== 'OK' && (
          <div className={`rounded-xl px-4 py-2.5 text-sm border ${
            order.sanitary.level === 'EXPIRED'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
          }`}>
            🛡️ {order.sanitary.message}
          </div>
        )}

        {/* Ficha del lote */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { l: 'Nº de lote', v: order.lotNumber ?? '—', mono: true },
            { l: 'Elaboración', v: dateEs(order.manufacturingDate) },
            { l: 'Vencimiento', v: dateEs(order.expiryDate) },
            { l: 'Costo real del lote', v: produced ? money(Number(order.actualCost)) : '—', mono: true },
          ].map((f) => (
            <div key={f.l} className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3">
              <p className="text-xs text-surface-500">{f.l}</p>
              <p className={`font-medium text-surface-900 dark:text-white mt-0.5 ${f.mono ? 'font-mono text-sm' : ''}`}>{f.v}</p>
            </div>
          ))}
        </div>

        {!produced && (
          <p className="text-xs text-surface-400">
            El lote se genera al completar la producción. Si el producto exige control de calidad, nacerá en cuarentena.
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Acciones */}
        {produced && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowInspection(true)}
              className="px-3 py-2 rounded-lg text-sm bg-brand-500 hover:bg-brand-600 text-white font-medium">
              🔬 Registrar inspección
            </button>
            {order.qualityStatus === 'QUARANTINE' && (
              <>
                <button onClick={() => release(true)} disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50">
                  ✓ Liberar lote
                </button>
                <button onClick={() => release(false)} disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                  ✕ Rechazar lote
                </button>
              </>
            )}
            <button onClick={() => setShowTrace(true)}
              className="px-3 py-2 rounded-lg text-sm border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
              🔗 Trazabilidad
            </button>
            {lastPassed && (
              <button onClick={openCoa}
                className="px-3 py-2 rounded-lg text-sm border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
                📄 Certificado de análisis
              </button>
            )}
            <button onClick={() => setShowNc(true)}
              className="px-3 py-2 rounded-lg text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
              ⚠️ No conformidad
            </button>
          </div>
        )}

        {/* Inspecciones */}
        {(order.inspections ?? []).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Inspecciones</h3>
            <div className="divide-y divide-surface-100 dark:divide-surface-700 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
              {order.inspections.map((i: any) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{i.inspectionNumber}</span>
                  <span className="text-surface-500 text-xs">{i.type === 'FINAL' ? 'Final' : i.type === 'IN_PROCESS' ? 'En proceso' : 'Recepción'}</span>
                  <span className="text-xs text-surface-400">{dateEs(i.inspectedAt)}</span>
                  <div className="flex-1" />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    i.status === 'PASSED'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>{i.status === 'PASSED' ? 'Aprobada' : 'Reprobada'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No conformidades */}
        {(order.nonConformities ?? []).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">No conformidades</h3>
            <div className="divide-y divide-surface-100 dark:divide-surface-700 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
              {order.nonConformities.map((n: any) => (
                <button key={n.id} onClick={() => setCapaNc(n)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-50 dark:hover:bg-surface-700/40">
                  <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{n.ncNumber}</span>
                  <span className="flex-1 truncate text-surface-700 dark:text-surface-300">{n.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    n.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : n.severity === 'MAJOR' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                  }`}>{NC_LABELS.severity[n.severity]}</span>
                  <span className="text-xs text-surface-400">{NC_LABELS.status[n.status]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showInspection && <InspectionModal order={order} onClose={() => setShowInspection(false)} onSaved={onChanged} />}
      {showNc && <NcModal order={order} onClose={() => setShowNc(false)} onSaved={onChanged} />}
      {showTrace && <TraceabilityModal orderId={order.id} onClose={() => setShowTrace(false)} />}
      {capaNc && <CapaModal nc={capaNc} onClose={() => setCapaNc(null)} onSaved={onChanged} />}
    </div>
  );
}
