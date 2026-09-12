import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { financialApi } from '../../api/financial';
import { treasuryApi } from '../../api/treasury';
import { useToast } from '../ui/Toast';
import { AccountSelect } from './ChartOfAccountsTree';
import {
  Wallet, Scissors, GitPullRequestArrow, Search, X, ChevronDown, PhoneCall,
  ArrowRight, ClipboardList,
} from 'lucide-react';
import { KanbanBoard, KanbanColumnDef } from '../kanban/KanbanBoard';

/**
 * Mesa de trabajo de Cuentas por Cobrar — mismo enfoque que CxPWorkbench: cola de trabajo
 * priorizada + panel de detalle con acciones inline, en vez de tarjetas de KPI pasivas.
 * La cobranza (CxC) ya no depende de notas de crédito "sin enlazar" como CxP — el
 * CreditNote de venta actualiza `invoice.paidAmount` directo al emitirse — así que aquí no
 * hace falta esa pieza; en cambio se suma el registro de gestión de cobranza (llamada,
 * email, promesa de pago) directo desde el detalle, que antes solo vivía en el perfil del
 * cliente.
 */

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es') : '—');
const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white';

const DUNNING_BADGE: Record<string, string> = {
  AL_DIA: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  RECORDATORIO: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  URGENTE: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  COBRANZA: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
};
// Conciliación bancaria (roadmap Asistente Contable, Fase 5) — mismos 3 estados que maneja
// el motor de conciliación de Tesorería (Sprint 9.1), solo se traduce la etiqueta aquí.
const RECON_BADGE: Record<string, { label: string; cls: string }> = {
  CONCILIADO: { label: '✓ Conciliado', cls: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400' },
  REGISTRADO: { label: '⏳ Pendiente de conciliar', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  ANULADO: { label: '✕ Anulado', cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400' },
};
const DUNNING_STRIPE: Record<string, string> = {
  AL_DIA: 'bg-green-500', RECORDATORIO: 'bg-yellow-500', URGENTE: 'bg-amber-500', COBRANZA: 'bg-red-500',
};
const DUNNING_LABEL: Record<string, string> = {
  AL_DIA: 'Al día', RECORDATORIO: 'Recordatorio', URGENTE: 'Urgente', COBRANZA: 'Cobranza',
};
const DUNNING_ORDER: Record<string, number> = { COBRANZA: 0, URGENTE: 1, RECORDATORIO: 2, AL_DIA: 3 };

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Llamada' }, { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'MEETING', label: 'Reunión' },
  { value: 'PAYMENT_PROMISE', label: 'Promesa de pago' }, { value: 'NOTE', label: 'Nota' },
];

function dueInfo(dueDate: string | null) {
  if (!dueDate) return { label: 'sin vencimiento', cls: 'text-surface-500 dark:text-surface-400' };
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `hace ${-days} día${-days === 1 ? '' : 's'}`, cls: 'text-red-600 dark:text-red-400 font-semibold' };
  if (days === 0) return { label: 'vence hoy', cls: 'text-amber-600 dark:text-amber-400 font-semibold' };
  if (days <= 7) return { label: `en ${days} día${days === 1 ? '' : 's'}`, cls: 'text-amber-600 dark:text-amber-400' };
  return { label: `en ${days} días`, cls: 'text-surface-500 dark:text-surface-400' };
}

interface BankAccount { id: string; alias?: string; bankCode: string; accountNumber: string; currency: string; isActive: boolean }
function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  useEffect(() => { treasuryApi.getAccounts().then((r) => setAccounts((r.data ?? []).filter((a: BankAccount) => a.isActive))).catch(() => {}); }, []);
  return accounts;
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-700">
          <div><h2 className="font-semibold text-surface-900 dark:text-white">{title}</h2>{subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}</div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CollectModal({ item, onClose, onSubmit }: { item: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const accounts = useBankAccounts();
  const [amount, setAmount] = useState(String(item.balance.toFixed(2)));
  const [bankAccountId, setBankAccountId] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isPartial = Number(amount) > 0 && Number(amount) < item.balance - 0.005;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0) || n > item.balance + 0.005) { setError('El monto debe ser mayor a cero y no exceder el saldo pendiente'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ amount: n, bankAccountId: bankAccountId || undefined, method, reference: reference || undefined }); onClose(); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo registrar el cobro'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Cobrar ${item.number}`} subtitle={item.customerName} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto (saldo pendiente: {money(item.balance)})</label>
          <input type="number" step="0.01" min="0.01" max={item.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
          {isPartial && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Cobro parcial — quedará un saldo de {money(item.balance - Number(amount || 0))}.</p>}
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Cuenta bancaria</label>
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
            <option value="">Sin cuenta bancaria (solo asiento contable)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias || `${a.bankCode} · ${a.accountNumber}`} ({a.currency})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option value="BANK_TRANSFER">Transferencia</option><option value="CHECK">Cheque</option>
              <option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Referencia</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nº comprobante…" className={inputCls} />
          </div>
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Registrando…' : 'Confirmar cobro'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function WriteOffModal({ item, onClose, onSubmit }: { item: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [amount, setAmount] = useState(String(item.balance.toFixed(2)));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0) || n > item.balance + 0.005) { setError('El monto debe ser mayor a cero y no exceder el saldo pendiente'); return; }
    if (!reason.trim()) { setError('Indica el motivo del ajuste (obligatorio para el asiento contable)'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ amount: n, reason: reason.trim() }); onClose(); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo registrar el ajuste'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Ajustar saldo · ${item.number}`} subtitle="Cancela el saldo sin esperar un cobro — se castiga como incobrable o condonado." onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-600 dark:text-surface-400">
          Genera un asiento <b>DR Gasto por deterioro CxC / CR Cuentas por cobrar</b>. Úsalo para saldos declarados incobrables o condonaciones — no para descuentos que deberían ir por nota de crédito.
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto a ajustar (saldo: {money(item.balance)})</label>
          <input type="number" step="0.01" min="0.01" max={item.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Motivo (obligatorio)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cliente insolvente, saldo declarado incobrable…" className={inputCls} />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Registrando…' : 'Registrar ajuste'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ActivityModal({ item, onClose, onSubmit }: { item: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [type, setType] = useState('CALL');
  const [result, setResult] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await onSubmit({
        type, result: result.trim() || undefined,
        promisedAmount: promisedAmount ? Number(promisedAmount) : undefined,
        promisedDate: promisedDate || undefined, nextActionAt: nextActionAt || undefined,
      });
      onClose();
    } catch (e: any) { setError(e?.response?.data?.error || 'No se pudo registrar la gestión'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Registrar gestión · ${item.customerName}`} subtitle={item.number} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Tipo de contacto</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Resultado</label>
          <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="Promete pagar el viernes, no contesta…" className={inputCls} />
        </div>
        {type === 'PAYMENT_PROMISE' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-surface-500 mb-1">Monto prometido</label><input type="number" step="0.01" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs text-surface-500 mb-1">Fecha prometida</label><input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} className={inputCls} /></div>
          </div>
        )}
        <div>
          <label className="block text-xs text-surface-500 mb-1">Próxima acción (opcional)</label>
          <input type="date" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} className={inputCls} />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReclassifyModal({ entry, onClose, onSubmit }: { entry: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [lineId, setLineId] = useState(entry.lines[0]?.id ?? '');
  const [toAccountCode, setToAccountCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const line = entry.lines.find((l: any) => l.id === lineId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId || !toAccountCode) { setError('Selecciona la línea y la cuenta correcta'); return; }
    if (toAccountCode === line?.accountCode) { setError('La cuenta destino es igual a la actual'); return; }
    if (!reason.trim()) { setError('El motivo es obligatorio'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ entryId: entry.id, lineId, toAccountCode, reason: reason.trim() }); onClose(); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo reclasificar'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Reclasificar cuenta" subtitle={`Regulariza un mal registro en ${entry.entryNumber} sin editar el asiento original`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Línea a corregir</label>
          <select value={lineId} onChange={(e) => setLineId(e.target.value)} className={inputCls}>
            {entry.lines.map((l: any) => (
              <option key={l.id} value={l.id}>{l.accountCode} — {l.accountName} ({l.debit > 0 ? `DR ${money(l.debit)}` : `CR ${money(l.credit)}`})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Cuenta correcta</label>
          <AccountSelect value={toAccountCode} onChange={(code) => setToAccountCode(code)} placeholder="Buscar cuenta destino…" />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Motivo (obligatorio)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Se registró como venta general; corresponde a…" className={inputCls} />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Aplicando…' : 'Reclasificar'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DetailPanel({ item, canCollect, onAction, refreshKey }: { item: any; canCollect: boolean; onAction: (kind: string, payload?: any) => void; refreshKey: number }) {
  const [statement, setStatement] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    Promise.all([
      item.customerId ? financialApi.getCustomerStatement(item.customerId) : Promise.resolve({ data: null }),
      item.salesOrderId ? financialApi.getJournalEntries({ entityType: 'SALES_ORDER', entityId: item.salesOrderId }) : Promise.resolve({ data: [] }),
      item.customerId ? financialApi.getCollectionHistory(item.customerId) : Promise.resolve({ data: [] }),
      financialApi.getArReconciliation(item.id).catch(() => ({ data: [] })),
    ]).then(([st, je, hist, rec]) => {
      setStatement(st.data);
      setEntries(je.data ?? []);
      setHistory((hist.data ?? []).slice(0, 4));
      setReconciliation(rec.data ?? []);
    }).finally(() => setLoading(false));
  }, [item?.id, refreshKey]);

  const recentEntries = useMemo(() => (statement?.entries ?? []).slice(-5).reverse(), [statement]);

  if (!item) {
    const capabilities = [
      { icon: Wallet, label: 'Cobrar (total o parcial)', desc: 'con asiento y movimiento bancario automáticos' },
      { icon: Scissors, label: 'Ajustar el saldo', desc: 'cierra un residuo declarado incobrable, sin mover caja' },
      { icon: PhoneCall, label: 'Registrar una gestión de cobranza', desc: 'llamada, email, promesa de pago…' },
      { icon: GitPullRequestArrow, label: 'Reclasificar una cuenta', desc: 'corrige un mal registro sin editar el asiento' },
    ];
    return (
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Selecciona una factura de la cola</p>
        <p className="text-xs text-surface-400 mb-4">Desde aquí vas a poder:</p>
        <div className="space-y-3">
          {capabilities.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5">
              <c.icon className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <div><p className="text-xs font-medium text-surface-700 dark:text-surface-300">{c.label}</p><p className="text-[11px] text-surface-400">{c.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-surface-900 dark:text-white">Detalle de la factura</h2>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${DUNNING_BADGE[item.dunning]}`}>{DUNNING_LABEL[item.dunning]}</span>
      </div>

      <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        <div>
          <p className="font-mono text-xs text-brand-600 dark:text-brand-400 font-medium">{item.number}</p>
          <p className="font-semibold text-surface-900 dark:text-white">{item.customerName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[10px] uppercase tracking-wide text-surface-400">Vence</p><p className={`font-mono font-medium ${dueInfo(item.dueDate).cls}`}>{fmtDate(item.dueDate)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-surface-400">Saldo pendiente</p><p className="font-mono font-bold text-red-600 dark:text-red-400">{money(item.balance)}</p></div>
        </div>

        {statement && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Estado de cuenta (últimos movimientos)</p>
            <div className="space-y-1.5">
              {recentEntries.length === 0 && <p className="text-xs text-surface-400">Sin movimientos previos.</p>}
              {recentEntries.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-surface-500 dark:text-surface-400 truncate max-w-[60%]">{e.description}</span>
                  <span className={`font-mono ${e.type === 'COBRO' ? 'text-green-600 dark:text-green-400' : e.type === 'NOTA_CREDITO' ? 'text-blue-600 dark:text-blue-400' : 'text-surface-700 dark:text-surface-300'}`}>
                    {e.debit > 0 ? money(e.debit) : `−${money(e.credit)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Última gestión de cobranza</p>
            <div className="space-y-1.5">
              {history.map((h: any) => (
                <div key={h.id} className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-xs">
                  <div className="flex justify-between"><span className="font-medium text-surface-700 dark:text-surface-300">{ACTIVITY_TYPES.find((t) => t.value === h.type)?.label ?? h.type}</span><span className="text-surface-400">{fmtDate(h.createdAt)}</span></div>
                  {h.result && <p className="text-surface-500 dark:text-surface-400 mt-0.5">{h.result}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Asiento contable (venta)</p>
            {entries.map((entry: any) => (
              <div key={entry.id} className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden mb-1.5">
                <div className="bg-surface-50 dark:bg-surface-900/50 px-2.5 py-1.5 text-xs font-mono text-surface-600 dark:text-surface-400">{entry.entryNumber} · {entry.description}</div>
                <div className="divide-y divide-surface-100 dark:divide-surface-700">
                  {entry.lines.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                      <span className="text-surface-600 dark:text-surface-400 truncate max-w-[55%]"><span className="font-mono text-[10px] text-surface-400 mr-1">{l.accountCode}</span>{l.accountName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{l.debit > 0 ? money(l.debit) : money(l.credit)}</span>
                        {canCollect && (
                          <button title="Reclasificar cuenta" onClick={() => onAction('reclassify', { entry, preselectLineId: l.id })} className="text-surface-400 hover:text-purple-600 dark:hover:text-purple-400">
                            <GitPullRequestArrow className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {reconciliation.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Conciliación bancaria</p>
            <div className="space-y-1.5">
              {reconciliation.map((r: any) => {
                const badge = RECON_BADGE[r.status] ?? { label: r.status, cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500' };
                return (
                  <div key={r.bankTransactionId} className="flex items-center justify-between gap-2 text-xs bg-surface-50 dark:bg-surface-900/40 rounded-lg px-2.5 py-1.5">
                    <div>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                      <span className="text-surface-400 ml-2">{r.bankAccountLabel} · {fmtDate(r.date)}</span>
                    </div>
                    <span className="font-mono text-surface-700 dark:text-surface-300">{money(r.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {canCollect && (
            <>
              <button onClick={() => onAction('collect')} className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-2"><Wallet className="w-4 h-4" /> Cobrar ahora</button>
              <button onClick={() => onAction('writeoff')} className="w-full py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-center gap-2"><Scissors className="w-4 h-4" /> Ajustar saldo</button>
            </>
          )}
          <button onClick={() => onAction('activity')} className="w-full py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-center gap-2"><ClipboardList className="w-4 h-4" /> Registrar gestión de cobranza</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
type Filter = 'todos' | 'vencido' | 'pronto';

// Kanban de solo lectura por nivel de dunning (AL_DIA→COBRANZA) — ya es un campo categórico
// calculado en el backend, así que agrupar por columnas es gratis; no hay una transición
// manual real (cobrar exige monto/método/referencia y ya tiene su propio modal).
const AR_KANBAN_COLUMNS: KanbanColumnDef[] = ['AL_DIA', 'RECORDATORIO', 'URGENTE', 'COBRANZA'].map((id) => ({
  id, label: DUNNING_LABEL[id], droppable: false, hint: 'Clasificación automática según antigüedad y monto',
}));

export default function CxCWorkbench({ canCollect }: { canCollect: boolean }) {
  const toast = useToast();
  const [kpis, setKpis] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [collectTarget, setCollectTarget] = useState<any>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<any>(null);
  const [activityTarget, setActivityTarget] = useState<any>(null);
  const [reclassifyEntry, setReclassifyEntry] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      financialApi.getArKpis().then((r) => setKpis(r.data)).catch(() => setKpis(null)),
      financialApi.listReceivables().then((r) => setRows(r.data)).catch(() => setRows([])),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [refreshKey]);

  const items = useMemo(
    () => [...rows].sort((a, b) => (DUNNING_ORDER[a.dunning] - DUNNING_ORDER[b.dunning]) || (b.balance - a.balance)),
    [rows],
  );
  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'vencido') list = list.filter((i: any) => i.daysOverdue > 0);
    if (filter === 'pronto') list = list.filter((i: any) => i.daysOverdue === 0 && dueInfo(i.dueDate).cls.includes('amber'));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i: any) => (i.number ?? '').toLowerCase().includes(q) || (i.customerName ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    todos: items.length,
    vencido: items.filter((i: any) => i.daysOverdue > 0).length,
    pronto: items.filter((i: any) => i.daysOverdue === 0).length,
  }), [items]);

  const selected = items.find((i: any) => i.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => { if (!selectedId && filtered[0]) setSelectedId(filtered[0].id); }, [filtered, selectedId]);

  const refreshAll = () => setRefreshKey((k) => k + 1);
  const handleCollect = async (data: any) => { await financialApi.collectReceivable(collectTarget.id, data); toast.success('Cobro registrado', '✓'); refreshAll(); };
  const handleWriteOff = async (data: any) => { await financialApi.writeOffReceivable(writeOffTarget.id, data); toast.success('Ajuste registrado', '✓'); refreshAll(); };
  const handleActivity = async (data: any) => {
    await financialApi.logCollectionActivity({ customerId: activityTarget.customerId, invoiceId: activityTarget.id, ...data });
    toast.success('Gestión registrada', '✓'); refreshAll();
  };
  const handleReclassify = async (data: any) => { await financialApi.reclassifyEntry(data); toast.success('Cuenta reclasificada', '✓'); refreshAll(); };

  const onDetailAction = (kind: string, payload?: any) => {
    if (kind === 'collect') setCollectTarget(selected);
    else if (kind === 'writeoff') setWriteOffTarget(selected);
    else if (kind === 'activity') setActivityTarget(selected);
    else if (kind === 'reclassify') setReclassifyEntry(payload.entry);
  };

  if (loading && rows.length === 0 && !kpis) {
    return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft flex flex-wrap divide-x divide-surface-100 dark:divide-surface-700 overflow-hidden">
        {[
          { lbl: 'Por cobrar', val: kpis ? money(kpis.totalReceivable) : '—' },
          { lbl: 'Vencido', val: kpis ? money(kpis.overdue) : '—', cls: 'text-red-600 dark:text-red-400' },
          { lbl: 'Cobra en 7 días', val: kpis ? money(kpis.collectNext7) : '—', cls: 'text-amber-600 dark:text-amber-400' },
          { lbl: 'DSO', val: kpis ? `${kpis.dso} días` : '—' },
        ].map((m) => (
          <div key={m.lbl} className="flex-1 min-w-[140px] px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">{m.lbl}</p>
            <p className={`font-mono text-lg font-bold ${m.cls ?? 'text-surface-900 dark:text-white'}`}>{m.val}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar factura o cliente…" className={`pl-9 ${inputCls}`} />
        </div>
        <div className="flex gap-1.5">
          {(['todos', 'vencido', 'pronto'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-2 rounded-full border flex items-center gap-1.5 ${filter === f ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 text-brand-700 dark:text-brand-400' : 'border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'}`}>
              {f === 'todos' ? 'Todas' : f === 'vencido' ? 'Vencidas' : 'Vence pronto'}
              <span className={`text-[10px] font-mono px-1.5 rounded-full ${filter === f ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-0.5">
          <button onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
            ☰ Lista
          </button>
          <button onClick={() => setView('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
            ▦ Kanban
          </button>
        </div>
        <Link to="/sales" className="text-xs font-medium px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white flex items-center gap-1.5 whitespace-nowrap">
          Ir a Pedidos de venta <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {view === 'kanban' && filtered.length > 0 && (
        <KanbanBoard
          columns={AR_KANBAN_COLUMNS}
          items={filtered}
          getId={(i: any) => i.id}
          getColumnId={(i: any) => i.dunning}
          onMove={() => { /* de solo lectura: ver comentario en AR_KANBAN_COLUMNS */ }}
          emptyLabel="Sin facturas"
          renderCard={(item: any) => (
            <div onClick={() => setSelectedId(item.id)}
              className={`bg-white dark:bg-surface-900 rounded-lg border p-3 shadow-sm cursor-pointer ${selected?.id === item.id ? 'border-brand-400 ring-1 ring-brand-400' : 'border-surface-200 dark:border-surface-700'}`}>
              <p className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">{item.number}</p>
              <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 truncate">{item.customerName}</p>
              <p className="font-mono text-sm text-surface-900 dark:text-white mb-2">{money(item.balance)}</p>
              {canCollect && (
                <div className="flex gap-1.5">
                  <button title="Cobrar ahora" onClick={(e) => { e.stopPropagation(); setCollectTarget(item); }} className="flex-1 text-xs py-1 rounded-md border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:text-green-600 hover:border-green-400">Cobrar</button>
                  <button title="Registrar gestión" onClick={(e) => { e.stopPropagation(); setActivityTarget(item); }} className="flex-1 text-xs py-1 rounded-md border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:text-brand-600 hover:border-brand-400">Gestión</button>
                </div>
              )}
            </div>
          )}
        />
      )}

      {view === 'list' && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-500">Cola de trabajo — ordenada por antigüedad</p>
            <p className="text-[11px] text-surface-400">clic para ver detalle · ▾ para el resumen</p>
          </div>
          {filtered.length === 0 && items.length === 0 ? (
            <div className="px-6 py-10">
              <div className="max-w-md mx-auto text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-500 flex items-center justify-center mx-auto"><Wallet className="w-6 h-6" /></div>
                <div>
                  <p className="font-semibold text-surface-900 dark:text-white">Aún no hay facturas de venta por cobrar</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    Esta mesa de trabajo se llena sola: cuando facturas un pedido de venta, aparece aquí ordenada
                    por antigüedad — lista para cobrar, ajustar o dar seguimiento.
                  </p>
                </div>
                <Link to="/sales" className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white">
                  Ir a Pedidos de venta <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-400">No hay facturas que coincidan con el filtro.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-[10px] uppercase">
                <th className="w-1"></th><th className="text-left px-2 py-2">Estado</th>
                <th className="text-left px-2 py-2">Factura</th><th className="text-left px-2 py-2">Vence</th>
                <th className="text-right px-3 py-2">Saldo</th><th className="w-20 px-2 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filtered.map((item: any) => {
                  const due = dueInfo(item.dueDate);
                  const isSel = selected?.id === item.id;
                  return (
                    <Fragment key={item.id}>
                      <tr onClick={() => setSelectedId(item.id)} className={`cursor-pointer ${isSel ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-surface-50 dark:hover:bg-surface-700/30'}`}>
                        <td className="p-0"><div className={`w-1 self-stretch min-h-[40px] ${DUNNING_STRIPE[item.dunning]}`} /></td>
                        <td className="px-2 py-2.5"><span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${DUNNING_BADGE[item.dunning]}`}>{DUNNING_LABEL[item.dunning]}</span></td>
                        <td className="px-2 py-2.5">
                          <button onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === item.id ? null : item.id); }} className="flex items-center gap-1 text-left hover:underline">
                            <ChevronDown className={`w-3 h-3 text-surface-400 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} />
                            <span><span className="font-mono text-xs text-brand-600 dark:text-brand-400 block">{item.number}</span><span className="text-xs text-surface-500 dark:text-surface-400">{item.customerName}</span></span>
                          </button>
                        </td>
                        <td className={`px-2 py-2.5 text-xs ${due.cls}`}>{due.label}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-surface-900 dark:text-white">{money(item.balance)}</td>
                        <td className="px-2 py-2.5">
                          {canCollect && (
                            <div className="flex gap-1 justify-end">
                              <button title="Cobrar ahora" onClick={(e) => { e.stopPropagation(); setCollectTarget(item); }} className="w-7 h-7 rounded-md border border-surface-200 dark:border-surface-600 flex items-center justify-center text-surface-500 hover:text-green-600 hover:border-green-400"><Wallet className="w-3.5 h-3.5" /></button>
                              <button title="Registrar gestión" onClick={(e) => { e.stopPropagation(); setActivityTarget(item); }} className="w-7 h-7 rounded-md border border-surface-200 dark:border-surface-600 flex items-center justify-center text-surface-500 hover:text-brand-600 hover:border-brand-400"><PhoneCall className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr><td colSpan={6} className="bg-surface-50 dark:bg-surface-900/40 px-6 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><p className="font-medium text-surface-700 dark:text-surface-300">Total factura</p><p className="text-surface-500 dark:text-surface-400 font-mono">{money(item.totalAmount)}</p></div>
                            <div><p className="font-medium text-surface-700 dark:text-surface-300">Cobrado</p><p className="text-surface-500 dark:text-surface-400 font-mono">{money(item.paidAmount)}</p></div>
                            <div><p className="font-medium text-surface-700 dark:text-surface-300">Días de atraso</p><p className="text-surface-500 dark:text-surface-400">{item.daysOverdue || 0}</p></div>
                            <div><p className="font-medium text-surface-700 dark:text-surface-300">Estado</p><p className="text-surface-500 dark:text-surface-400">{item.status}</p></div>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DetailPanel item={selected} canCollect={canCollect} onAction={onDetailAction} refreshKey={refreshKey} />
      </div>
      )}

      {collectTarget && <CollectModal item={collectTarget} onClose={() => setCollectTarget(null)} onSubmit={handleCollect} />}
      {writeOffTarget && <WriteOffModal item={writeOffTarget} onClose={() => setWriteOffTarget(null)} onSubmit={handleWriteOff} />}
      {activityTarget && <ActivityModal item={activityTarget} onClose={() => setActivityTarget(null)} onSubmit={handleActivity} />}
      {reclassifyEntry && <ReclassifyModal entry={reclassifyEntry} onClose={() => setReclassifyEntry(null)} onSubmit={handleReclassify} />}
    </div>
  );
}
