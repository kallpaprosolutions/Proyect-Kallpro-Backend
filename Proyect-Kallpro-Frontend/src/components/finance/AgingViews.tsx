import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, CartesianGrid } from 'recharts';
import { financialApi } from '../../api/financial';
import { sriApi } from '../../api/sriDocuments';
import { useToast } from '../ui/Toast';
import { KanbanBoard, KanbanColumnDef } from '../kanban/KanbanBoard';

/**
 * Vistas del módulo Financiero: valoración de cartera (CxC), pagos (CxP)
 * y proyección de caja. La gestión vive aquí; los saldos contables, en el mayor.
 */

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BUCKETS: { key: string; label: string; tone: string }[] = [
  { key: 'current', label: 'Corriente', tone: 'text-green-600 dark:text-green-400' },
  { key: 'd30', label: '1–30 días', tone: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'd60', label: '31–60 días', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'd90', label: '61–90 días', tone: 'text-orange-600 dark:text-orange-400' },
  { key: 'over90', label: '+90 días', tone: 'text-red-600 dark:text-red-400' },
];

/** Bucket de antigüedad (mismo corte que BUCKETS) a partir de días de atraso. */
function bucketOf(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd30';
  if (daysOverdue <= 60) return 'd60';
  if (daysOverdue <= 90) return 'd90';
  return 'over90';
}

// Kanban de solo lectura por antigüedad — es la misma clasificación que ya calculan los
// buckets de arriba, sin una transición manual real (cobrar/pagar exigen su propio modal).
const AGING_KANBAN_COLUMNS: KanbanColumnDef[] = BUCKETS.map((b) => ({
  id: b.key, label: b.label, droppable: false, hint: 'Clasificación automática por antigüedad',
}));

function ViewToggle({ view, onChange }: { view: 'list' | 'kanban'; onChange: (v: 'list' | 'kanban') => void }) {
  return (
    <div className="flex bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-0.5 w-fit">
      <button onClick={() => onChange('list')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
        ☰ Lista
      </button>
      <button onClick={() => onChange('kanban')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
        ▦ Kanban
      </button>
    </div>
  );
}

function BucketCards({ buckets, total }: { buckets: any; total: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
        <p className="text-xs text-surface-500">Total</p>
        <p className="text-lg font-bold font-mono text-surface-900 dark:text-white mt-0.5">{money(total)}</p>
      </div>
      {BUCKETS.map((b) => (
        <div key={b.key} className="bg-white dark:bg-surface-800 rounded-xl p-3 border border-surface-200 dark:border-surface-700 shadow-soft">
          <p className="text-xs text-surface-500">{b.label}</p>
          <p className={`text-lg font-bold font-mono mt-0.5 ${b.tone}`}>{money(buckets?.[b.key] ?? 0)}</p>
        </div>
      ))}
    </div>
  );
}

function AgingBar({ buckets }: { buckets: any }) {
  const data = [{ name: 'Cartera', Corriente: buckets?.current ?? 0, '1-30': buckets?.d30 ?? 0, '31-60': buckets?.d60 ?? 0, '61-90': buckets?.d90 ?? 0, '+90': buckets?.over90 ?? 0 }];
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="name" hide />
        <Tooltip formatter={(v: any) => money(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Corriente" stackId="a" fill="#22c55e" />
        <Bar dataKey="1-30" stackId="a" fill="#eab308" />
        <Bar dataKey="31-60" stackId="a" fill="#f59e0b" />
        <Bar dataKey="61-90" stackId="a" fill="#f97316" />
        <Bar dataKey="+90" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Acciones sugeridas ───────────────────────────────────────────────────────
// Bandeja de trabajo: traduce el aging (buckets agregados) en tarjetas accionables — cuántos
// documentos y cuánto dinero, no solo el total. Se calcula en el cliente sobre datos ya
// cargados (byCustomer/bySupplier), sin pedir nada nuevo al backend.
type SuggestionKind = 'overdue' | 'dueSoon';

function computeSuggestions(groups: any[], itemsKey: 'invoices' | 'documents', dueField: 'dueDate') {
  const now = Date.now();
  const in7 = now + 7 * 86_400_000;
  let overdueCount = 0, overdueAmount = 0, dueSoonCount = 0, dueSoonAmount = 0;
  for (const g of groups) {
    for (const item of g[itemsKey] ?? []) {
      const due = item[dueField] ? new Date(item[dueField]).getTime() : null;
      const balance = item.balance ?? item.total ?? 0;
      if (due !== null && due < now) { overdueCount++; overdueAmount += balance; }
      else if (due !== null && due >= now && due <= in7) { dueSoonCount++; dueSoonAmount += balance; }
    }
  }
  return { overdueCount, overdueAmount: Math.round(overdueAmount * 100) / 100, dueSoonCount, dueSoonAmount: Math.round(dueSoonAmount * 100) / 100 };
}

function ActionSuggestions({ groups, itemsKey, mode, onFilter }: { groups: any[]; itemsKey: 'invoices' | 'documents'; mode: 'ar' | 'ap'; onFilter?: (kind: SuggestionKind) => void }) {
  const s = computeSuggestions(groups, itemsKey, 'dueDate');
  if (s.overdueCount === 0 && s.dueSoonCount === 0) return null;
  const overdueVerb = mode === 'ar' ? 'gestionar cobro' : 'programar pago';
  const dueSoonVerb = mode === 'ar' ? 'Priorizar seguimiento' : 'Programar pagos';

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Acciones sugeridas</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {s.overdueCount > 0 && (
          <button onClick={() => onFilter?.('overdue')}
            className="text-left bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/60 rounded-xl px-4 py-3 hover:border-red-400 dark:hover:border-red-600 transition-colors">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">🔴 {s.overdueCount} documento{s.overdueCount === 1 ? '' : 's'} vencido{s.overdueCount === 1 ? '' : 's'} por {money(s.overdueAmount)}</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">Revisar y {overdueVerb}.</p>
          </button>
        )}
        {s.dueSoonCount > 0 && (
          <button onClick={() => onFilter?.('dueSoon')}
            className="text-left bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800/60 rounded-xl px-4 py-3 hover:border-yellow-400 dark:hover:border-yellow-600 transition-colors">
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">🟡 {s.dueSoonCount} documento{s.dueSoonCount === 1 ? '' : 's'} vence{s.dueSoonCount === 1 ? '' : 'n'} esta semana por {money(s.dueSoonAmount)}</p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/70 mt-0.5">{dueSoonVerb}.</p>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Cartera (CxC) ────────────────────────────────────────────────────────────
export function ArAgingView({ customerId }: { customerId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    setLoading(true);
    financialApi.getArAging(customerId)
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <p className="text-center text-surface-400 py-10">No se pudo cargar la cartera.</p>;

  const focusGroup = (kind: 'overdue' | 'dueSoon') => {
    const now = Date.now();
    const in7 = now + 7 * 86_400_000;
    const match = data.byCustomer.find((c: any) => c.invoices.some((inv: any) => {
      const due = inv.dueDate ? new Date(inv.dueDate).getTime() : null;
      return kind === 'overdue' ? (due !== null && due < now) : (due !== null && due >= now && due <= in7);
    }));
    if (match) setOpen(match.customerId);
  };

  const flatInvoices = data.byCustomer.flatMap((c: any) => c.invoices.map((inv: any) => ({ ...inv, customerName: c.name })));

  return (
    <div className="space-y-4">
      <BucketCards buckets={data.buckets} total={data.total} />
      {data.total > 0 && <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 shadow-soft"><AgingBar buckets={data.buckets} /></div>}
      <ActionSuggestions groups={data.byCustomer} itemsKey="invoices" mode="ar" onFilter={focusGroup} />

      {data.byCustomer.length > 0 && <ViewToggle view={view} onChange={setView} />}

      {view === 'kanban' && data.byCustomer.length > 0 && (
        <KanbanBoard
          columns={AGING_KANBAN_COLUMNS}
          items={flatInvoices}
          getId={(inv: any) => inv.id}
          getColumnId={(inv: any) => bucketOf(inv.daysOverdue)}
          onMove={() => { /* de solo lectura: ver comentario en AGING_KANBAN_COLUMNS */ }}
          emptyLabel="Sin facturas"
          renderCard={(inv: any) => (
            <Link to={`/financial/invoices/${inv.id}`}
              className="block bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
              <p className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">{inv.number}</p>
              <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 truncate">{inv.customerName}</p>
              <p className="font-mono text-sm text-surface-900 dark:text-white">{money(inv.balance)}</p>
            </Link>
          )}
        />
      )}

      {view === 'list' && (data.byCustomer.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-surface-500 text-sm">No hay facturas de venta pendientes de cobro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.byCustomer.map((c: any) => (
            <div key={c.customerId} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <button onClick={() => setOpen(open === c.customerId ? null : c.customerId)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-700/30">
                <span className="font-medium text-surface-900 dark:text-white truncate">{c.name}</span>
                <span className="flex items-center gap-3 flex-shrink-0">
                  {c.buckets.over90 + c.buckets.d90 > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-medium">Vencida +60d</span>}
                  <span className="font-mono font-bold text-surface-900 dark:text-white">{money(c.total)}</span>
                  <span className="text-surface-400">{open === c.customerId ? '▴' : '▾'}</span>
                </span>
              </button>
              {open === c.customerId && (
                <table className="w-full text-sm border-t border-surface-100 dark:border-surface-700">
                  <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                    <th className="text-left px-4 py-2">Factura</th><th className="text-left px-4 py-2">Vence</th>
                    <th className="text-right px-4 py-2">Saldo</th><th className="text-right px-4 py-2">Días vencida</th><th className="px-4 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {c.invoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">{inv.number}</td>
                        <td className={`px-4 py-2 text-xs ${inv.daysOverdue > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}`}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es') : 'Sin vencimiento'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{money(inv.balance)}</td>
                        <td className={`px-4 py-2 text-right font-mono text-xs ${inv.daysOverdue > 0 ? 'text-red-500' : 'text-surface-400'}`}>{inv.daysOverdue || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <Link to={`/financial/invoices/${inv.id}`} className="text-xs text-brand-500 hover:underline whitespace-nowrap">Registrar cobro →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Pagos (CxP) ──────────────────────────────────────────────────────────────
export function ApAgingView() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const load = () => {
    setLoading(true);
    financialApi.getApAging().then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const pay = async (id: string) => {
    setPayingId(id);
    try { await sriApi.pay(id, true); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo registrar el pago'); }
    finally { setPayingId(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <p className="text-center text-surface-400 py-10">No se pudo cargar pagos.</p>;

  const focusGroup = (kind: 'overdue' | 'dueSoon') => {
    const now = Date.now();
    const in7 = now + 7 * 86_400_000;
    const match = data.bySupplier.find((s: any) => s.documents.some((d: any) => {
      const due = d.dueDate ? new Date(d.dueDate).getTime() : null;
      return kind === 'overdue' ? (due !== null && due < now) : (due !== null && due >= now && due <= in7);
    }));
    if (match) setOpen(match.supplierId ?? `s${data.bySupplier.indexOf(match)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-surface-500">Documentos SRI confirmados pendientes de pago, agrupados por proveedor.</p>
        <Link to="/sri" className="text-sm px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">📑 Ingresar factura (SRI)</Link>
      </div>
      <BucketCards buckets={data.buckets} total={data.total} />
      {data.total > 0 && <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 shadow-soft"><AgingBar buckets={data.buckets} /></div>}
      <ActionSuggestions groups={data.bySupplier} itemsKey="documents" mode="ap" onFilter={focusGroup} />

      {data.bySupplier.length > 0 && <ViewToggle view={view} onChange={setView} />}

      {view === 'kanban' && data.bySupplier.length > 0 && (
        <KanbanBoard
          columns={AGING_KANBAN_COLUMNS}
          items={data.bySupplier.flatMap((s: any) => s.documents.map((d: any) => ({ ...d, supplierName: s.name })))}
          getId={(d: any) => d.id}
          getColumnId={(d: any) => bucketOf(d.daysOverdue)}
          onMove={() => { /* de solo lectura: ver comentario en AGING_KANBAN_COLUMNS */ }}
          emptyLabel="Sin documentos"
          renderCard={(d: any) => (
            <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 shadow-sm">
              <p className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">{d.number || '—'}</p>
              <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 truncate">{d.supplierName}</p>
              <p className="font-mono text-sm text-surface-900 dark:text-white mb-2">{money(d.total)}</p>
              <button onClick={() => pay(d.id)} disabled={payingId === d.id}
                className="w-full text-xs py-1 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50">
                {payingId === d.id ? '…' : 'Pagar'}
              </button>
            </div>
          )}
        />
      )}

      {view === 'list' && (data.bySupplier.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-surface-500 text-sm">No hay facturas de compra pendientes de pago.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.bySupplier.map((s: any, idx: number) => {
            const key = s.supplierId ?? `s${idx}`;
            return (
            <div key={key} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <button onClick={() => setOpen(open === key ? null : key)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-700/30">
                <span className="font-medium text-surface-900 dark:text-white truncate">{s.name}</span>
                <span className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{money(s.total)}</span>
                  <span className="text-surface-400">{open === key ? '▴' : '▾'}</span>
                </span>
              </button>
              {open === key && (
                <table className="w-full text-sm border-t border-surface-100 dark:border-surface-700">
                  <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                    <th className="text-left px-4 py-2">Documento</th><th className="text-left px-4 py-2">OC</th>
                    <th className="text-left px-4 py-2">Vence</th><th className="text-right px-4 py-2">Total</th><th className="px-4 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {s.documents.map((d: any) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">{d.number || '—'}</td>
                        <td className="px-4 py-2 text-xs text-surface-500">{d.poNumber || '—'}</td>
                        <td className={`px-4 py-2 text-xs ${d.daysOverdue > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}`}>{new Date(d.dueDate).toLocaleDateString('es')}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{money(d.total)}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => pay(d.id)} disabled={payingId === d.id}
                            className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
                            {payingId === d.id ? '…' : 'Pagar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Proyección de caja (forecast semanal) ───────────────────────────────────
export function CashFlowForecastView() {
  const [data, setData] = useState<any>(null);
  const [weeks, setWeeks] = useState(8);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financialApi.getCashFlowForecast(weeks)
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [weeks]);

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <p className="text-center text-surface-400 py-10">No se pudo cargar la proyección.</p>;

  const chart = data.weeks.map((w: any) => ({
    name: `S${w.week}`,
    Entradas: w.inflows,
    Salidas: -w.outflows,
    'Caja proyectada': w.projectedCash,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-surface-500">Proyección desde vencimientos de cartera (entradas) y pagos (salidas). Caja actual: <strong className="font-mono">{money(data.openingCash)}</strong></p>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
          className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
          {[4, 8, 12, 16].map((n) => <option key={n} value={n}>{n} semanas</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chart} margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => '$' + Number(v).toLocaleString('es')} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => money(Math.abs(Number(v)))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Entradas" stroke="#22c55e" fill="#22c55e" fillOpacity={0.25} />
            <Area type="monotone" dataKey="Salidas" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
            <Area type="monotone" dataKey="Caja proyectada" stroke="#00B8E0" fill="#00B8E0" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
            <th className="text-left px-4 py-2.5">Semana</th><th className="text-right px-4 py-2.5">Entradas (CxC)</th>
            <th className="text-right px-4 py-2.5">Salidas (CxP)</th><th className="text-right px-4 py-2.5">Neto</th>
            <th className="text-right px-4 py-2.5">Caja proyectada</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {data.weeks.map((w: any) => (
              <tr key={w.week}>
                <td className="px-4 py-2.5 text-surface-700 dark:text-surface-300">Semana {w.week} <span className="text-xs text-surface-400">({new Date(w.startDate).toLocaleDateString('es')})</span></td>
                <td className="px-4 py-2.5 text-right font-mono text-green-600 dark:text-green-400">{w.inflows > 0 ? '+' + money(w.inflows) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">{w.outflows > 0 ? '−' + money(w.outflows) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono">{money(w.net)}</td>
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${w.projectedCash < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{money(w.projectedCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
