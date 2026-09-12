import { useEffect, useState } from 'react';
import { treasuryApi, TransactionPayload } from '../../api/treasury';
import { useToast } from '../../components/ui/Toast';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Landmark, ArrowDownCircle, ArrowUpCircle, TrendingUp } from 'lucide-react';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es', { timeZone: 'UTC' });

const inputCls = 'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs text-surface-500 mb-1';

const KIND_LABELS: Record<string, string> = {
  AP_INVOICE: '🏭 Proveedor', PAYROLL: '💵 Nómina', TAX_SRI: '🏛️ SRI', TAX_IESS: '🏥 IESS',
};
const METHOD_LABELS: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia', CHEQUE: 'Cheque', EFECTIVO: 'Efectivo', SWIFT: 'SWIFT (exterior)', TARJETA: 'Tarjeta',
};
const TABS = ['📊 Resumen', '📤 Pagos', '📥 Cobros', '🏦 Cuentas', '📜 Movimientos', '🔁 Conciliación'] as const;

/**
 * Conciliación bancaria en dos niveles:
 *  - AUTOMÁTICA al importar el extracto (monto+fecha ±3 días o referencia idéntica).
 *  - SEMIAUTOMÁTICA: sugerencias con score que el usuario confirma con un clic.
 * Import de extracto (B2): archivo CSV con preset por banco (detecta columnas por encabezado)
 * u OFX/QFX, o pegar texto en el formato genérico fecha;descripción;referencia;monto.
 */
function ReconciliationPanel({ accounts, onChanged }: { accounts: any[]; onChanged: () => void }) {
  const toast = useToast();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [status, setStatus] = useState<any>(null);
  const [csvText, setCsvText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<Array<{ key: string; label: string }>>([{ key: 'GENERICO', label: 'Genérico (pegar texto)' }]);
  const [preset, setPreset] = useState('GENERICO');
  const [fileName, setFileName] = useState('');

  const loadStatus = (id: string) => {
    if (!id) return;
    treasuryApi.getReconciliation(id).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  };
  useEffect(() => { loadStatus(accountId); /* eslint-disable-next-line */ }, [accountId]);
  useEffect(() => {
    treasuryApi.getStatementPresets().then((r) => setPresets(r.data)).catch(() => {});
  }, []);

  async function handleFile(file: File) {
    setFileName(file.name);
    const isOfx = /\.(ofx|qfx)$/i.test(file.name);
    const format = isOfx ? 'OFX' : preset;
    const text = await file.text();
    setBusy(true);
    try {
      const { data } = await treasuryApi.importStatementFile(accountId, format, text);
      toast.success(`${data.imported} líneas importadas · ${data.autoMatched} conciliadas automáticamente · ${data.pending} pendientes` +
        (data.parsedSkipped > 0 ? ` · ${data.parsedSkipped} línea(s) ignoradas (no reconocidas)` : ''));
      setShowImport(false); setFileName('');
      loadStatus(accountId); onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al importar el archivo');
    } finally { setBusy(false); }
  }

  const parseCsv = (text: string) =>
    text.split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.toLowerCase().startsWith('fecha'))
      .map((l) => {
        const parts = l.split(/[;\t]/).map((x) => x?.trim());
        // fecha;descripción;referencia;monto — la referencia puede venir vacía
        const [date, description, reference, amount] = parts.length >= 4 ? parts : [parts[0], parts[1], '', parts[2]];
        return { date, description, reference: reference || undefined, amount: Number(String(amount).replace(',', '.')) };
      })
      .filter((r) => r.date && Number.isFinite(r.amount) && r.amount !== 0);

  const importCsv = async () => {
    const lines = parseCsv(csvText);
    if (lines.length === 0) { toast.error('Sin líneas válidas. Formato: fecha;descripción;referencia;monto'); return; }
    setBusy(true);
    try {
      const { data } = await treasuryApi.importStatement(accountId, lines);
      toast.success(`${data.imported} líneas importadas · ${data.autoMatched} conciliadas automáticamente · ${data.pending} pendientes`);
      setCsvText(''); setShowImport(false);
      loadStatus(accountId); onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al importar el extracto');
    } finally { setBusy(false); }
  };

  const confirm = async (lineId: string, transactionId: string) => {
    try {
      await treasuryApi.confirmMatch(lineId, transactionId);
      toast.success('Línea conciliada');
      loadStatus(accountId); onChanged();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'No se pudo conciliar'); }
  };

  const createTx = async (lineId: string) => {
    try {
      await treasuryApi.createFromLine(lineId);
      toast.success('Movimiento creado desde el extracto (nace conciliado)');
      loadStatus(accountId); onChanged();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'No se pudo crear'); }
  };

  if (accounts.length === 0) return <p className="text-center text-surface-400 text-sm py-10">Registra primero una cuenta bancaria en la pestaña 🏦 Cuentas.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 flex items-end gap-3 flex-wrap shadow-soft">
        <div>
          <label className={labelCls}>Cuenta bancaria</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias || a.bankName}</option>)}
          </select>
        </div>
        {status && (
          <div className="flex gap-4 text-xs text-surface-500 pb-1">
            <span>✅ {status.stats.conciliadas} conciliadas</span>
            <span>⏳ {status.stats.pendientes} pendientes del extracto</span>
            <span>➕ {status.stats.creadas} creadas</span>
            <span>🏦 {status.stats.movimientosSinConciliar} movimientos sin conciliar</span>
          </div>
        )}
        <div className="flex-1" />
        <button onClick={() => setShowImport((v) => !v)} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
          📥 Importar extracto
        </button>
      </div>

      {showImport && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 space-y-4">
          <div>
            <label className={labelCls}>Formato del banco</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className={`${inputCls} w-full max-w-xs`}>
              {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <p className="text-xs text-surface-400 mt-1">
              Detecta las columnas del CSV real del banco por su encabezado (Pichincha, Produbanco...) — si tu banco no
              está en la lista, usa "Genérico" y pega el extracto con el formato de abajo. También acepta archivos .ofx/.qfx directamente.
            </p>
          </div>

          <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-5 text-center">
            <input type="file" accept=".csv,.txt,.ofx,.qfx" id="statement-file"
              className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <label htmlFor="statement-file" className="cursor-pointer text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
              📄 Elegir archivo del extracto (CSV, OFX o QFX)
            </label>
            {fileName && <p className="text-xs text-surface-400 mt-1">{fileName}</p>}
            {busy && <p className="text-xs text-surface-500 mt-2">Procesando…</p>}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">O pega el texto manualmente (formato genérico)</summary>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-surface-500">
                Una línea por movimiento; monto con signo:
                <code className="block bg-surface-100 dark:bg-surface-900 rounded px-2 py-1 mt-1">fecha;descripción;referencia;monto → 2026-07-09;PAGO IESS;Planilla 07-2026;-690.76</code>
              </p>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={5}
                className={`${inputCls} w-full font-mono text-xs`} placeholder={'2026-07-09;PAGO PLANILLA IESS;Planilla 07-2026;-690.76\n2026-07-10;COMISION MANEJO CTA;;-4.50'} />
              <div className="flex justify-end">
                <button onClick={importCsv} disabled={busy || !csvText.trim()} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
                  {busy ? 'Conciliando…' : 'Importar texto pegado'}
                </button>
              </div>
            </div>
          </details>

          <div className="flex justify-end">
            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cerrar</button>
          </div>
        </div>
      )}

      {status && status.pending.length > 0 && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft divide-y divide-surface-100 dark:divide-surface-700">
          <div className="px-4 py-3">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white">Líneas pendientes del extracto</h3>
            <p className="text-xs text-surface-400">Confirma una sugerencia (semiautomático) o crea el movimiento si no existe en el sistema (comisiones, intereses…)</p>
          </div>
          {status.pending.map((line: any) => (
            <div key={line.id} className="px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-surface-500 whitespace-nowrap">{fecha(line.date)}</span>
                <span className="font-medium text-surface-800 dark:text-white flex-1">{line.description}</span>
                {line.reference && <span className="text-xs text-surface-400">Ref. {line.reference}</span>}
                <span className={`font-mono font-semibold ${line.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {line.amount >= 0 ? '+' : '−'}{money(Math.abs(line.amount))}
                </span>
                <button onClick={() => createTx(line.id)} className="text-xs px-3 py-1.5 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
                  ➕ Crear movimiento
                </button>
              </div>
              {line.suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {line.suggestions.map((s: any) => (
                    <div key={s.transactionId} className="flex items-center gap-3 bg-surface-50 dark:bg-surface-900/40 rounded-lg px-3 py-2 text-sm">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono">{s.score}%</span>
                      <span className="text-surface-600 dark:text-surface-300 flex-1">
                        {s.transaction.beneficiary ?? 'Movimiento'} · {new Date(s.transaction.date).toLocaleDateString('es')}
                        {s.transaction.reference ? ` · Ref. ${s.transaction.reference}` : ''}
                      </span>
                      <span className="text-xs text-surface-400">{s.reason}</span>
                      <button onClick={() => confirm(line.id, s.transactionId)}
                        className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                        ✓ Conciliar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {status && status.pending.length === 0 && (
        <p className="text-center text-surface-400 text-sm py-8">✅ Sin líneas pendientes. Importa un extracto para conciliar.</p>
      )}
    </div>
  );
}

export default function TesoreriaPage() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>('📊 Resumen');
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de pago/cobro
  const [payModal, setPayModal] = useState<null | { mode: 'PAGO' | 'COBRO'; item: any }>(null);
  const [txForm, setTxForm] = useState({ bankAccountId: '', method: 'TRANSFERENCIA', reference: '', swiftCode: '', amount: '' });
  const [busy, setBusy] = useState(false);

  // Formulario de nueva cuenta
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accForm, setAccForm] = useState({ bankCode: 'PICHINCHA', accountNumber: '', accountType: 'CORRIENTE', alias: '', swiftCode: '', openingBalance: '0', isForeign: false });

  const load = () => {
    setLoading(true);
    Promise.all([treasuryApi.getSummary(), treasuryApi.getTransactions(), treasuryApi.getBankCatalog()])
      .then(([s, t, c]) => { setSummary(s.data); setTransactions(t.data); setCatalog(c.data); })
      .catch(() => toast.error('Error al cargar tesorería'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const accounts = summary?.accounts ?? [];
  const activeAccounts = accounts.filter((a: any) => a.isActive);

  const openPay = (mode: 'PAGO' | 'COBRO', item: any) => {
    setTxForm({ bankAccountId: activeAccounts[0]?.id ?? '', method: 'TRANSFERENCIA', reference: '', swiftCode: '', amount: String(item.amount) });
    setPayModal({ mode, item });
  };

  const executeTx = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!payModal) return;
    setBusy(true);
    try {
      const { mode, item } = payModal;
      const payload: TransactionPayload = {
        bankAccountId: txForm.bankAccountId,
        type: mode === 'PAGO' ? 'EGRESO' : 'INGRESO',
        method: txForm.method,
        amount: Number(txForm.amount),
        reference: txForm.reference || undefined,
        swiftCode: txForm.swiftCode || undefined,
        beneficiary: mode === 'PAGO' ? item.beneficiary : item.customer,
        sourceType: mode === 'COBRO' ? 'AR_INVOICE' : item.kind,
        sourceId: item.kind === 'TAX_SRI' || item.kind === 'TAX_IESS' ? undefined : item.id,
      };
      await treasuryApi.registerTransaction(payload);
      toast.success(`${mode === 'PAGO' ? 'Pago' : 'Cobro'} registrado — movimiento y asiento generados`);
      setPayModal(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo registrar');
    } finally { setBusy(false); }
  };

  const saveAccount = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    try {
      await treasuryApi.createAccount({
        bankCode: accForm.bankCode, accountNumber: accForm.accountNumber, accountType: accForm.accountType,
        alias: accForm.alias || undefined, swiftCode: accForm.swiftCode || undefined,
        openingBalance: Number(accForm.openingBalance || 0), isForeign: accForm.isForeign,
      });
      toast.success('Cuenta bancaria registrada');
      setShowAccountForm(false);
      setAccForm({ bankCode: 'PICHINCHA', accountNumber: '', accountType: 'CORRIENTE', alias: '', swiftCode: '', openingBalance: '0', isForeign: false });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo crear la cuenta');
    } finally { setBusy(false); }
  };

  const selectedBank = catalog.find((b) => b.code === accForm.bankCode);

  return (
    <div className="max-w-6xl">
      {/* Dashboard colapsable */}
      {summary && (
        <CollapsiblePanel id="treasury-dashboard" title="Dashboard de Tesorería" icon={Landmark}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Saldo en bancos" value={money(summary.totalBalance)} icon={<Landmark className="w-5 h-5" />} color="brand" index={0} />
            <StatCard label="Por cobrar (CxC)" value={money(summary.totalReceivable)} icon={<ArrowDownCircle className="w-5 h-5" />} color="emerald" index={1} />
            <StatCard label="Por pagar" value={money(summary.totalPayable)} icon={<ArrowUpCircle className="w-5 h-5" />} color="red" index={2} />
            <StatCard label="Posición neta" value={money(summary.totalBalance + summary.totalReceivable - summary.totalPayable)} icon={<TrendingUp className="w-5 h-5" />} color="purple" index={3} />
          </div>
        </CollapsiblePanel>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏦</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Tesorería</h1>
          <p className="text-sm text-surface-500">Bancos, pagos y cobros integrados con Nómina, CxP, CxC e impuestos (SRI/IESS) · SWIFT para el exterior</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-brand-500 text-white shadow-sm' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}

      {/* ── RESUMEN ── */}
      {!loading && tab === '📊 Resumen' && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Saldo en bancos', value: summary.totalBalance, cls: 'text-surface-900 dark:text-white' },
              { label: 'Por cobrar (CxC)', value: summary.totalReceivable, cls: 'text-green-600 dark:text-green-400' },
              { label: 'Por pagar', value: summary.totalPayable, cls: 'text-red-600 dark:text-red-400' },
              { label: 'Posición neta', value: summary.totalBalance + summary.totalReceivable - summary.totalPayable, cls: 'text-brand-600 dark:text-brand-400' },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
                <p className="text-[11px] text-surface-500 uppercase tracking-wider">{k.label}</p>
                <p className={`text-xl font-bold font-mono ${k.cls}`}>{money(k.value)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <h3 className="font-semibold text-sm text-surface-800 dark:text-white">Flujo de caja proyectado (por vencimientos)</h3>
              <p className="text-xs text-surface-400">Cobros según fechas de venta · pagos según CxP, nómina e impuestos</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Semana</th><th className="text-right px-4 py-2.5">Cobros</th>
                <th className="text-right px-4 py-2.5">Pagos</th><th className="text-right px-4 py-2.5">Neto</th>
                <th className="text-right px-4 py-2.5">Caja proyectada</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {summary.cashflow.map((w: any) => (
                  <tr key={w.week}>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">S{w.week} · {fecha(w.startDate)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-600 dark:text-green-400">{w.inflow > 0 ? `+${money(w.inflow)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">{w.outflow > 0 ? `−${money(w.outflow)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(w.net)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${w.projected < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{money(w.projected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAGOS (obligaciones) ── */}
      {!loading && tab === '📤 Pagos' && summary && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Origen</th><th className="text-left px-4 py-2.5">Obligación</th>
              <th className="text-left px-4 py-2.5">Beneficiario</th><th className="text-center px-4 py-2.5">Vence</th>
              <th className="text-right px-4 py-2.5">Monto</th><th className="text-right px-4 py-2.5" />
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {summary.obligations.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-surface-400">🎉 Sin obligaciones pendientes de pago.</td></tr>}
              {summary.obligations.map((o: any) => (
                <tr key={`${o.kind}-${o.id}`} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">{KIND_LABELS[o.kind] ?? o.kind}</td>
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{o.label}</td>
                  <td className="px-4 py-3 text-surface-500">{o.beneficiary}</td>
                  <td className={`px-4 py-3 text-center text-xs ${o.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-surface-500'}`}>
                    {fecha(o.dueDate)}{o.overdue ? ' ⚠ vencido' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{money(o.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openPay('PAGO', o)} disabled={activeAccounts.length === 0}
                      className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-lg font-medium">
                      💸 Pagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeAccounts.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400 px-4 py-3">Registra primero una cuenta bancaria en la pestaña 🏦 Cuentas.</p>}
        </div>
      )}

      {/* ── COBROS (CxC) ── */}
      {!loading && tab === '📥 Cobros' && summary && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Factura</th><th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-center px-4 py-2.5">Vence</th><th className="text-right px-4 py-2.5">Pendiente</th>
              <th className="text-right px-4 py-2.5" />
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {summary.receivables.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-surface-400">Sin facturas de venta por cobrar.</td></tr>}
              {summary.receivables.map((rcv: any) => (
                <tr key={rcv.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{rcv.label}</td>
                  <td className="px-4 py-3 text-surface-500">{rcv.customer}</td>
                  <td className={`px-4 py-3 text-center text-xs ${rcv.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-surface-500'}`}>
                    {fecha(rcv.dueDate)}{rcv.overdue ? ' ⚠ vencido' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{money(rcv.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openPay('COBRO', rcv)} disabled={activeAccounts.length === 0}
                      className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg font-medium">
                      ✓ Registrar cobro
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CUENTAS BANCARIAS ── */}
      {!loading && tab === '🏦 Cuentas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAccountForm((v) => !v)} className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">+ Nueva cuenta</button>
          </div>
          {showAccountForm && (
            <form onSubmit={saveAccount} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Banco *</label>
                  <select value={accForm.bankCode} onChange={(e) => setAccForm({ ...accForm, bankCode: e.target.value, isForeign: e.target.value === 'EXTRANJERO' })} className={`${inputCls} w-full`}>
                    {catalog.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                  {selectedBank?.swift && <p className="text-[11px] text-surface-400 mt-1">BIC: {selectedBank.swift}</p>}
                </div>
                <div><label className={labelCls}>N.º de cuenta *</label><input required value={accForm.accountNumber} onChange={(e) => setAccForm({ ...accForm, accountNumber: e.target.value })} className={`${inputCls} w-full`} /></div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select value={accForm.accountType} onChange={(e) => setAccForm({ ...accForm, accountType: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="CORRIENTE">Corriente</option><option value="AHORROS">Ahorros</option>
                  </select>
                </div>
                <div><label className={labelCls}>Alias</label><input value={accForm.alias} onChange={(e) => setAccForm({ ...accForm, alias: e.target.value })} className={`${inputCls} w-full`} placeholder="Ej. Pichincha principal" /></div>
                <div><label className={labelCls}>SWIFT/BIC {accForm.isForeign ? '*' : '(opcional)'}</label><input required={accForm.isForeign} value={accForm.swiftCode} onChange={(e) => setAccForm({ ...accForm, swiftCode: e.target.value.toUpperCase() })} className={`${inputCls} w-full`} placeholder={selectedBank?.swift ?? 'AAAABBCC'} /></div>
                <div><label className={labelCls}>Saldo inicial</label><input type="number" step="0.01" value={accForm.openingBalance} onChange={(e) => setAccForm({ ...accForm, openingBalance: e.target.value })} className={`${inputCls} w-full`} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAccountForm(false)} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cancelar</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">Guardar cuenta</button>
              </div>
            </form>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.length === 0 && <p className="text-surface-400 text-sm py-8 text-center md:col-span-2">Sin cuentas bancarias. Registra la primera para empezar a pagar y cobrar.</p>}
            {accounts.map((a: any) => (
              <div key={a.id} className={`bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft ${!a.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-surface-900 dark:text-white">{a.alias || a.bankName}</p>
                    <p className="text-xs text-surface-500">{a.bankName} · {a.accountType === 'CORRIENTE' ? 'Cta. corriente' : 'Ahorros'} · {a.accountNumber}</p>
                    {a.swiftCode && <p className="text-[11px] text-surface-400 font-mono mt-0.5">SWIFT: {a.swiftCode}{a.isForeign ? ' · 🌍 exterior' : ''}</p>}
                  </div>
                  <p className="text-lg font-bold font-mono text-surface-900 dark:text-white">{money(a.balance)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {!loading && tab === '📜 Movimientos' && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Fecha</th><th className="text-left px-4 py-2.5">Cuenta</th>
              <th className="text-left px-4 py-2.5">Detalle</th><th className="text-center px-4 py-2.5">Método</th>
              <th className="text-right px-4 py-2.5">Monto</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {transactions.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-surface-400">Sin movimientos bancarios registrados.</td></tr>}
              {transactions.map((t: any) => (
                <tr key={t.id} className={t.status === 'ANULADO' ? 'opacity-40 line-through' : ''}>
                  <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{t.bankAccount.alias || t.bankAccount.bankName}</td>
                  <td className="px-4 py-3">
                    <p className="text-surface-800 dark:text-white">{t.beneficiary ?? '—'}</p>
                    <p className="text-xs text-surface-400">{t.reference ? `Ref. ${t.reference} · ` : ''}{t.sourceType}{t.swiftCode ? ` · SWIFT ${t.swiftCode}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-surface-500">{METHOD_LABELS[t.method] ?? t.method}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${t.type === 'INGRESO' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {t.type === 'INGRESO' ? '+' : '−'}{money(Number(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CONCILIACIÓN BANCARIA ── */}
      {!loading && tab === '🔁 Conciliación' && (
        <ReconciliationPanel accounts={activeAccounts} onChanged={load} />
      )}

      {/* ── MODAL pagar / cobrar ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <form onSubmit={executeTx} className="bg-white dark:bg-surface-800 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-surface-900 dark:text-white">
              {payModal.mode === 'PAGO' ? '💸 Pagar' : '✓ Registrar cobro'} · {payModal.item.label}
            </h3>
            <p className="text-sm text-surface-500">{payModal.mode === 'PAGO' ? payModal.item.beneficiary : payModal.item.customer} · {money(payModal.item.amount)}</p>
            <div>
              <label className={labelCls}>Cuenta bancaria *</label>
              <select required value={txForm.bankAccountId} onChange={(e) => setTxForm({ ...txForm, bankAccountId: e.target.value })} className={`${inputCls} w-full`}>
                <option value="">Selecciona…</option>
                {activeAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.alias || a.bankName} · {money(a.balance)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Método *</label>
                <select value={txForm.method} onChange={(e) => setTxForm({ ...txForm, method: e.target.value })} className={`${inputCls} w-full`}>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Monto *</label>
                <input required type="number" step="0.01" min="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} className={`${inputCls} w-full`} />
              </div>
            </div>
            {txForm.method === 'SWIFT' && (
              <div>
                <label className={labelCls}>BIC banco destino *</label>
                <input required value={txForm.swiftCode} onChange={(e) => setTxForm({ ...txForm, swiftCode: e.target.value.toUpperCase() })} className={`${inputCls} w-full`} placeholder="Ej. CHASUS33" />
              </div>
            )}
            <div>
              <label className={labelCls}>Referencia (cheque, comprobante, MT103)</label>
              <input value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPayModal(null)} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
                {busy ? 'Procesando…' : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
