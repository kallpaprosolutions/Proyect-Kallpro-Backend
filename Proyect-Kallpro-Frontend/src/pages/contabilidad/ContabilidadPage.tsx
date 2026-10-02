import { ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { financialApi } from '../../api/financial';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useCan } from '../../hooks/useCan';
import { useReasonPrompt, CloseChecklistPanel, AuditTimeline, controlsApi } from '../../components/financial/AccountingControls';
import { downloadClientCsv } from '../../lib/csv';
import BalanceSheet from '../../components/financial/BalanceSheet';
import IncomeStatement from '../../components/financial/IncomeStatement';
import EquityStatement from '../../components/financial/EquityStatement';
import FinancialNotes from '../../components/financial/FinancialNotes';
import ChartOfAccountsTree from '../../components/financial/ChartOfAccountsTree';
import ManualJournalForm from '../../components/financial/ManualJournalForm';
import TaxConfigPanel from '../../components/financial/TaxConfigPanel';
import FiscalConfigPanel from '../../components/financial/FiscalConfigPanel';
import PeriodPicker from '../../components/financial/PeriodPicker';
import Form104OfficialReplica from '../../components/financial/Form104OfficialReplica';
import Form103OfficialReplica from '../../components/financial/Form103OfficialReplica';
import Form101OfficialReplica from '../../components/financial/Form101OfficialReplica';
import PivotView from '../../components/common/PivotView';
import { CuentasPorPagarTab, CuentasPorCobrarTab } from '../../components/financial/ApArTabs';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import {
  BarChart3, BookOpen, Scale, BookText, Droplets, Lock,
  Receipt, Library, Scissors, Settings, ArrowDownCircle,
  ArrowUpCircle, Cog, Building2, Landmark, FileSignature, PieChart, FileBarChart2, LayoutGrid, ShieldCheck,
} from 'lucide-react';

type Sub = 'resumen' | 'reporte' | 'mayor' | 'comprobacion' | 'flujo-efectivo' | 'patrimonio' | 'asientos' | 'pivot' | 'cierres' | 'auditoria' | 'tributario' | 'plan' | 'retenciones' | 'impuestos' | 'cxp' | 'cxc' | 'facturacion-electronica';
const TABS: { key: Sub; label: string; icon: ReactNode; perm: string }[] = [
  { key: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-4 h-4" />, perm: 'view' },
  { key: 'reporte', label: 'Reporte', icon: <FileBarChart2 className="w-4 h-4" />, perm: 'view' },
  { key: 'mayor', label: 'Mayor', icon: <BookOpen className="w-4 h-4" />, perm: 'view' },
  { key: 'comprobacion', label: 'Comprobación', icon: <Scale className="w-4 h-4" />, perm: 'view' },
  { key: 'asientos', label: 'Asientos', icon: <BookText className="w-4 h-4" />, perm: 'view' },
  { key: 'pivot', label: 'Pivot', icon: <LayoutGrid className="w-4 h-4" />, perm: 'view' },
  { key: 'flujo-efectivo', label: 'Flujo de Efectivo', icon: <Droplets className="w-4 h-4" />, perm: 'view' },
  { key: 'patrimonio', label: 'Patrimonio y NIIF', icon: <PieChart className="w-4 h-4" />, perm: 'view' },
  { key: 'cxp', label: 'Cuentas por Pagar', icon: <ArrowUpCircle className="w-4 h-4" />, perm: 'view' },
  { key: 'cxc', label: 'Cuentas por Cobrar', icon: <ArrowDownCircle className="w-4 h-4" />, perm: 'view' },
  { key: 'cierres', label: 'Cierres', icon: <Lock className="w-4 h-4" />, perm: 'view' },
  { key: 'auditoria', label: 'Auditoría', icon: <ShieldCheck className="w-4 h-4" />, perm: 'view' },
  { key: 'tributario', label: 'Declaraciones', icon: <Receipt className="w-4 h-4" />, perm: 'taxes' },
  { key: 'plan', label: 'Plan de Cuentas', icon: <Library className="w-4 h-4" />, perm: 'view' },
  { key: 'retenciones', label: 'Retenciones', icon: <Scissors className="w-4 h-4" />, perm: 'view' },
  { key: 'impuestos', label: 'Impuestos / Config', icon: <Settings className="w-4 h-4" />, perm: 'configure' },
  { key: 'facturacion-electronica', label: 'Facturación Electrónica', icon: <FileSignature className="w-4 h-4" />, perm: 'configure' },
];

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Tablero contable accionable (Sprint 11 — patrón Odoo "12 Por validar → clic") ──
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function ActionCard({ icon, label, count, amount, tone, to, hint }: {
  icon: ReactNode; label: string; count: number; amount?: number;
  tone: 'danger' | 'warning' | 'ok' | 'neutral'; to: string; hint?: string;
}) {
  const tones: Record<string, string> = {
    danger: 'border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600',
    warning: 'border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600',
    ok: 'border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600',
    neutral: 'border-surface-200 dark:border-surface-700 hover:border-brand-400 dark:hover:border-brand-600',
  };
  const countTone: Record<string, string> = {
    danger: 'text-red-600 dark:text-red-400', warning: 'text-amber-600 dark:text-amber-400',
    ok: 'text-green-600 dark:text-green-400', neutral: 'text-surface-900 dark:text-white',
  };
  return (
    <Link to={to}
      className={`bg-white dark:bg-surface-800 rounded-xl p-4 border shadow-soft transition-colors block ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500 uppercase tracking-wider inline-flex items-center gap-1.5">{icon} {label}</span>
        <span className="text-surface-300 dark:text-surface-600 text-sm">→</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${countTone[tone]}`}>{count}</p>
      {amount != null && <p className="text-sm text-surface-500 font-mono">{money(amount)}</p>}
      {hint && <p className="text-xs text-surface-400 mt-0.5">{hint}</p>}
    </Link>
  );
}

function ResumenTab({ onAccountClick }: { onAccountClick?: (code: string) => void }) {
  const [kpis, setKpis] = useState<any>(null);
  const [panel, setPanel] = useState<any>(null);
  useEffect(() => {
    financialApi.getKPIs().then((r) => setKpis(r.data)).catch(() => {});
    financialApi.getAccountingPanel().then((r) => setPanel(r.data)).catch(() => {});
  }, []);

  const periodoLabel = panel
    ? `${MONTHS_SHORT[panel.periodoActual.month - 1]} ${panel.periodoActual.year}`
    : '';

  return (
    <div className="space-y-6">
      {/* Tablero accionable: cada tarjeta lleva a la lista que hay que atender */}
      {panel && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-surface-600 dark:text-surface-300">Pendientes de atención</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              panel.periodoActual.status === 'CLOSED'
                ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
            }`}>
              Período {periodoLabel}: {panel.periodoActual.status === 'CLOSED' ? '🔒 Cerrado' : 'Abierto'}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionCard icon={<Receipt className="w-5 h-5" />} label="SRI por revisar" count={panel.sriPorRevisar.count} amount={panel.sriPorRevisar.total}
              tone={panel.sriPorRevisar.count > 0 ? 'warning' : 'ok'} to="/sri" hint="Facturas de compra" />
            <ActionCard icon={<ArrowDownCircle className="w-5 h-5" />} label="CxC vencidas" count={panel.cxcVencidas.count} amount={panel.cxcVencidas.total}
              tone={panel.cxcVencidas.count > 0 ? 'danger' : 'ok'} to="/finanzas?tab=cartera" hint="Por cobrar" />
            <ActionCard icon={<ArrowUpCircle className="w-5 h-5" />} label="CxP vencidas" count={panel.cxpVencidas.count} amount={panel.cxpVencidas.total}
              tone={panel.cxpVencidas.count > 0 ? 'danger' : 'ok'} to="/finanzas?tab=pagos" hint="Por pagar" />
            <ActionCard icon={<BookText className="w-5 h-5" />} label={`Asientos ${periodoLabel}`} count={panel.asientosMes.count} amount={panel.asientosMes.totalDebit}
              tone="neutral" to="/contabilidad?sub=asientos" hint="Registrados este mes" />
          </div>
        </div>
      )}

      <CollapsiblePanel id="accounting-kpis" title="Indicadores Contables" icon={BarChart3}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Cuentas por Cobrar" value={kpis?.accountsReceivable != null ? money(kpis.accountsReceivable) : '—'} icon={<ArrowDownCircle className="w-5 h-5" />} color="brand" index={0} />
          <StatCard label="Cuentas por Pagar" value={kpis?.accountsPayable != null ? money(kpis.accountsPayable) : '—'} icon={<ArrowUpCircle className="w-5 h-5" />} color="amber" index={1} />
          <StatCard label="Ventas (acum.)" value={kpis?.totalSales != null ? money(kpis.totalSales) : '—'} icon={<BarChart3 className="w-5 h-5" />} color="emerald" index={2} />
          <StatCard label="Flujo Neto" value={kpis?.netCashFlow != null ? money(kpis.netCashFlow) : '—'} icon={<Droplets className="w-5 h-5" />} color="purple" index={3} />
        </div>
      </CollapsiblePanel>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BalanceSheet onAccountClick={onAccountClick} />
        <IncomeStatement />
      </div>
    </div>
  );
}

// ─── Reporte (selección de un solo estado financiero a la vez) ──
type ReporteTipo = 'balance' | 'resultados' | 'flujo';
const REPORTE_TIPOS: { key: ReporteTipo; label: string }[] = [
  { key: 'balance', label: 'Balance General' },
  { key: 'resultados', label: 'Estado de Resultados' },
  { key: 'flujo', label: 'Flujo de Efectivo' },
];

function ReporteTab({ onAccountClick }: { onAccountClick?: (code: string) => void }) {
  const [tipo, setTipo] = useState<ReporteTipo>('balance');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-lg p-1 w-fit">
        {REPORTE_TIPOS.map((t) => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tipo === t.key ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tipo === 'balance' && <BalanceSheet onAccountClick={onAccountClick} />}
      {tipo === 'resultados' && <IncomeStatement />}
      {tipo === 'flujo' && <FlujoEfectivoTab />}
    </div>
  );
}

// ─── Mayor por cuenta (drill-down) ────────────────────────────
const SOURCE_URLS: Record<string, (id: string) => string> = {
  PURCHASE_ORDER: (id) => `/purchases/${id}`,
  INVOICE: (id) => `/financial/invoices/${id}`,
  SALES_ORDER: (id) => `/sales/orders/${id}`,
};
const SOURCE_LINK_LABELS: Record<string, string> = {
  PURCHASE_ORDER: '🛒 Ver OC',
  INVOICE: '🧾 Ver factura',
  SALES_ORDER: '🎯 Ver pedido',
};

function MayorTab({ initialAccount, canExport }: { initialAccount?: string; canExport?: boolean }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [account, setAccount] = useState(initialAccount ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { financialApi.getChartOfAccounts().then((r) => setAccounts(r.data)).catch(() => {}); }, []);

  const load = (code: string) => {
    if (!code) return;
    setLoading(true);
    financialApi.getLedger(code, from || undefined, to || undefined)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (account) load(account); }, [account, from, to]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-surface-500 mb-1">Cuenta contable</label>
          <input list="cuentas-mayor" value={account} onChange={(e) => setAccount(e.target.value.split(' — ')[0])}
            placeholder="Escribe el código o nombre…"
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
          <datalist id="cuentas-mayor">
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
        {canExport && account && data && (
          <button onClick={() => financialApi.downloadCsv(`/financial/ledger/${account}`, { from: from || undefined, to: to || undefined }, `mayor-${account}.csv`)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
            ⬇️ CSV
          </button>
        )}
      </div>

      {!account && <p className="text-center text-surface-400 text-sm py-10">Selecciona una cuenta para ver su mayor. También puedes hacer clic en cualquier cuenta del Balance (Resumen).</p>}
      {loading && <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}

      {data && !loading && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-mono text-brand-600 dark:text-brand-400 text-sm">{data.account.code}</span>
              <span className="ml-2 font-semibold text-surface-900 dark:text-white">{data.account.name}</span>
              <span className="ml-2 text-xs text-surface-400">({data.account.type})</span>
            </div>
            <div className="text-sm">
              <span className="text-surface-500">Apertura: <strong className="font-mono">{money(data.openingBalance)}</strong></span>
              <span className="ml-4 text-surface-500">Cierre: <strong className="font-mono text-surface-900 dark:text-white">{money(data.closingBalance)}</strong></span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Fecha</th><th className="text-left px-4 py-2.5">Asiento</th>
              <th className="text-left px-4 py-2.5">Descripción</th><th className="text-right px-4 py-2.5">Debe</th>
              <th className="text-right px-4 py-2.5">Haber</th><th className="text-right px-4 py-2.5">Saldo</th>
              <th className="px-4 py-2.5">Origen</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {data.entries.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-surface-400">Sin movimientos en el período.</td></tr>}
              {data.entries.map((e: any, i: number) => (
                <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-2.5 text-surface-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('es')}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-600 dark:text-brand-400">{e.journalNumber}</td>
                  <td className="px-4 py-2.5 text-surface-700 dark:text-surface-300 max-w-[280px] truncate">{e.description}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{e.debit > 0 ? money(e.debit) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{e.credit > 0 ? money(e.credit) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-surface-900 dark:text-white">{money(e.runningBalance)}</td>
                  <td className="px-4 py-2.5">
                    {e.sourceType && e.sourceId && SOURCE_URLS[e.sourceType]
                      ? <Link to={SOURCE_URLS[e.sourceType](e.sourceId)} className="text-xs text-brand-500 hover:underline whitespace-nowrap">{SOURCE_LINK_LABELS[e.sourceType] ?? 'Ver origen'}</Link>
                      : <span className="text-xs text-surface-400">{e.sourceType ? (ENTRY_LABELS[e.sourceType] ?? e.sourceType) : 'Manual'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Estado de Flujo de Efectivo (NIC 7, método directo) ─────
function CashSection({ title, icon, bucket }: { title: string; icon: ReactNode; bucket: any }) {
  const [open, setOpen] = useState(true);
  const pos = bucket.net >= 0;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/30">
        <span className="font-semibold text-surface-900 dark:text-white inline-flex items-center gap-1.5">{icon} {title}</span>
        <span className={`font-mono font-bold ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{money(bucket.net)} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="border-t border-surface-100 dark:border-surface-700 px-4 py-3 space-y-1">
          {bucket.inflows.length === 0 && bucket.outflows.length === 0 && <p className="text-sm text-surface-400">Sin movimientos.</p>}
          {bucket.inflows.map((f: any, i: number) => (
            <div key={'i' + i} className="flex justify-between text-sm"><span className="text-surface-600 dark:text-surface-300 truncate">{f.description}</span><span className="font-mono text-green-600 dark:text-green-400 ml-3">+{money(f.amount)}</span></div>
          ))}
          {bucket.outflows.map((f: any, i: number) => (
            <div key={'o' + i} className="flex justify-between text-sm"><span className="text-surface-600 dark:text-surface-300 truncate">{f.description}</span><span className="font-mono text-red-600 dark:text-red-400 ml-3">−{money(f.amount)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sección "Actividades de operación" del método indirecto: reconciliación desde la utilidad
 * neta en vez de una lista de cobros/pagos (ver `getCashFlowStatement` en el backend). */
function IndirectOperatingSection({ operating }: { operating: { netIncome: number; depreciation: number; workingCapitalChange: number; net: number } }) {
  const pos = operating.net >= 0;
  const rows = [
    { label: 'Utilidad neta del ejercicio', value: operating.netIncome },
    { label: '(+) Depreciación y otros no monetarios', value: operating.depreciation },
    { label: '(+/-) Variación en capital de trabajo', value: operating.workingCapitalChange },
  ];
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="w-full px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-surface-900 dark:text-white inline-flex items-center gap-1.5"><Cog className="w-4 h-4 inline" /> Actividades de operación (método indirecto)</span>
        <span className={`font-mono font-bold ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{money(operating.net)}</span>
      </div>
      <div className="border-t border-surface-100 dark:border-surface-700 px-4 py-3 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-surface-600 dark:text-surface-300">{r.label}</span>
            <span className="font-mono text-surface-900 dark:text-white ml-3">{money(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlujoEfectivoTab() {
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState<'direct' | 'indirect'>('direct');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    financialApi.getCashFlow(from || undefined, to || undefined, method)
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [from, to, method]);

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <p className="text-center text-surface-400 py-10">No se pudo cargar el flujo de efectivo.</p>;

  const steps = [
    { label: 'Caja inicial', value: data.openingCash, accent: 'text-surface-900 dark:text-white' },
    { label: 'Operativo', value: data.operating.net, accent: data.operating.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
    { label: 'Inversión', value: data.investing.net, accent: data.investing.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
    { label: 'Financiamiento', value: data.financing.net, accent: data.financing.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
    { label: 'Caja final', value: data.closingCash, accent: 'text-brand-600 dark:text-brand-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-surface-500">NIC 7 · cuentas de efectivo {data.cashAccountPrefix}*</p>
          <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-lg p-1">
            {(['direct', 'indirect'] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${method === m ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
                {m === 'direct' ? 'Método directo' : 'Método indirecto'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
          <span className="text-surface-400 text-sm">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
          <button onClick={() => financialApi.downloadCashFlowPdf(from || undefined, to || undefined, method)}
            className="text-xs text-brand-500 hover:underline" title="Descargar PDF">⬇️ PDF</button>
          <button onClick={() => financialApi.downloadCashFlowExcel(from || undefined, to || undefined, method)}
            className="text-xs text-brand-500 hover:underline" title="Descargar Excel">⬇️ Excel</button>
        </div>
      </div>

      {/* Cascada apertura → actividades → cierre */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className={`rounded-xl p-3 border shadow-soft ${i === 0 || i === 4 ? 'bg-surface-50 dark:bg-surface-900/50 border-surface-200 dark:border-surface-700' : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700'}`}>
            <p className="text-xs text-surface-500">{s.label}</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${s.accent}`}>{money(s.value)}</p>
          </div>
        ))}
      </div>

      {data.method === 'indirect'
        ? <IndirectOperatingSection operating={data.operating} />
        : <CashSection title="Actividades de operación" icon={<Cog className="w-4 h-4 inline" />} bucket={data.operating} />}
      <CashSection title="Actividades de inversión" icon={<Building2 className="w-4 h-4 inline" />} bucket={data.investing} />
      <CashSection title="Actividades de financiamiento" icon={<Landmark className="w-4 h-4 inline" />} bucket={data.financing} />

      <p className="text-xs text-surface-400">
        Variación neta: <span className="font-mono">{money(data.netChange)}</span> · Caja inicial + variación = caja final
        ({money(data.openingCash)} {data.netChange >= 0 ? '+' : '−'} {money(Math.abs(data.netChange))} = {money(data.closingCash)})
      </p>
    </div>
  );
}

// ─── Patrimonio y NIIF (Etapa 8 del plan SRI) ──────────────────
function PatrimonioNiifTab({ canEditNotes }: { canEditNotes: boolean }) {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const [year, month] = period.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0).toISOString().slice(0, 10); // último día del mes

  const downloadPackage = async () => {
    setDownloading(true);
    try { await financialApi.downloadSuperciasPackage(period); }
    catch { toast.error('No se pudo generar el paquete NIIF/Supercías'); }
    finally { setDownloading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button onClick={downloadPackage} disabled={downloading}
          className="text-sm bg-brand-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
          {downloading ? 'Generando…' : '⬇️ Descargar paquete NIIF/Supercías (PDF)'}
        </button>
      </div>
      <p className="text-xs text-surface-400">
        Balance General + Estado de Resultados + Cambios en el Patrimonio + Flujo de Efectivo + Notas, en un solo PDF.
        El portal de Supercías no ofrece un API de carga automatizada — este paquete es para presentar/adjuntar manualmente.
      </p>
      <EquityStatement from={from} to={to} />
      <FinancialNotes period={period} canEdit={canEditNotes} />
    </div>
  );
}

// ─── Asientos ─────────────────────────────────────────────────
const ENTRY_LABELS: Record<string, string> = {
  PURCHASE_ORDER: 'Compra', SALES_ORDER: 'Venta', INVOICE: 'Cobro/Pago', SRI_DOCUMENT: 'Retención',
  INVENTORY: 'Inventario', MANUAL: 'Manual', REVERSAL: 'Reversa', PAYROLL: 'Nómina', TREASURY: 'Tesorería',
};
function AsientosTab({ canPost, canReverse, canExport, canReview }: { canPost: boolean; canReverse: boolean; canExport: boolean; canReview: boolean }) {
  const toast = useToast();
  const [askReason, reasonDialog] = useReasonPrompt();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Filtros del libro diario (Sprint 6): texto, cuenta, tipo, estado, fechas, montos.
  const [filters, setFilters] = useState({ q: '', accountCode: '', entityType: '', status: '', from: '', to: '', minAmount: '', maxAmount: '' });
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<any[]>([]);
  useEffect(() => { financialApi.getChartOfAccounts().then((r) => setAccounts(r.data)).catch(() => {}); }, []);

  const cleanParams = () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));

  const load = () => {
    setLoading(true);
    financialApi.searchJournalEntries({ ...cleanParams(), page })
      .then((r) => setResult(r.data)).catch(() => setResult(null)).finally(() => setLoading(false));
  };
  useEffect(load, [page]);
  // Al cambiar filtros vuelve a página 1 (con debounce corto para el texto).
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [filters]);

  const exportCsv = () => financialApi.downloadCsv('/financial/journal-entries', cleanParams(), 'libro-diario.csv');
  const entries = result?.items ?? [];
  const reverse = async (id: string) => {
    // Propuesta 06: el reverso exige motivo (catálogo + detalle) y queda en la bitácora encadenada.
    const reason = await askReason('REVERSAL', 'Reversar asiento', 'Se creará un asiento espejo. Indica por qué.');
    if (!reason) return;
    try { await financialApi.reverseJournalEntry(id, reason); toast.success('Asiento reversado', '✓'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Error', 'Error'); }
  };
  // Revisión continua: marcar asientos revisados día a día (el cierre lo exige como tarea).
  const review = async (ids: string[], reviewed: boolean) => {
    if (!ids.length) return;
    try { await controlsApi.review(ids, reviewed); toast.success(reviewed ? `${ids.length} asiento(s) marcado(s) como revisado(s)` : 'Revisión quitada', '✓'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo marcar', 'Error'); }
  };
  const setF = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const inputCls = 'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white';

  return (
    <div className="space-y-5">
      {reasonDialog}
      {canPost && <ManualJournalForm onSaved={load} />}

      {/* Barra de filtros del libro diario */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-surface-500 mb-1">Buscar (texto o Nº asiento)</label>
          <input value={filters.q} onChange={(e) => setF('q', e.target.value)} placeholder="AST-0012, venta, cliente…" className={`w-full ${inputCls}`} />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs text-surface-500 mb-1">Cuenta (o prefijo)</label>
          <input list="cuentas-diario" value={filters.accountCode} onChange={(e) => setF('accountCode', e.target.value.split(' — ')[0])} placeholder="1010306…" className={`w-full ${inputCls}`} />
          <datalist id="cuentas-diario">{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</datalist>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Origen</label>
          <select value={filters.entityType} onChange={(e) => setF('entityType', e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {Object.entries(ENTRY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Estado</label>
          <select value={filters.status} onChange={(e) => setF('status', e.target.value)} className={inputCls}>
            <option value="">Todos</option><option value="POSTED">Contabilizado</option><option value="REVERSED">Reversado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto ≥</label>
          <input type="number" value={filters.minAmount} onChange={(e) => setF('minAmount', e.target.value)} className={`w-24 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Monto ≤</label>
          <input type="number" value={filters.maxAmount} onChange={(e) => setF('maxAmount', e.target.value)} className={`w-24 ${inputCls}`} />
        </div>
        {canExport && (
          <button onClick={exportCsv} className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
            ⬇️ CSV
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
          <span className="font-semibold text-surface-900 dark:text-white">Libro Diario</span>
          {canReview && entries.some((x: any) => !x.reviewedAt) && (
            <button onClick={() => review(entries.filter((x: any) => !x.reviewedAt).map((x: any) => x.id), true)} className="text-xs px-3 py-1 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300">
              ✓ Marcar página como revisada
            </button>
          )}
          {result && (
            <span className="text-xs text-surface-500">
              {result.total} asiento{result.total === 1 ? '' : 's'} · Debe {money(result.totals.debit)} · Haber {money(result.totals.credit)}
            </span>
          )}
        </div>
        {loading ? <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div> : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {entries.length === 0 && <p className="text-center py-10 text-surface-400 text-sm">Sin asientos registrados.</p>}
            {entries.map((e: any) => (
              <div key={e.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                  <span className="font-mono text-xs text-brand-600 dark:text-brand-400 w-20">{e.entryNumber}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">{ENTRY_LABELS[e.entityType] ?? e.entityType ?? '—'}</span>
                  <span className="text-sm text-surface-700 dark:text-surface-300 flex-1 truncate">{e.description}</span>
                  <span className="text-xs text-surface-500">{new Date(e.entryDate).toLocaleDateString('es')}</span>
                  <span className="font-mono text-sm text-surface-900 dark:text-white">{money(Number(e.totalDebit))}</span>
                  {e.status === 'REVERSED' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">REVERSADO</span>}
                  {canReview ? (
                    <label className="text-[11px] flex items-center gap-1 text-surface-500" onClick={(ev) => ev.stopPropagation()} title="Revisión continua del período">
                      <input type="checkbox" checked={!!e.reviewedAt} onChange={(ev) => review([e.id], ev.target.checked)} /> Revisado
                    </label>
                  ) : e.reviewedAt ? <span className="text-[11px] text-green-600 dark:text-green-400">✓ Revisado</span> : null}
                  {canReverse && e.status !== 'REVERSED' && e.entityType !== 'REVERSAL' && (
                    <button onClick={(ev) => { ev.stopPropagation(); reverse(e.id); }} className="text-xs text-surface-400 hover:text-red-600 dark:hover:text-red-400">Reversar</button>
                  )}
                </div>
                {expanded === e.id && (
                  <div className="bg-surface-50 dark:bg-surface-900/40 px-4 py-2">
                    <table className="w-full text-xs">
                      <thead><tr className="text-surface-500"><th className="text-left py-1">Cuenta</th><th className="text-right py-1">Debe</th><th className="text-right py-1">Haber</th></tr></thead>
                      <tbody>
                        {e.lines?.map((l: any) => (
                          <tr key={l.id}>
                            <td className="py-1 text-surface-700 dark:text-surface-300"><span className="font-mono text-surface-500 mr-2">{l.accountCode}</span>{l.accountName}</td>
                            <td className="py-1 text-right font-mono">{Number(l.debit) > 0 ? money(Number(l.debit)) : ''}</td>
                            <td className="py-1 text-right font-mono">{Number(l.credit) > 0 ? money(Number(l.credit)) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {result && result.pages > 1 && (
          <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-40 hover:bg-surface-50 dark:hover:bg-surface-700">
              ← Anterior
            </button>
            <span className="text-surface-500 text-xs">Página {result.page} de {result.pages}</span>
            <button disabled={page >= result.pages} onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-40 hover:bg-surface-50 dark:hover:bg-surface-700">
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retenciones ──────────────────────────────────────────────
function RetencionesTab() {
  const [renta, setRenta] = useState<any[]>([]);
  const [iva, setIva] = useState<any[]>([]);
  useEffect(() => {
    financialApi.listRetentions('RENTA').then((r) => setRenta(r.data)).catch(() => {});
    financialApi.listRetentions('IVA').then((r) => setIva(r.data)).catch(() => {});
  }, []);
  const Table = ({ title, rows }: { title: string; rows: any[] }) => (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 font-semibold text-surface-900 dark:text-white">{title}</div>
      <div className="max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm"><tbody className="divide-y divide-surface-100 dark:divide-surface-700">
          {rows.filter((r) => r.activo).map((r) => (
            <tr key={r.codigo}>
              <td className="px-3 py-2 font-mono text-xs text-surface-500 w-14">{r.codigo}</td>
              <td className="px-2 py-2 text-surface-700 dark:text-surface-300">{r.descripcion}</td>
              <td className="px-3 py-2 text-right font-mono text-surface-900 dark:text-white w-14">{Number(r.porcentaje)}%</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-surface-400">Inicializa los catálogos en la pestaña Impuestos.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500">Catálogo de retenciones SRI vigente. La administración (activar/editar) está en la pestaña Impuestos / Config.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Table title="Retenciones en la Fuente (IR)" rows={renta} />
        <Table title="Retenciones de IVA" rows={iva} />
      </div>
    </div>
  );
}

// ─── Balanza de comprobación (saldo inicial + movimientos + saldo final) ──────
function ComprobacionTab({ canExport, onAccountClick }: { canExport: boolean; onAccountClick: (code: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [level, setLevel] = useState<number>(0); // 0 = detalle (sin agrupar)
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financialApi.getTrialBalance2({ from: from || undefined, to: to || undefined, level: level || undefined })
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [from, to, level]);

  const exportCsv = () => financialApi.downloadCsv('/financial/trial-balance-v2',
    { from: from || undefined, to: to || undefined, level: level || undefined }, 'balanza-comprobacion.csv');

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Agrupar por nivel</label>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
            <option value={0}>Detalle (todas)</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nivel {n}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        {canExport && (
          <button onClick={exportCsv} className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
            ⬇️ Descargar CSV
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}
      {!loading && data && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Cuenta</th><th className="text-left px-4 py-2.5">Nombre</th>
              <th className="text-right px-4 py-2.5">Saldo inicial</th><th className="text-right px-4 py-2.5">Debe</th>
              <th className="text-right px-4 py-2.5">Haber</th><th className="text-right px-4 py-2.5">Saldo final</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {data.rows.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-surface-400">Sin movimientos en el período.</td></tr>}
              {data.rows.map((r: any) => (
                <tr key={r.code} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 cursor-pointer" onClick={() => onAccountClick(r.code)}>
                  <td className="px-4 py-2 font-mono text-xs text-brand-600 dark:text-brand-400 whitespace-nowrap" style={{ paddingLeft: `${Math.min(r.level - 1, 4) * 12 + 16}px` }}>{r.code}</td>
                  <td className="px-4 py-2 text-surface-700 dark:text-surface-300">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(r.opening)}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.debit > 0 ? money(r.debit) : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.credit > 0 ? money(r.credit) : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-surface-900 dark:text-white">{money(r.closing)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
              <td className="px-4 py-2.5" colSpan={2}>TOTALES</td>
              <td className="px-4 py-2.5 text-right font-mono">{money(data.totals.opening)}</td>
              <td className="px-4 py-2.5 text-right font-mono">{money(data.totals.debit)}</td>
              <td className="px-4 py-2.5 text-right font-mono">{money(data.totals.credit)}</td>
              <td className="px-4 py-2.5 text-right font-mono">{money(data.totals.closing)}</td>
            </tr></tfoot>
          </table>
          {Math.abs(data.totals.debit - data.totals.credit) > 0.01 && (
            <p className="px-4 py-2 text-xs text-red-600 dark:text-red-400">⚠️ Debe ≠ Haber en el período: revisa asientos descuadrados.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cierres de período (candado contable mensual) ───────────────────────────
function CierresTab({ canClose, canEditTasks }: { canClose: boolean; canEditTasks: boolean }) {
  const toast = useToast();
  const [askReason, reasonDialog] = useReasonPrompt();
  const [openChecklist, setOpenChecklist] = useState<string | null>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    financialApi.getFiscalPeriods().then((r) => setPeriods(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (p: any, action: 'close' | 'reopen') => {
    const label = `${MONTHS_ES[p.month - 1]} ${p.year}`;
    let reason = '';
    if (action === 'reopen') {
      const r = await askReason('PERIOD_REOPEN', `Reabrir ${label}`, 'Quedará registrado en la bitácora de auditoría.');
      if (!r) return;
      reason = r;
    }
    setBusy(`${p.year}-${p.month}`);
    try {
      if (action === 'close') await financialApi.closeFiscalPeriod(p.year, p.month);
      else await financialApi.reopenFiscalPeriod(p.year, p.month, reason);
      toast.success(`${label} ${action === 'close' ? 'cerrado' : 'reabierto'}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo actualizar el período');
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      {reasonDialog}
      <p className="text-sm text-surface-500">
        Cerrar un mes bloquea la creación y el reverso de asientos con fecha dentro de él (compras, ventas, inventario y manuales).
        {!canClose && ' Solo el Contador o el Administrador pueden cerrar/reabrir.'}
      </p>
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
            <th className="text-left px-4 py-2.5">Período</th><th className="text-right px-4 py-2.5">Asientos</th>
            <th className="text-right px-4 py-2.5">Movimiento (Debe)</th><th className="text-left px-4 py-2.5">Estado</th>
            <th className="text-left px-4 py-2.5">Cerrado</th>{canClose && <th className="px-4 py-2.5" />}
          </tr></thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {periods.map((p) => (
              <tr key={`${p.year}-${p.month}`} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">{MONTHS_ES[p.month - 1]} {p.year}</td>
                <td className="px-4 py-2.5 text-right font-mono">{p.entryCount}</td>
                <td className="px-4 py-2.5 text-right font-mono">{money(p.totalDebit)}</td>
                <td className="px-4 py-2.5">
                  {p.status === 'CLOSED'
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">🔒 CERRADO</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">ABIERTO</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-surface-500">
                  {p.closedAt ? new Date(p.closedAt).toLocaleDateString('es') : '—'}
                  {p.reopenedAt && <span className="ml-1 text-amber-600 dark:text-amber-400">(reabierto {new Date(p.reopenedAt).toLocaleDateString('es')})</span>}
                </td>
                {canClose && (
                  <td className="px-4 py-2.5 text-right">
                    {p.status === 'CLOSED'
                      ? <button disabled={busy === `${p.year}-${p.month}`} onClick={() => act(p, 'reopen')} className="text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50">Reabrir</button>
                      : <button onClick={() => setOpenChecklist(openChecklist === `${p.year}-${p.month}` ? null : `${p.year}-${p.month}`)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Checklist de cierre</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openChecklist && (() => {
        const [y, m] = openChecklist.split('-').map(Number);
        const p = periods.find((x) => x.year === y && x.month === m);
        return (
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft">
            <div className="px-4 pt-3 font-semibold text-surface-900 dark:text-white">{MONTHS_ES[m - 1]} {y}</div>
            <CloseChecklistPanel year={y} month={m} canEdit={canEditTasks} canClose={canClose} onClose={async () => { if (p) await act(p, 'close'); }} />
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tributario: Declaraciones SRI por casillas (Sprint 11 — estilo Odoo) ──────
// Selector 104|103 + PeriodPicker + banner accionable de pendientes + casillas.
function PendientesBanner({ pendientes, period }: { pendientes: any; period: string }) {
  if (!pendientes || (pendientes.sriDocsPendientes === 0 && pendientes.facturasBorrador === 0)) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3 flex-wrap">
      <span className="text-lg">⚠️</span>
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Hay documentos sin registrar en este período que no suman a la declaración.</p>
        <div className="flex gap-4 mt-1.5">
          {pendientes.sriDocsPendientes > 0 && (
            <Link to="/sri" className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium">
              {pendientes.sriDocsPendientes} factura(s) de compra por revisar →
            </Link>
          )}
          {pendientes.facturasBorrador > 0 && (
            <Link to={`/finanzas?tab=operacion`} className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium">
              {pendientes.facturasBorrador} factura(s) de venta en borrador →
            </Link>
          )}
        </div>
      </div>
      <span className="text-xs text-amber-600 dark:text-amber-500">Período {period}</span>
    </div>
  );
}

function TributarioTab({ canExport, canClose }: { canExport: boolean; canClose: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [form, setForm] = useState<'104' | '104-oficial' | '103' | '103-oficial' | 'ATS' | '101' | '101-oficial'>('104');
  const [f104, setF104] = useState<any>(null);
  const [f103, setF103] = useState<any>(null);
  const [ats, setAts] = useState<any>(null);
  const [f101Year, setF101Year] = useState(now.getFullYear() - 1); // el 101 se declara en abril sobre el ejercicio anterior
  const [f101Tasa, setF101Tasa] = useState(25);
  const [f101, setF101] = useState<any>(null);
  const [f101Loading, setF101Loading] = useState(false);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [taxClosing, setTaxClosing] = useState<any>(null);
  const [closingBusy, setClosingBusy] = useState(false);

  useEffect(() => { financialApi.getSRICalendarWarnings().then((r) => setWarnings(r.data)).catch(() => {}); }, []);
  const loadTaxClosing = () => financialApi.getTaxClosingPreview(period).then((r) => setTaxClosing(r.data)).catch(() => setTaxClosing(null));
  useEffect(() => {
    setLoading(true);
    Promise.all([financialApi.getForm104Casillas(period), financialApi.getForm103Casillas(period), financialApi.getAts(period)])
      .then(([a, b, c]) => { setF104(a.data); setF103(b.data); setAts(c.data); })
      .catch(() => { setF104(null); setF103(null); setAts(null); })
      .finally(() => setLoading(false));
    loadTaxClosing();
  }, [period]);

  useEffect(() => {
    if (form !== '101') return;
    setF101Loading(true);
    financialApi.getForm101(f101Year, f101Tasa)
      .then((r) => setF101(r.data))
      .catch(() => setF101(null))
      .finally(() => setF101Loading(false));
  }, [form, f101Year, f101Tasa]);

  async function handleCloseTaxes() {
    if (!f104) return;
    const isPagar = f104.resultado.type === 'A_PAGAR';
    const ok = await confirm({
      title: 'Cerrar impuestos del período',
      message: isPagar
        ? `Se posteará el asiento de liquidación de IVA por $${f104.resultado.value.toFixed(2)} y se bloqueará contablemente ${period}. Esta acción no se puede deshacer (solo reabrir el período). ¿Continuar?`
        : `El período arroja crédito tributario a favor (nada que pagar). Se bloqueará contablemente ${period}. ¿Continuar?`,
      confirmLabel: 'Cerrar impuestos', variant: isPagar ? 'danger' : 'default',
    });
    if (!ok) return;
    setClosingBusy(true);
    try {
      const { data } = await financialApi.closeTaxPeriod(period);
      toast.success(data.entry ? `Asiento ${data.entry.entryNumber} · $${data.totalPagar.toFixed(2)}` : 'Sin IVA a pagar', '✓ Impuestos cerrados');
      loadTaxClosing();
      financialApi.getForm104Casillas(period).then((r) => setF104(r.data));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cerrar el período', 'Error');
    } finally { setClosingBusy(false); }
  }

  async function downloadAtsXml() {
    setDownloadingXml(true);
    try {
      const { data } = await financialApi.getAtsXml(period);
      const blob = new Blob([data], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ATS-${period}.xml`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* el botón queda deshabilitado mientras carga; un fallo aquí es informativo, no bloquea el resto de la pantalla */ }
    setDownloadingXml(false);
  }

  const export104 = () => f104 && downloadClientCsv(`form-104-${period}.csv`,
    ['Casilla', 'Concepto', 'Valor'],
    [...f104.sections.flatMap((s: any) => s.rows.map((r: any) => [r.casilla, r.label, r.value])),
     ['', f104.resultado.label, f104.resultado.value]]);
  const export103 = () => f103 && downloadClientCsv(`form-103-${period}.csv`,
    ['Código', 'Descripción', '%', 'Base imponible', 'Valor retenido', '# Facturas'],
    [...f103.rows.map((r: any) => [r.codigo, r.descripcion, r.porcentaje, r.baseImponible, r.valorRetenido, r.numFacturas]),
     ['', 'TOTAL RETENIDO', '', f103.totalBase, f103.totalRetenido, '']]);

  const active = form === '104' ? f104 : form === '103' ? f103 : null;
  const periodStatus = active?.periodStatus;

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {warnings.map((w, i) => (
            <span key={i} className={`text-xs px-3 py-1.5 rounded-full border ${w.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : w.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-surface-50 dark:bg-surface-900/40 border-surface-200 dark:border-surface-700 text-surface-500'}`}>
              {w.name}: vence en {w.daysUntilDue} día{w.daysUntilDue === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      )}

      {/* Barra de control: formulario + período + estado + export */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-3 flex gap-3 items-center flex-wrap">
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-900 rounded-lg p-1">
          {(['104', '104-oficial', '103', '103-oficial', 'ATS', '101', '101-oficial'] as const).map((f) => (
            <button key={f} onClick={() => setForm(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${form === f ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
              {f === 'ATS' ? 'ATS · Anexo Transaccional' : f === '101' ? 'Form 101 · Renta (anual)' : f === '101-oficial' ? 'Form 101 · Réplica oficial' : f === '104-oficial' ? 'Form 104 · Réplica oficial' : f === '103-oficial' ? 'Form 103 · Réplica oficial' : `Form ${f} · ${f === '104' ? 'IVA' : 'Retenciones'}`}
            </button>
          ))}
        </div>
        {form !== '101' && form !== '101-oficial' ? (
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            {periodStatus && periodStatus !== 'NONE' && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${periodStatus === 'CLOSED' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'}`}>
                {periodStatus === 'CLOSED' ? '🔒 Período cerrado' : 'Período abierto'}
              </span>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-[10px] text-surface-400 mb-0.5">Ejercicio</label>
              <input type="number" value={f101Year} onChange={(e) => setF101Year(Number(e.target.value))}
                className="w-24 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-surface-400 mb-0.5">Tasa IR sociedades (%)</label>
              <input type="number" step="0.5" value={f101Tasa} onChange={(e) => setF101Tasa(Number(e.target.value))}
                className="w-28 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none" />
            </div>
          </>
        )}
        <div className="flex-1" />
        {canExport && active && form !== '101' && form !== '101-oficial' && (
          <button onClick={form === '104' ? export104 : export103}
            className="text-sm px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700">
            ⬇️ CSV
          </button>
        )}
      </div>

      {active && <PendientesBanner pendientes={active.pendientes} period={period} />}

      {loading && <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}

      {/* Form 104 — casillas SRI */}
      {!loading && form === '104' && f104 && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden max-w-3xl">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
            <span className="font-semibold text-surface-900 dark:text-white">Formulario 104 · IVA — {period}</span>
            <span className="text-xs text-surface-400">Tarifa {f104.tasaVigente}%</span>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {f104.sections.map((section: any) => (
              <div key={section.title}>
                <div className="bg-surface-50 dark:bg-surface-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-surface-500">{section.title}</div>
                {section.rows.map((r: any) => (
                  <div key={r.casilla} className={`flex items-center px-4 py-2 text-sm ${r.style === 'total' ? 'font-semibold bg-surface-50/50 dark:bg-surface-900/30' : ''}`}>
                    <span className="font-mono text-xs text-surface-400 w-12">{r.casilla}</span>
                    <span className={`flex-1 ${r.style === 'muted' ? 'text-surface-400' : 'text-surface-700 dark:text-surface-300'}`}>{r.label}</span>
                    <span className={`font-mono ${r.style === 'muted' ? 'text-surface-300 dark:text-surface-600' : 'text-surface-900 dark:text-white'}`}>{money(r.value)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={`px-4 py-3 flex items-center justify-between border-t-2 ${f104.resultado.type === 'A_PAGAR' ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20' : 'border-green-300 dark:border-green-800 bg-green-50/60 dark:bg-green-900/20'}`}>
            <span className="font-semibold text-surface-900 dark:text-white">{f104.resultado.label}</span>
            <span className={`font-mono font-bold text-lg ${f104.resultado.type === 'A_PAGAR' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{money(f104.resultado.value)}</span>
          </div>
          {canClose && (
            <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between gap-3">
              {taxClosing?.yaCerrado ? (
                <span className="text-sm text-green-700 dark:text-green-400">✓ Impuestos ya cerrados ({taxClosing.entryNumber ?? 'sin IVA a pagar'})</span>
              ) : f104.periodStatus === 'CLOSED' ? (
                <span className="text-sm text-surface-500">Período contable ya cerrado (sin cierre de impuestos registrado — reabre el período si necesitas volver a cerrarlo)</span>
              ) : (
                <span className="text-sm text-surface-500">
                  {(f104.pendientes.sriDocsPendientes > 0 || f104.pendientes.facturasBorrador > 0)
                    ? 'Resuelve los documentos pendientes antes de cerrar'
                    : 'Postea el asiento de liquidación de IVA y bloquea el período'}
                </span>
              )}
              {!taxClosing?.yaCerrado && f104.periodStatus !== 'CLOSED' && (
                <button onClick={handleCloseTaxes} disabled={closingBusy || f104.pendientes.sriDocsPendientes > 0 || f104.pendientes.facturasBorrador > 0}
                  className="text-sm px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium whitespace-nowrap">
                  {closingBusy ? 'Cerrando…' : '🔒 Cerrar impuestos'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form 104 — réplica llenable del formulario oficial (2026-09-28) */}
      {form === '104-oficial' && <Form104OfficialReplica period={period} />}

      {/* Form 103 — retenciones */}
      {!loading && form === '103' && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden max-w-3xl">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
            <span className="font-semibold text-surface-900 dark:text-white">Formulario 103 · Retenciones en la fuente — {period}</span>
          </div>
          {f103 && f103.rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-3 py-2">Cód.</th><th className="text-left px-3 py-2">Concepto</th>
                <th className="text-right px-3 py-2">%</th><th className="text-right px-3 py-2">Base</th>
                <th className="text-right px-3 py-2">Retenido</th><th className="text-right px-3 py-2"># Fact.</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {f103.rows.map((r: any) => (
                  <tr key={r.codigo}>
                    <td className="px-3 py-2 font-mono text-xs">{r.codigo}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300 max-w-[220px] truncate">{r.descripcion}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.porcentaje}%</td>
                    <td className="px-3 py-2 text-right font-mono">{money(r.baseImponible)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(r.valorRetenido)}</td>
                    <td className="px-3 py-2 text-right font-mono text-surface-400">{r.numFacturas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
                <td colSpan={3} className="px-3 py-2">TOTALES</td>
                <td className="px-3 py-2 text-right font-mono">{money(f103.totalBase)}</td>
                <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">{money(f103.totalRetenido)}</td>
                <td />
              </tr></tfoot>
            </table>
          ) : <p className="p-6 text-center text-surface-400 text-sm">Sin retenciones registradas en el período.</p>}
        </div>
      )}

      {/* Form 103 — réplica llenable del formulario oficial (2026-09-28) */}
      {form === '103-oficial' && <Form103OfficialReplica period={period} />}

      {/* ATS — Anexo Transaccional Simplificado */}
      {!loading && form === 'ATS' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ El XML es un <strong>borrador</strong> generado a partir de tus documentos confirmados del período —
            valídalo en DIMM Formularios (SRI) antes de presentarlo, igual que con cualquier software contable.
          </div>
          {canExport && (
            <div className="flex justify-end">
              <button onClick={downloadAtsXml} disabled={downloadingXml}
                className="text-sm px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50">
                {downloadingXml ? 'Generando...' : '⬇️ Descargar XML'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
                <span className="font-semibold text-surface-900 dark:text-white">Compras — {period}</span>
                <span className="text-xs text-surface-400">{ats?.compras.rows.length ?? 0} documento(s)</span>
              </div>
              {ats && ats.compras.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 uppercase">
                      <th className="text-left px-3 py-2">Proveedor</th><th className="text-left px-3 py-2">Comp.</th>
                      <th className="text-right px-3 py-2">Base</th><th className="text-right px-3 py-2">IVA</th>
                      <th className="text-right px-3 py-2">Ret. IVA</th><th className="text-right px-3 py-2">Ret. Renta</th>
                    </tr></thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {ats.compras.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-surface-700 dark:text-surface-300 max-w-[160px] truncate">{r.razonSocialProveedor}</td>
                          <td className="px-3 py-2 font-mono text-surface-400">{r.tipoComprobante}-{r.secuencial}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(r.baseImponible)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(r.montoIva)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-600 dark:text-amber-400">{money(r.valorRetIva)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-600 dark:text-amber-400">{money(r.valorRetRenta)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
                      <td colSpan={2} className="px-3 py-2">TOTALES</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.compras.totalBaseImponible)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.compras.totalIva)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.compras.totalRetIva)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.compras.totalRetRenta)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              ) : <p className="p-6 text-center text-surface-400 text-sm">Sin compras confirmadas en el período.</p>}
            </div>

            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
                <span className="font-semibold text-surface-900 dark:text-white">Ventas — {period}</span>
                <span className="text-xs text-surface-400">{ats?.ventas.rows.length ?? 0} documento(s)</span>
              </div>
              {ats && ats.ventas.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 uppercase">
                      <th className="text-left px-3 py-2">Cliente</th><th className="text-left px-3 py-2">Comp.</th>
                      <th className="text-right px-3 py-2">Base</th><th className="text-right px-3 py-2">IVA</th>
                    </tr></thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {ats.ventas.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-surface-700 dark:text-surface-300 max-w-[160px] truncate">{r.razonSocialComprador}</td>
                          <td className="px-3 py-2 font-mono text-surface-400">{r.numeroComprobante}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(r.baseImponible)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(r.montoIva)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
                      <td colSpan={2} className="px-3 py-2">TOTALES</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.ventas.totalBaseImponible)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(ats.ventas.totalIva)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              ) : <p className="p-6 text-center text-surface-400 text-sm">Sin ventas facturadas en el período.</p>}
              <p className="px-4 py-2 text-xs text-surface-400 border-t border-surface-100 dark:border-surface-700">
                Base neta aproximada (las facturas guardan el total con IVA incluido) — mismo criterio que el Formulario 104.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulario 101 — conciliación tributaria IR sociedades (borrador anual) */}
      {form === '101' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ Es la <strong>conciliación tributaria básica</strong> (utilidad contable → participación laboral →
            gastos no deducibles → base imponible), no el formulario 101 completo con sus ~800 casillas oficiales.
            Confirma las casillas exactas en DIMM Formularios antes de presentar — igual que con el ATS. No incluye
            anticipo de Impuesto a la Renta (Formulario 115), créditos tributarios ni exoneraciones sectoriales.
          </div>
          {f101Loading && <p className="text-sm text-surface-400 p-6 text-center">Calculando…</p>}
          {!f101Loading && f101 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 font-semibold text-surface-900 dark:text-white">
                  Conciliación tributaria — ejercicio {f101.year}
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    <tr><td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">Utilidad contable del ejercicio</td><td className="px-4 py-2.5 text-right font-mono">{money(f101.utilidadContable)}</td></tr>
                    <tr><td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">(−) 15% participación a trabajadores</td><td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">−{money(f101.participacionTrabajadores)}</td></tr>
                    <tr><td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">(+) Gastos no deducibles</td><td className="px-4 py-2.5 text-right font-mono text-green-600 dark:text-green-400">+{money(f101.gastosNoDeducibles)}</td></tr>
                    {f101.perdidasTributariasAnteriores > 0 && (
                      <tr><td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">(−) Pérdidas tributarias amortizadas</td><td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">−{money(f101.perdidasTributariasAnteriores)}</td></tr>
                    )}
                    <tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
                      <td className="px-4 py-2.5">Base imponible</td><td className="px-4 py-2.5 text-right font-mono">{money(f101.baseImponible)}</td>
                    </tr>
                    <tr><td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">Tasa aplicada</td><td className="px-4 py-2.5 text-right font-mono">{f101.tasaPct}%</td></tr>
                    <tr className="bg-brand-50 dark:bg-brand-500/10 font-semibold text-brand-700 dark:text-brand-400">
                      <td className="px-4 py-2.5">Impuesto a la renta causado</td><td className="px-4 py-2.5 text-right font-mono">{money(f101.impuestoCausado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
                  <span className="font-semibold text-surface-900 dark:text-white">Gastos no deducibles del ejercicio</span>
                  <span className="text-xs text-surface-400">{f101.gastosNoDeduciblesDetalle.length} cuenta(s)</span>
                </div>
                {f101.gastosNoDeduciblesDetalle.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 uppercase">
                      <th className="text-left px-3 py-2">Código</th><th className="text-left px-3 py-2">Cuenta</th><th className="text-right px-3 py-2">Monto</th>
                    </tr></thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {f101.gastosNoDeduciblesDetalle.map((g: any) => (
                        <tr key={g.code}>
                          <td className="px-3 py-2 font-mono text-surface-400">{g.code}</td>
                          <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{g.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(g.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-center text-surface-400 text-sm">
                    Ninguna cuenta de gasto está marcada como no deducible. Márcalas desde Contabilidad → Plan de Cuentas.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form 101 — réplica llenable del formulario oficial (2026-10-01) */}
      {form === '101-oficial' && <Form101OfficialReplica year={f101Year} />}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────
export default function ContabilidadPage() {
  const [params, setParams] = useSearchParams();
  const sub = (params.get('sub') as Sub) || 'resumen';
  const account = params.get('account') ?? undefined;
  const setSub = (s: Sub) => setParams({ sub: s }, { replace: true });
  const goLedger = (code: string) => setParams({ sub: 'mayor', account: code }, { replace: true });

  // Perfil contable del usuario (Sprint 6): las pestañas y acciones dependen del rol.
  // Una sola fuente de permisos (propuesta 06 #7): las reglas CASL que envía el backend, las mismas
  // que valida `authorize()` en cada ruta — cada acción de la UI mapea al gate real del servidor.
  const { can: canDo } = useCan();
  const PERM: Record<string, boolean> = {
    view: canDo('read', 'Accounting'), export: canDo('read', 'Accounting'), postManual: canDo('create', 'Journal'),
    reverse: canDo('post', 'Journal'), close: canDo('configure', 'Accounting'), taxes: canDo('update', 'Accounting'),
    configure: canDo('configure', 'Accounting'), pay: canDo('pay', 'Payment'), review: canDo('update', 'Journal'),
  };
  const can = (action: string) => !!PERM[action];
  const visibleTabs = TABS.filter((t) => can(t.perm));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📒</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Contabilidad</h1>
          <p className="text-sm text-surface-500">Mayor, balanza, asientos, cierres, tributario y plan de cuentas (NIIF · normativa Ecuador)</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-surface-100 dark:bg-surface-800 rounded-lg p-1 w-fit flex-wrap">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === t.key ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
            <span className="inline-flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {sub === 'resumen' && <ResumenTab onAccountClick={goLedger} />}
      {sub === 'reporte' && <ReporteTab onAccountClick={goLedger} />}
      {sub === 'mayor' && <MayorTab key={account ?? 'none'} initialAccount={account} canExport={can('export')} />}
      {sub === 'comprobacion' && <ComprobacionTab canExport={can('export')} onAccountClick={goLedger} />}
      {sub === 'cierres' && <CierresTab canClose={can('close')} canEditTasks={can('review')} />}
      {sub === 'tributario' && can('taxes') && <TributarioTab canExport={can('export')} canClose={can('close')} />}
      {sub === 'flujo-efectivo' && <FlujoEfectivoTab />}
      {sub === 'patrimonio' && <PatrimonioNiifTab canEditNotes={can('taxes')} />}
      {sub === 'cxp' && <CuentasPorPagarTab canPay={can('pay')} />}
      {sub === 'cxc' && <CuentasPorCobrarTab canCollect={can('pay')} />}
      {sub === 'asientos' && <AsientosTab canPost={can('postManual')} canReverse={can('reverse')} canExport={can('export')} canReview={can('review')} />}
      {sub === 'auditoria' && <AuditTimeline />}
      {sub === 'pivot' && (
        <PivotView
          fetchPivot={(params) => financialApi.getJournalPivot(params as any)}
          dimLabels={{ accountCode: 'Cuenta', accountName: 'Nombre de cuenta', entityType: 'Origen', status: 'Estado', month: 'Mes' }}
          measureLabels={{ debit: 'Debe', credit: 'Haber' }}
          defaultRowDim="accountCode"
          defaultMeasure="debit"
          defaultColDim="month"
        />
      )}
      {sub === 'plan' && <ChartOfAccountsTree />}
      {sub === 'retenciones' && <RetencionesTab />}
      {sub === 'impuestos' && can('configure') && <TaxConfigPanel />}
      {sub === 'facturacion-electronica' && can('configure') && <FiscalConfigPanel />}
    </div>
  );
}
