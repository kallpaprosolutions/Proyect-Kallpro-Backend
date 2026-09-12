import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { financialApi } from '../../api/financial';

/**
 * Radar de cobranza (CxC): cartera vencida priorizada por antigüedad/monto, con la última
 * gestión registrada y la promesa de pago vigente (si existe) — para decidir a quién
 * contactar hoy sin depender de la memoria del contador. Antes no existía ningún registro
 * de gestión de cobranza (llamadas, emails, promesas de pago).
 */

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_LABELS: Record<string, string> = {
  CALL: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  PAYMENT_PROMISE: 'Promesa de pago',
  NOTE: 'Nota',
};

const RISK_STYLES: Record<string, string> = {
  ALTO: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  MEDIO: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  BAJO: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
};

const RISK_DOT: Record<string, string> = { ALTO: '🔴', MEDIO: '🟠', BAJO: '🟡' };

const inputClass = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

interface CustomerRow {
  customerId: string;
  customerName: string;
  balance: number;
  daysOverdue: number;
  invoiceCount: number;
  risk: 'ALTO' | 'MEDIO' | 'BAJO';
  lastActivity: { type: string; result: string | null; createdAt: string } | null;
  nextActionAt: string | null;
  promisedAmount: number | null;
  promisedDate: string | null;
}

export default function CollectionRadar() {
  const [data, setData] = useState<CustomerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [logFor, setLogFor] = useState<CustomerRow | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    financialApi.getCollectionRadar().then((r) => setData(r.data)).catch(() => setData([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Cobranza automática: mismo motor que corre el job diario (07:30); aquí se dispara a demanda.
  const runDunning = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const r = await financialApi.runDunning(true);
      setRunResult(r.data);
      load();
    } catch (e: any) {
      setRunResult({ error: e?.response?.data?.error || 'No se pudieron generar los recordatorios' });
    } finally { setRunning(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
        <div className="text-2xl mb-2">🎉</div>
        <p className="text-surface-500 text-sm">Sin cartera vencida pendiente de gestión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-surface-800 dark:text-white">📞 Radar de cobranza</h3>
          <p className="text-xs text-surface-500">Cartera vencida priorizada por antigüedad y monto — a quién contactar hoy. Los recordatorios automáticos (escalones en Ajustes → Empresa) corren a diario a las 07:30.</p>
        </div>
        <button onClick={runDunning} disabled={running}
          className="text-xs px-3 py-1.5 border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg font-medium disabled:opacity-50 whitespace-nowrap">
          {running ? 'Generando…' : '⚡ Ejecutar recordatorios ahora'}
        </button>
      </div>
      {runResult && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${runResult.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-surface-700 dark:text-surface-300'}`}>
          {runResult.error ? runResult.error : (
            <>
              {runResult.evaluated} factura{runResult.evaluated === 1 ? '' : 's'} vencida{runResult.evaluated === 1 ? '' : 's'} evaluada{runResult.evaluated === 1 ? '' : 's'} · <b>{runResult.created}</b> recordatorio{runResult.created === 1 ? '' : 's'} generado{runResult.created === 1 ? '' : 's'}
              {runResult.emailed > 0 && <> · {runResult.emailed} enviado{runResult.emailed === 1 ? '' : 's'} por email</>}
              {runResult.pendingManual > 0 && <> · {runResult.pendingManual} pendiente{runResult.pendingManual === 1 ? '' : 's'} de ejecutar (WhatsApp/llamada o sin email del cliente)</>}
              {runResult.skippedPromise > 0 && <> · {runResult.skippedPromise} pausada{runResult.skippedPromise === 1 ? '' : 's'} por promesa de pago vigente</>}
              {runResult.created === 0 && runResult.evaluated > 0 && <> — nada nuevo: los escalones aplicables ya se dispararon.</>}
            </>
          )}
        </div>
      )}
      <div className="space-y-2">
        {data.map((c) => (
          <div key={c.customerId} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-lg flex-shrink-0">{RISK_DOT[c.risk]}</span>
              <div className="min-w-0">
                <Link to={`/sales/customers/${c.customerId}`} className="font-medium text-surface-900 dark:text-white hover:text-brand-500 truncate block">
                  {c.customerName}
                </Link>
                <p className="text-xs text-surface-500">
                  {money(c.balance)} · vencido {c.daysOverdue}d · {c.invoiceCount} factura{c.invoiceCount === 1 ? '' : 's'}
                  {c.lastActivity && <> · última gestión: {TYPE_LABELS[c.lastActivity.type] ?? c.lastActivity.type} ({new Date(c.lastActivity.createdAt).toLocaleDateString('es')})</>}
                </p>
                {c.promisedAmount != null && (
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                    💬 Promesa: {money(c.promisedAmount)} para {c.promisedDate ? new Date(c.promisedDate).toLocaleDateString('es') : '—'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${RISK_STYLES[c.risk]}`}>Riesgo {c.risk.toLowerCase()}</span>
              <button onClick={() => setLogFor(c)}
                className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
                Registrar gestión
              </button>
            </div>
          </div>
        ))}
      </div>
      {logFor && <LogActivityModal customer={logFor} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load(); }} />}
    </div>
  );
}

/** Historial de gestión de cobranza de UN cliente — para montar en su perfil (fuera del radar global). */
export function CustomerCollectionPanel({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [history, setHistory] = useState<any[] | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = () => {
    financialApi.getCollectionHistory(customerId).then((r) => setHistory(r.data)).catch(() => setHistory([]));
  };
  useEffect(() => { load(); }, [customerId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-surface-800 dark:text-white">Gestión de cobranza</h3>
          <p className="text-xs text-surface-500">Historial de contactos y promesas de pago con este cliente.</p>
        </div>
        <button onClick={() => setShowLog(true)}
          className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
          + Registrar gestión
        </button>
      </div>

      {history === null ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <p className="text-surface-400 text-sm">Sin gestiones registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((a) => (
            <div key={a.id} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{TYPE_LABELS[a.type] ?? a.type}</span>
                <span className="text-xs text-surface-400">{new Date(a.createdAt).toLocaleString('es')}</span>
              </div>
              {a.result && <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{a.result}</p>}
              {a.promisedAmount != null && (
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  💬 Promesa: {money(Number(a.promisedAmount))} para {a.promisedDate ? new Date(a.promisedDate).toLocaleDateString('es') : '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showLog && (
        <LogActivityModal
          customer={{ customerId, customerName, balance: 0, daysOverdue: 0, invoiceCount: 0, risk: 'BAJO', lastActivity: null, nextActionAt: null, promisedAmount: null, promisedDate: null }}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); load(); }}
        />
      )}
    </div>
  );
}

function LogActivityModal({ customer, onClose, onSaved }: { customer: CustomerRow; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('CALL');
  const [result, setResult] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await financialApi.logCollectionActivity({
        customerId: customer.customerId,
        type,
        result: result.trim() || undefined,
        promisedAmount: promisedAmount ? Number(promisedAmount) : undefined,
        promisedDate: promisedDate || undefined,
        nextActionAt: nextActionAt || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo registrar la gestión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">Registrar gestión — {customer.customerName}</h3>
          <p className="text-xs text-surface-500 mt-0.5">Saldo vencido: {money(customer.balance)} ({customer.daysOverdue} días)</p>
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

        <div>
          <label className="text-xs text-surface-500 mb-1 block">Tipo de gestión</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-surface-500 mb-1 block">Resultado</label>
          <textarea value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={inputClass}
            placeholder="Ej: Cliente indicó que paga la próxima semana" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-500 mb-1 block">Monto prometido</label>
            <input type="number" min="0" step="0.01" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-surface-500 mb-1 block">Fecha prometida</label>
            <input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="text-xs text-surface-500 mb-1 block">Próxima acción (seguimiento)</label>
          <input type="date" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} className={inputClass} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
