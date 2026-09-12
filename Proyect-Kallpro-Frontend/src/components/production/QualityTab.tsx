import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productionApi, NC_LABELS } from '../../api/production';
import { inventoryApi } from '../../api/inventory';
import { getErrorMessage } from '../../api/client';

// ============================================================
// PESTAÑA CALIDAD (Sprint 12) — ISO 9001 §9.1 seguimiento y medición
// ============================================================
// Tres vistas en una: indicadores, especificaciones por producto (lo que
// se mide) y el registro de no conformidades abiertas.

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none';
const dateEs = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-EC') : '—');

// ─── Alta rápida de especificación (ventana emergente pequeña) ───
function ParameterModal({ products, onClose, onSaved }: {
  products: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    productId: '', name: '', type: 'NUMERIC', unit: '',
    minValue: '', maxValue: '', expectedText: '', method: '', norm: '', isCritical: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await productionApi.createParameter({
        productId: form.productId || null,
        name: form.name,
        type: form.type,
        unit: form.unit || undefined,
        minValue: form.minValue === '' ? undefined : Number(form.minValue),
        maxValue: form.maxValue === '' ? undefined : Number(form.maxValue),
        expectedText: form.expectedText || undefined,
        method: form.method || undefined,
        norm: form.norm || undefined,
        isCritical: form.isCritical,
      });
      onSaved(); onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo guardar el parámetro'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-white">➕ Nueva especificación de calidad</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Producto (vacío = aplica a todos)</label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputCls}>
              <option value="">— Todos los productos —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-500 mb-1">Parámetro *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="pH, Humedad, Peso neto…" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                <option value="NUMERIC">Numérico (rango)</option>
                <option value="BOOLEAN">Verificación (sí/no)</option>
                <option value="TEXT">Texto</option>
              </select>
            </div>
          </div>

          {form.type === 'NUMERIC' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Mínimo</label>
                <input type="number" step="any" value={form.minValue}
                  onChange={(e) => setForm({ ...form, minValue: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Máximo</label>
                <input type="number" step="any" value={form.maxValue}
                  onChange={(e) => setForm({ ...form, maxValue: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Unidad</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="%, °C, g" className={inputCls} />
              </div>
            </div>
          )}
          {form.type !== 'NUMERIC' && (
            <div>
              <label className="block text-xs text-surface-500 mb-1">
                Valor esperado {form.type === 'BOOLEAN' && '(escribe "false" si lo correcto es AUSENCIA)'}
              </label>
              <input value={form.expectedText} onChange={(e) => setForm({ ...form, expectedText: e.target.value })}
                placeholder={form.type === 'BOOLEAN' ? 'true / false' : 'Ámbar claro'} className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-500 mb-1">Método de ensayo</label>
              <input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
                placeholder="Potenciometría, AOAC…" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1">Norma de referencia</label>
              <input value={form.norm} onChange={(e) => setForm({ ...form, norm: e.target.value })}
                placeholder="NTE INEN 1334, ARCSA BPM…" className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
            <input type="checkbox" checked={form.isCritical}
              onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="rounded" />
            Es Punto Crítico de Control (PCC — HACCP / ISO 22000)
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-600 dark:text-surface-300">Cancelar</button>
            <button onClick={submit} disabled={busy || !form.name.trim()}
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QualityTab() {
  const [kpis, setKpis] = useState<any>(null);
  const [params, setParams] = useState<any[]>([]);
  const [ncs, setNcs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    productionApi.getQualityKPIs().then((r) => setKpis(r.data)).catch(() => {});
    productionApi.listParameters().then((r) => setParams(r.data)).catch(() => {});
    productionApi.listNonConformities().then((r) => setNcs(r.data)).catch(() => {});
  };
  useEffect(() => {
    load();
    inventoryApi.getProducts().then((r: any) => setProducts(r.data?.items ?? r.data ?? [])).catch(() => {});
  }, []);

  const kpiCards = kpis ? [
    { l: 'No conformidades abiertas', v: kpis.ncAbiertas, tone: kpis.ncAbiertas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400' },
    { l: 'Críticas', v: kpis.ncCriticas, tone: kpis.ncCriticas > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' },
    { l: 'Fuera de plazo', v: kpis.ncVencidas, tone: kpis.ncVencidas > 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white' },
    { l: 'Lotes en cuarentena', v: kpis.lotesEnCuarentena, tone: 'text-amber-600 dark:text-amber-400' },
    { l: 'Lotes rechazados', v: kpis.lotesRechazados, tone: 'text-red-600 dark:text-red-400' },
    { l: 'Aprobación del mes', v: kpis.tasaAprobacion == null ? '—' : `${kpis.tasaAprobacion}%`, tone: 'text-brand-600 dark:text-brand-400' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Indicadores (ISO 9001 §9.1) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <div key={k.l} className="bg-white dark:bg-surface-800 rounded-xl p-3 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-[11px] text-surface-500 uppercase tracking-wide leading-tight">{k.l}</p>
            <p className={`text-2xl font-bold mt-1 ${k.tone}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Especificaciones */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Especificaciones de calidad</h2>
            <p className="text-xs text-surface-500">Qué se mide en cada producto y cuál es el rango aceptable</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-lg text-sm bg-brand-500 hover:bg-brand-600 text-white font-medium">
            ➕ Nueva
          </button>
        </div>
        {params.length === 0 ? (
          <p className="text-center text-sm text-surface-400 py-8">
            Sin especificaciones definidas. Créalas para poder inspeccionar lotes.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Parámetro</th>
              <th className="text-left px-4 py-2.5">Producto</th>
              <th className="text-left px-4 py-2.5">Especificación</th>
              <th className="text-left px-4 py-2.5">Método / Norma</th>
              <th className="text-center px-4 py-2.5">PCC</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {params.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-surface-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-2 text-surface-600 dark:text-surface-400">{p.product?.name ?? 'Todos'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-surface-600 dark:text-surface-400">
                    {p.type === 'NUMERIC'
                      ? `${p.minValue != null ? Number(p.minValue) : '—'} a ${p.maxValue != null ? Number(p.maxValue) : '—'} ${p.unit ?? ''}`
                      : p.type === 'BOOLEAN' ? `Se espera: ${String(p.expectedText ?? 'true') === 'false' ? 'ausencia' : 'cumple'}`
                      : (p.expectedText ?? 'Texto libre')}
                  </td>
                  <td className="px-4 py-2 text-xs text-surface-500">
                    {[p.method, p.norm].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.isCritical && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">PCC</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* No conformidades */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="font-semibold text-surface-900 dark:text-white">No conformidades (CAPA)</h2>
          <p className="text-xs text-surface-500">Ciclo ISO 9001 §8.7 y §10.2 — se registran desde el lote afectado</p>
        </div>
        {ncs.length === 0 ? (
          <p className="text-center text-sm text-surface-400 py-8">Sin no conformidades registradas. 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Nº</th>
              <th className="text-left px-4 py-2.5">Descripción</th>
              <th className="text-left px-4 py-2.5">Origen</th>
              <th className="text-left px-4 py-2.5">Severidad</th>
              <th className="text-left px-4 py-2.5">Estado</th>
              <th className="text-left px-4 py-2.5">Compromiso</th>
              <th className="text-left px-4 py-2.5">Lote</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {ncs.map((n) => (
                <tr key={n.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-2 font-mono text-xs text-amber-600 dark:text-amber-400">{n.ncNumber}</td>
                  <td className="px-4 py-2 text-surface-700 dark:text-surface-300 max-w-[280px] truncate">{n.description}</td>
                  <td className="px-4 py-2 text-surface-500 text-xs">{NC_LABELS.source[n.source] ?? n.source}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      n.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : n.severity === 'MAJOR' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                    }`}>{NC_LABELS.severity[n.severity]}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-surface-600 dark:text-surface-400">{NC_LABELS.status[n.status]}</td>
                  <td className={`px-4 py-2 text-xs ${n.dueDate && new Date(n.dueDate) < new Date() && n.status !== 'CLOSED' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}`}>
                    {dateEs(n.dueDate)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {n.productionOrder
                      ? <Link to={`/production/orders/${n.productionOrder.id}`} className="text-brand-600 dark:text-brand-400 hover:underline font-mono">
                          {n.productionOrder.lotNumber ?? n.productionOrder.poNumber}
                        </Link>
                      : <span className="text-surface-400">{n.lotNumber ?? '—'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <ParameterModal products={products} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
