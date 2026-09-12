import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { financialApi } from '../../api/financial';
import { treasuryApi } from '../../api/treasury';
import { useToast } from '../ui/Toast';
import { AccountSelect } from './ChartOfAccountsTree';
import {
  CreditCard, CalendarClock, Scissors, GitPullRequestArrow, Search, X, ChevronDown,
  FileUp, ArrowRight, Layers,
} from 'lucide-react';
import { KanbanBoard, KanbanColumnDef } from '../kanban/KanbanBoard';

/**
 * Mesa de trabajo de Cuentas por Pagar — reemplaza las tarjetas de KPI + tabla plana por un
 * flujo operativo real (lista priorizada + panel de detalle + acciones inline), con soporte
 * para los casos que un contador enfrenta a diario: pagos parciales, ajustes de saldo,
 * aplicación manual de notas de crédito y reclasificación de cuentas mal registradas.
 */

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es') : '—');
const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white';

const LEVEL_BADGE: Record<string, string> = {
  ALTA: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
  MEDIA: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  BAJA: 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400',
};
const LEVEL_STRIPE: Record<string, string> = {
  ALTA: 'bg-red-500', MEDIA: 'bg-amber-500', BAJA: 'bg-surface-300 dark:bg-surface-600',
};
// Conciliación bancaria (roadmap Asistente Contable, Fase 5) — mismos 3 estados que maneja
// el motor de conciliación de Tesorería (Sprint 9.1), solo se traduce la etiqueta aquí.
const RECON_BADGE: Record<string, { label: string; cls: string }> = {
  CONCILIADO: { label: '✓ Conciliado', cls: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400' },
  REGISTRADO: { label: '⏳ Pendiente de conciliar', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  ANULADO: { label: '✕ Anulado', cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400' },
};

function dueInfo(dueDate: string) {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `hace ${-days} día${-days === 1 ? '' : 's'}`, status: 'vencido' as const, cls: 'text-red-600 dark:text-red-400 font-semibold' };
  if (days === 0) return { label: 'vence hoy', status: 'pronto' as const, cls: 'text-amber-600 dark:text-amber-400 font-semibold' };
  if (days <= 7) return { label: `en ${days} día${days === 1 ? '' : 's'}`, status: 'pronto' as const, cls: 'text-amber-600 dark:text-amber-400' };
  return { label: `en ${days} días`, status: 'futuro' as const, cls: 'text-surface-500 dark:text-surface-400' };
}

interface BankAccount { id: string; alias?: string; bankCode: string; accountNumber: string; currency: string; isActive: boolean }

function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  useEffect(() => { treasuryApi.getAccounts().then((r) => setAccounts((r.data ?? []).filter((a: BankAccount) => a.isActive))).catch(() => {}); }, []);
  return accounts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modales
// ─────────────────────────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-700">
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PayModal({ item, onClose, onSubmit }: { item: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
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
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo registrar el pago'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Pagar ${item.numeroDoc || 'documento'}`} subtitle={item.supplierName} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto (saldo pendiente: {money(item.balance)})</label>
          <input type="number" step="0.01" min="0.01" max={item.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
          {isPartial && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Pago parcial — quedará un saldo de {money(item.balance - Number(amount || 0))}.</p>}
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
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Registrando…' : 'Confirmar pago'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ScheduleModal({ item, onClose, onSubmit }: { item: any; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const accounts = useBankAccounts();
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(item.balance.toFixed(2)));
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0) || n > item.balance + 0.005) { setError('El monto debe ser mayor a cero y no exceder el saldo pendiente'); return; }
    if (!scheduledDate) { setError('La fecha de programación es obligatoria'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ scheduledDate, amount: n, bankAccountId: bankAccountId || undefined, notes: notes || undefined }); onClose(); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo programar el pago'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Programar pago · ${item.numeroDoc || 'documento'}`} subtitle={item.supplierName} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Fecha de pago</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Monto (saldo: {money(item.balance)})</label>
            <input type="number" step="0.01" min="0.01" max={item.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Cuenta bancaria</label>
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
            <option value="">Sin definir aún</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias || `${a.bankCode} · ${a.accountNumber}`} ({a.currency})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Observación (opcional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo, acuerdo con el proveedor…" className={inputCls} />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Programando…' : 'Programar pago'}</button>
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
    <ModalShell title={`Ajustar saldo · ${item.numeroDoc || 'documento'}`} subtitle="Cancela el saldo sin mover caja/bancos — el proveedor condona la diferencia." onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-600 dark:text-surface-400">
          Genera un asiento <b>DR Cuentas por pagar / CR Otras rentas</b>. Úsalo para redondeos o descuentos de último momento — no para condonar deuda real sin respaldo.
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto a ajustar (saldo: {money(item.balance)})</label>
          <input type="number" step="0.01" min="0.01" max={item.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Motivo (obligatorio)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Redondeo, descuento por pronto pago no facturado…" className={inputCls} />
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

function BatchScheduleModal({ items, onClose, onSubmit }: { items: any[]; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const accounts = useBankAccounts();
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bankAccountId, setBankAccountId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const total = items.reduce((s, i) => s + i.balance, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) { setError('La fecha de programación es obligatoria'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ scheduledDate, bankAccountId: bankAccountId || undefined }); onClose(); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo programar el lote'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Programar ${items.length} pago${items.length === 1 ? '' : 's'} en lote`} subtitle={`Total ${money(total)} — cada uno se agenda por su saldo completo`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="max-h-32 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg divide-y divide-surface-100 dark:divide-surface-700">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between px-3 py-1.5 text-xs">
              <span className="text-surface-600 dark:text-surface-300 truncate">{i.numeroDoc} · {i.supplierName}</span>
              <span className="font-mono text-surface-900 dark:text-white">{money(i.balance)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Fecha de pago</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Cuenta bancaria</label>
            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
              <option value="">Sin definir aún</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias || `${a.bankCode} · ${a.accountNumber}`}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Programando…' : `Programar ${items.length}`}</button>
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
    if (!lineId) { setError('Selecciona la línea a corregir'); return; }
    if (!toAccountCode) { setError('Selecciona la cuenta correcta'); return; }
    if (toAccountCode === line?.accountCode) { setError('La cuenta destino es igual a la actual'); return; }
    if (!reason.trim()) { setError('El motivo es obligatorio (queda en el asiento correctivo)'); return; }
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
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Se registró como gasto general; corresponde a…" className={inputCls} />
        </div>
        {line && toAccountCode && (
          <div className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs font-mono text-surface-600 dark:text-surface-400 space-y-0.5">
            <div>DR/CR {toAccountCode} — {money(Math.max(line.debit, line.credit))}</div>
            <div>DR/CR {line.accountCode} — {money(Math.max(line.debit, line.credit))} (reverso)</div>
          </div>
        )}
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
// Panel de detalle
// ─────────────────────────────────────────────────────────────────────────────

function DetailPanel({ item, canPay, onAction, refreshKey }: {
  item: any; canPay: boolean; onAction: (kind: string, payload?: any) => void; refreshKey: number;
}) {
  const toast = useToast();
  const [statement, setStatement] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [unlinkedNc, setUnlinkedNc] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    Promise.all([
      item.supplierId ? financialApi.getSupplierStatement(item.supplierId) : Promise.resolve({ data: null }),
      financialApi.getJournalEntries({ entityType: 'SRI_DOCUMENT', entityId: item.id }),
      item.supplierId ? financialApi.getUnlinkedCreditNotes(item.supplierId) : Promise.resolve({ data: [] }),
      financialApi.getApReconciliation(item.id).catch(() => ({ data: [] })),
    ]).then(([st, je, nc, rec]) => {
      setStatement(st.data);
      setEntries(je.data ?? []);
      setUnlinkedNc(nc.data ?? []);
      setReconciliation(rec.data ?? []);
    }).finally(() => setLoading(false));
  }, [item?.id, refreshKey]);

  const applyCreditNote = async (creditNoteId: string) => {
    try {
      await financialApi.linkCreditNote(creditNoteId, item.id);
      toast.success('Nota de crédito aplicada', '✓');
      onAction('refresh');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo aplicar la nota de crédito'); }
  };

  const recentEntries = useMemo(() => (statement?.entries ?? []).slice(-5).reverse(), [statement]);

  if (!item) {
    const capabilities = [
      { icon: CreditCard, label: 'Pagar (total o parcial)', desc: 'con asiento y movimiento bancario automáticos' },
      { icon: CalendarClock, label: 'Programar el pago', desc: 'agenda una fecha sin ejecutarlo aún' },
      { icon: Scissors, label: 'Ajustar el saldo', desc: 'cierra un residuo pequeño sin mover caja' },
      { icon: Layers, label: 'Aplicar una nota de crédito', desc: 'enlázala manualmente a la factura correcta' },
      { icon: GitPullRequestArrow, label: 'Reclasificar una cuenta', desc: 'corrige un mal registro sin editar el asiento' },
    ];
    return (
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Selecciona un documento de la cola</p>
        <p className="text-xs text-surface-400 mb-4">Desde aquí vas a poder:</p>
        <div className="space-y-3">
          {capabilities.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5">
              <c.icon className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-surface-700 dark:text-surface-300">{c.label}</p>
                <p className="text-[11px] text-surface-400">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-surface-900 dark:text-white">Detalle del documento</h2>
        <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${LEVEL_BADGE[item.priority.level]}`}>{item.priority.level} · {item.priority.score}</span>
      </div>

      <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        <div>
          <p className="font-mono text-xs text-brand-600 dark:text-brand-400 font-medium">{item.numeroDoc || '—'}</p>
          <p className="font-semibold text-surface-900 dark:text-white">{item.supplierName || 'Sin proveedor asignado'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[10px] uppercase tracking-wide text-surface-400">Vence</p><p className={`font-mono font-medium ${dueInfo(item.dueDate).cls}`}>{fmtDate(item.dueDate)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-surface-400">Saldo pendiente</p><p className="font-mono font-bold text-red-600 dark:text-red-400">{money(item.balance)}</p></div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Por qué se priorizó así</p>
          <div className="space-y-1.5">
            {item.priority.breakdown.map((b: any) => (
              <div key={b.factor}>
                <div className="flex justify-between text-[11px] text-surface-500"><span>{b.factor.replace('_', ' ')}</span><span className="font-mono">{b.score}/100</span></div>
                <div className="h-1 rounded bg-surface-100 dark:bg-surface-700 overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${b.score}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        {statement && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Estado de cuenta (últimos movimientos)</p>
            <div className="space-y-1.5">
              {recentEntries.length === 0 && <p className="text-xs text-surface-400">Sin movimientos previos.</p>}
              {recentEntries.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-surface-500 dark:text-surface-400 truncate max-w-[60%]">{e.description}</span>
                  <span className={`font-mono ${e.type === 'PAGO' ? 'text-green-600 dark:text-green-400' : e.type === 'NOTA_CREDITO' ? 'text-blue-600 dark:text-blue-400' : 'text-surface-700 dark:text-surface-300'}`}>
                    {e.debit > 0 ? money(e.debit) : `−${money(e.credit)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && unlinkedNc.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Notas de crédito disponibles del proveedor</p>
            <div className="space-y-1.5">
              {unlinkedNc.map((nc: any) => (
                <div key={nc.id} className="flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/50 rounded-lg px-2.5 py-1.5">
                  <div className="text-xs">
                    <span className="font-mono text-blue-700 dark:text-blue-400">{nc.numeroDoc}</span>
                    <span className="text-surface-500 dark:text-surface-400"> · {money(nc.total)}</span>
                  </div>
                  {canPay && <button onClick={() => applyCreditNote(nc.id)} className="text-[11px] px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium whitespace-nowrap">Aplicar aquí</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-1.5">Asiento contable</p>
            {entries.map((entry: any) => (
              <div key={entry.id} className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden mb-1.5">
                <div className="bg-surface-50 dark:bg-surface-900/50 px-2.5 py-1.5 text-xs font-mono text-surface-600 dark:text-surface-400">{entry.entryNumber} · {entry.description}</div>
                <div className="divide-y divide-surface-100 dark:divide-surface-700">
                  {entry.lines.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                      <span className="text-surface-600 dark:text-surface-400 truncate max-w-[55%]"><span className="font-mono text-[10px] text-surface-400 mr-1">{l.accountCode}</span>{l.accountName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{l.debit > 0 ? money(l.debit) : money(l.credit)}</span>
                        {canPay && (
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

        {canPay && (
          <div className="space-y-2 pt-1">
            <button onClick={() => onAction('pay')} className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" /> Pagar ahora</button>
            <button onClick={() => onAction('schedule')} className="w-full py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-center gap-2"><CalendarClock className="w-4 h-4" /> Programar pago</button>
            <button onClick={() => onAction('writeoff')} className="w-full py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-center gap-2"><Scissors className="w-4 h-4" /> Ajustar saldo</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesa de trabajo
// ─────────────────────────────────────────────────────────────────────────────

type Filter = 'todos' | 'vencido' | 'pronto';

// Kanban de solo lectura agrupado por urgencia (mismo criterio que los filtros de arriba,
// dueInfo() por fecha de vencimiento) — no hay una transición de estado real que "arrastrar":
// pagar/programar exigen datos (monto, cuenta, método) y ya tienen su propio modal.
const AP_KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'vencido', label: 'Vencido', droppable: false, hint: 'Clasificación automática por fecha de vencimiento' },
  { id: 'pronto', label: 'Vence pronto', droppable: false, hint: 'Clasificación automática por fecha de vencimiento' },
  { id: 'futuro', label: 'Al día', droppable: false, hint: 'Clasificación automática por fecha de vencimiento' },
];

export default function CxPWorkbench({ canPay }: { canPay: boolean }) {
  const toast = useToast();
  const [kpis, setKpis] = useState<any>(null);
  const [priority, setPriority] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduledProcessing, setScheduledProcessing] = useState(false);

  const [payTarget, setPayTarget] = useState<any>(null);
  const [scheduleTarget, setScheduleTarget] = useState<any>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<any>(null);
  const [batchScheduleOpen, setBatchScheduleOpen] = useState(false);
  const [reclassifyEntry, setReclassifyEntry] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      financialApi.getApKpis().then((r) => setKpis(r.data)).catch(() => setKpis(null)),
      financialApi.getPaymentPriority().then((r) => setPriority(r.data)).catch(() => setPriority(null)),
      financialApi.listScheduledPayments('SCHEDULED').then((r) => setScheduled(r.data)).catch(() => setScheduled([])),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [refreshKey]);

  const items = priority?.items ?? [];
  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'todos') list = list.filter((i: any) => dueInfo(i.dueDate).status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i: any) => (i.numeroDoc ?? '').toLowerCase().includes(q) || (i.supplierName ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    todos: items.length,
    vencido: items.filter((i: any) => dueInfo(i.dueDate).status === 'vencido').length,
    pronto: items.filter((i: any) => dueInfo(i.dueDate).status === 'pronto').length,
  }), [items]);

  const selected = items.find((i: any) => i.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => { if (!selectedId && filtered[0]) setSelectedId(filtered[0].id); }, [filtered, selectedId]);

  const toggleChecked = (id: string) => setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const checkedItems = items.filter((i: any) => checked.has(i.id));

  const refreshAll = () => setRefreshKey((k) => k + 1);

  const handlePay = async (data: any) => { await financialApi.payPayable(payTarget.id, data); toast.success('Pago registrado', '✓'); refreshAll(); };
  const handleSchedule = async (data: any) => { await financialApi.schedulePayment(scheduleTarget.id, data); toast.success('Pago programado', '📅'); refreshAll(); };
  const handleWriteOff = async (data: any) => { await financialApi.writeOffPayable(writeOffTarget.id, data); toast.success('Ajuste registrado', '✓'); refreshAll(); };
  const handleReclassify = async (data: any) => { await financialApi.reclassifyEntry(data); toast.success('Cuenta reclasificada', '✓'); refreshAll(); };
  const handleBatchSchedule = async (data: { scheduledDate: string; bankAccountId?: string }) => {
    const results = await Promise.allSettled(checkedItems.map((i: any) =>
      financialApi.schedulePayment(i.id, { scheduledDate: data.scheduledDate, amount: i.balance, bankAccountId: data.bankAccountId })));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    if (ok > 0) toast.success(`${ok} pago(s) programado(s)`, '📅');
    if (fail > 0) toast.error(`${fail} no se pudieron programar`);
    setChecked(new Set());
    refreshAll();
  };

  const onDetailAction = (kind: string, payload?: any) => {
    if (kind === 'pay') setPayTarget(selected);
    else if (kind === 'schedule') setScheduleTarget(selected);
    else if (kind === 'writeoff') setWriteOffTarget(selected);
    else if (kind === 'reclassify') setReclassifyEntry(payload.entry);
    else if (kind === 'refresh') refreshAll();
  };

  const processScheduledNow = async () => {
    setScheduledProcessing(true);
    try {
      const r = await financialApi.processScheduledPayments();
      const { processed, failed } = r.data;
      if (processed.length > 0) toast.success(`${processed.length} pago(s) procesado(s)`, '✓');
      if (failed.length > 0) toast.error(`${failed.length} no se pudieron procesar`);
      refreshAll();
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo procesar el lote'); }
    finally { setScheduledProcessing(false); }
  };
  const cancelScheduledRow = async (id: string) => {
    try { await financialApi.cancelScheduledPayment(id); toast.success('Programación cancelada', '✓'); refreshAll(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo cancelar'); }
  };
  const dueTodayOrPast = scheduled.filter((r) => new Date(r.scheduledDate).getTime() <= Date.now());

  if (loading && !priority) {
    return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Franja de métricas */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft flex flex-wrap divide-x divide-surface-100 dark:divide-surface-700 overflow-hidden">
        {[
          { lbl: 'Por pagar', val: kpis ? money(kpis.totalPayable) : '—' },
          { lbl: 'Vencido', val: kpis ? money(kpis.overdue) : '—', cls: 'text-red-600 dark:text-red-400' },
          { lbl: 'Vence en 7 días', val: kpis ? money(kpis.dueNext7) : '—', cls: 'text-amber-600 dark:text-amber-400' },
          { lbl: 'DPO', val: kpis ? `${kpis.dpo} días` : '—' },
        ].map((m) => (
          <div key={m.lbl} className="flex-1 min-w-[140px] px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">{m.lbl}</p>
            <p className={`font-mono text-lg font-bold ${m.cls ?? 'text-surface-900 dark:text-white'}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Barra de herramientas */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar documento o proveedor…" className={`pl-9 ${inputCls}`} />
        </div>
        <div className="flex gap-1.5">
          {(['todos', 'vencido', 'pronto'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-2 rounded-full border flex items-center gap-1.5 ${filter === f ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 text-brand-700 dark:text-brand-400' : 'border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'}`}>
              {f === 'todos' ? 'Todos' : f === 'vencido' ? 'Vencidos' : 'Vence pronto'}
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
        <Link to="/sri" className="text-xs font-medium px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white flex items-center gap-1.5 whitespace-nowrap">
          <FileUp className="w-3.5 h-3.5" /> Registrar factura de compra
        </Link>
      </div>

      {view === 'kanban' && filtered.length > 0 && (
        <KanbanBoard
          columns={AP_KANBAN_COLUMNS}
          items={filtered}
          getId={(i: any) => i.id}
          getColumnId={(i: any) => dueInfo(i.dueDate).status}
          onMove={() => { /* de solo lectura: ver comentario en AP_KANBAN_COLUMNS */ }}
          emptyLabel="Sin documentos"
          renderCard={(item: any) => (
            <div onClick={() => setSelectedId(item.id)}
              className={`bg-white dark:bg-surface-900 rounded-lg border p-3 shadow-sm cursor-pointer ${selected?.id === item.id ? 'border-brand-400 ring-1 ring-brand-400' : 'border-surface-200 dark:border-surface-700'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400">{item.numeroDoc || '—'}</span>
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${LEVEL_BADGE[item.priority.level]}`}>{item.priority.level}</span>
              </div>
              <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 truncate">{item.supplierName || 'Sin proveedor'}</p>
              <p className="font-mono text-sm text-red-600 dark:text-red-400 mb-2">{money(item.balance)}</p>
              {canPay && (
                <div className="flex gap-1.5">
                  <button title="Pagar ahora" onClick={(e) => { e.stopPropagation(); setPayTarget(item); }} className="flex-1 text-xs py-1 rounded-md border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:text-green-600 hover:border-green-400">Pagar</button>
                  <button title="Programar" onClick={(e) => { e.stopPropagation(); setScheduleTarget(item); }} className="flex-1 text-xs py-1 rounded-md border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:text-brand-600 hover:border-brand-400">Programar</button>
                </div>
              )}
            </div>
          )}
        />
      )}

      {/* Mesa de trabajo: cola + detalle */}
      {view === 'list' && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
            <div className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
              <p className="text-xs font-semibold text-surface-500">Cola de trabajo — ordenada por urgencia</p>
              <p className="text-[11px] text-surface-400">clic para ver detalle · ▾ para el desglose</p>
            </div>
            {filtered.length === 0 && items.length === 0 ? (
              <div className="px-6 py-10">
                <div className="max-w-md mx-auto text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-500 flex items-center justify-center mx-auto"><Layers className="w-6 h-6" /></div>
                  <div>
                    <p className="font-semibold text-surface-900 dark:text-white">Aún no hay facturas de compra por pagar</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                      Esta mesa de trabajo se llena sola: cuando confirmas una factura de compra en <b>Documentos SRI</b>,
                      aparece aquí ordenada por urgencia real (vencimiento, importancia del proveedor, monto y caja
                      proyectada) — lista para pagar, programar, ajustar o aplicar una nota de crédito.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                    <Link to="/sri" className="text-sm font-medium px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white inline-flex items-center justify-center gap-2">
                      <FileUp className="w-4 h-4" /> Registrar factura de compra
                    </Link>
                    <Link to="/purchases/suppliers" className="text-sm font-medium px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 inline-flex items-center justify-center gap-2">
                      Ver proveedores <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-surface-400">No hay documentos que coincidan con el filtro.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-[10px] uppercase">
                  <th className="w-8 px-2 py-2"></th><th className="w-1"></th><th className="text-left px-2 py-2">Prioridad</th>
                  <th className="text-left px-2 py-2">Documento</th><th className="text-left px-2 py-2">Vence</th>
                  <th className="text-right px-3 py-2">Saldo</th><th className="w-20 px-2 py-2"></th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {filtered.map((item: any) => {
                    const due = dueInfo(item.dueDate);
                    const isSel = selected?.id === item.id;
                    return (
                      <Fragment key={item.id}>
                        <tr onClick={() => setSelectedId(item.id)}
                          className={`cursor-pointer ${isSel ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-surface-50 dark:hover:bg-surface-700/30'}`}>
                          <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggleChecked(item.id)} className="rounded border-surface-300 dark:border-surface-600" />
                          </td>
                          <td className="p-0"><div className={`w-1 self-stretch min-h-[40px] ${LEVEL_STRIPE[item.priority.level]}`} /></td>
                          <td className="px-2 py-2.5">
                            <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${LEVEL_BADGE[item.priority.level]}`}>{item.priority.level} · {item.priority.score}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <button onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === item.id ? null : item.id); }} className="flex items-center gap-1 text-left hover:underline">
                              <ChevronDown className={`w-3 h-3 text-surface-400 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} />
                              <span>
                                <span className="font-mono text-xs text-brand-600 dark:text-brand-400 block">{item.numeroDoc || '—'}</span>
                                <span className="text-xs text-surface-500 dark:text-surface-400">{item.supplierName || 'Sin proveedor'}</span>
                              </span>
                            </button>
                          </td>
                          <td className={`px-2 py-2.5 text-xs ${due.cls}`}>{due.label}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-surface-900 dark:text-white">{money(item.balance)}</td>
                          <td className="px-2 py-2.5">
                            {canPay && (
                              <div className="flex gap-1 justify-end">
                                <button title="Pagar ahora" onClick={(e) => { e.stopPropagation(); setPayTarget(item); }} className="w-7 h-7 rounded-md border border-surface-200 dark:border-surface-600 flex items-center justify-center text-surface-500 hover:text-green-600 hover:border-green-400"><CreditCard className="w-3.5 h-3.5" /></button>
                                <button title="Programar" onClick={(e) => { e.stopPropagation(); setScheduleTarget(item); }} className="w-7 h-7 rounded-md border border-surface-200 dark:border-surface-600 flex items-center justify-center text-surface-500 hover:text-brand-600 hover:border-brand-400"><CalendarClock className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {expandedId === item.id && (
                          <tr><td colSpan={7} className="bg-surface-50 dark:bg-surface-900/40 px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              {item.priority.breakdown.map((b: any) => (
                                <div key={b.factor}>
                                  <p className="font-medium text-surface-700 dark:text-surface-300">{b.factor.replace('_', ' ')} · {b.score}/100</p>
                                  <p className="text-surface-500 dark:text-surface-400">{b.detail}</p>
                                </div>
                              ))}
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

          {/* Programados */}
          {scheduled.length > 0 && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-surface-500">Programados <span className="font-normal text-surface-400">({scheduled.length} · aún no ejecutados)</span></p>
                {canPay && dueTodayOrPast.length > 0 && (
                  <button onClick={processScheduledNow} disabled={scheduledProcessing}
                    className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
                    {scheduledProcessing ? 'Procesando…' : `Procesar todo (${dueTodayOrPast.length})`}
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {scheduled.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2"><span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${LEVEL_BADGE[r.priorityLevel]}`}>{r.priorityLevel}</span></td>
                      <td className="px-2 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">{r.sriDocument?.numeroDoc || '—'}</td>
                      <td className="px-2 py-2 text-xs text-surface-600 dark:text-surface-300 truncate max-w-[160px]">{r.sriDocument?.supplier?.razonSocial || r.sriDocument?.supplier?.name}</td>
                      <td className="px-2 py-2 text-xs text-surface-500">{fmtDate(r.scheduledDate)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-semibold">{money(r.amount)}</td>
                      <td className="px-2 py-2 text-right">{canPay && <button onClick={() => cancelScheduledRow(r.id)} className="text-[11px] px-2 py-1 border border-surface-300 dark:border-surface-600 rounded-md text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DetailPanel item={selected} canPay={canPay} onAction={onDetailAction} refreshKey={refreshKey} />
      </div>
      )}

      {/* Barra de selección múltiple */}
      {checked.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-5 z-30 bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{checked.size} seleccionado{checked.size === 1 ? '' : 's'} · {money(checkedItems.reduce((s: number, i: any) => s + i.balance, 0))}</span>
          <button onClick={() => setChecked(new Set())} className="text-xs underline opacity-70 hover:opacity-100">limpiar</button>
          {canPay && <button onClick={() => setBatchScheduleOpen(true)} className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">Programar en lote</button>}
        </div>
      )}

      {payTarget && <PayModal item={payTarget} onClose={() => setPayTarget(null)} onSubmit={handlePay} />}
      {scheduleTarget && <ScheduleModal item={scheduleTarget} onClose={() => setScheduleTarget(null)} onSubmit={handleSchedule} />}
      {writeOffTarget && <WriteOffModal item={writeOffTarget} onClose={() => setWriteOffTarget(null)} onSubmit={handleWriteOff} />}
      {batchScheduleOpen && <BatchScheduleModal items={checkedItems} onClose={() => setBatchScheduleOpen(false)} onSubmit={handleBatchSchedule} />}
      {reclassifyEntry && <ReclassifyModal entry={reclassifyEntry} onClose={() => setReclassifyEntry(null)} onSubmit={handleReclassify} />}
    </div>
  );
}
