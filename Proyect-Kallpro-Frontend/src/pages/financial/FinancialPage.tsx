import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { financialApi } from '../../api/financial';
import { budgetApi } from '../../api/budget';
import { salesApi } from '../../api/sales';
import { useToast } from '../../components/ui/Toast';
import { sriApi } from '../../api/sriDocuments';
import { KanbanBoard, KanbanColumnDef } from '../../components/kanban/KanbanBoard';

// ── Factura styles ────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-surface-100 dark:bg-surface-500/20 text-surface-500 dark:text-surface-400',
  SENT: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PARTIAL: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  PAID: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  OVERDUE: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  CANCELLED: 'bg-surface-100 dark:bg-surface-600/20 text-surface-400 dark:text-surface-500',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', PARTIAL: 'Pago parcial', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada',
};

// Kanban de facturas: de solo lectura (ninguna columna es droppable). Pasar una factura a
// PAID exige registrar un Payment (con PaymentApplication) y pasarla a CANCELLED exige una
// Nota de Crédito con motivo/restock — ambos son flujos con formulario real, no un cambio de
// estado plano. Simplificarlos a un drag-and-drop rompería la trazabilidad de CxC/CxP.
const INVOICE_KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'DRAFT', label: STATUS_LABELS.DRAFT, droppable: false, hint: 'Emitir la factura se hace desde el detalle' },
  { id: 'SENT', label: STATUS_LABELS.SENT, droppable: false, hint: 'Registrar un pago se hace desde Cobrar/Pagar o el detalle de la factura' },
  { id: 'PARTIAL', label: STATUS_LABELS.PARTIAL, droppable: false, hint: 'Registrar un pago se hace desde Cobrar/Pagar o el detalle de la factura' },
  { id: 'PAID', label: STATUS_LABELS.PAID, droppable: false, hint: 'Estado resultante de aplicar un pago completo' },
  { id: 'OVERDUE', label: STATUS_LABELS.OVERDUE, droppable: false, hint: 'Se calcula automáticamente por fecha de vencimiento' },
  { id: 'CANCELLED', label: STATUS_LABELS.CANCELLED, droppable: false, hint: 'Anular una factura exige una Nota de Crédito con motivo — hazlo desde el detalle' },
];

// ── Budget helpers ────────────────────────────────────────────
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const color = status === 'EXCEEDED' ? 'bg-red-500' : status === 'CRITICAL' ? 'bg-red-400' : status === 'WARNING' ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2 mt-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function FinancialPage() {
  const toast = useToast();
  const [mainTab, setMainTab] = useState<'facturas' | 'presupuesto' | 'cobrar' | 'pagar'>('facturas');

  // AR/AP state
  const [arCustomers, setArCustomers] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [loadingArAp, setLoadingArAp] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadPayables = () => {
    setLoadingArAp(true);
    sriApi.payables().then((r) => setPayables(r.data)).catch(() => {}).finally(() => setLoadingArAp(false));
  };

  useEffect(() => {
    if (mainTab === 'cobrar' && arCustomers.length === 0) {
      setLoadingArAp(true);
      salesApi.getCustomers().then((r) => setArCustomers(r.data)).catch(() => {}).finally(() => setLoadingArAp(false));
    }
    if (mainTab === 'pagar' && payables.length === 0) {
      loadPayables();
    }
  }, [mainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async (id: string, paid: boolean) => {
    setPayingId(id);
    try {
      await sriApi.pay(id, paid);
      loadPayables();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo actualizar el pago');
    } finally {
      setPayingId(null);
    }
  };

  // ── Facturas state ──
  const [kpis, setKpis] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceTab, setInvoiceTab] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');
  const [invoicesView, setInvoicesView] = useState<'list' | 'kanban'>('list');
  const [loadingInv, setLoadingInv] = useState(true);

  useEffect(() => {
    Promise.all([financialApi.getKPIs(), financialApi.getInvoices()])
      .then(([k, i]) => { setKpis(k.data); setInvoices(i.data); })
      .finally(() => setLoadingInv(false));
  }, []);

  useEffect(() => {
    financialApi.getInvoices(invoiceTab === 'ALL' ? undefined : invoiceTab).then((r) => setInvoices(r.data));
  }, [invoiceTab]);

  // ── Presupuesto state ──
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [form, setForm] = useState({ departmentId: '', budgetAmount: '', notes: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  const loadBudget = () => {
    setLoadingBudget(true);
    Promise.all([budgetApi.getSummary(year, month), budgetApi.getDepartments()])
      .then(([s, d]) => { setSummary(s.data); setDepartments(d.data); })
      .finally(() => setLoadingBudget(false));
  };

  useEffect(() => {
    if (mainTab === 'presupuesto') loadBudget();
  }, [mainTab, year, month]);

  const totalBudget = summary.reduce((s, b) => s + b.budgetAmount, 0);
  const totalConsumed = summary.reduce((s, b) => s + b.consumed, 0);
  const totalRemaining = totalBudget - totalConsumed;

  const handleSaveBudget = async () => {
    if (!form.budgetAmount) return;
    setSaving(true);
    try {
      await budgetApi.upsertBudget({ departmentId: form.departmentId || undefined, year, month, budgetAmount: parseFloat(form.budgetAmount), notes: form.notes });
      setForm({ departmentId: '', budgetAmount: '', notes: '' });
      setShowForm(false);
      loadBudget();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleSaveDept = async () => {
    if (!deptForm.name) return;
    setSaving(true);
    try {
      await budgetApi.createDepartment(deptForm);
      setDeptForm({ name: '', code: '' });
      setShowDeptForm(false);
      loadBudget();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  if (loadingInv && mainTab === 'facturas') return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  const kpiCard = (label: string, value: number, color = 'text-surface-900 dark:text-white') => (
    <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
      <p className="text-surface-500 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>${value.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🧾</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Facturas</h1>
            <p className="text-sm text-surface-500">Gestión financiera y presupuesto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/financial/analytics" className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">
            📈 KPI Analytics
          </Link>
          {mainTab === 'facturas' ? (
            <Link to="/financial/invoices/new" className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              + Nueva Factura
            </Link>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowDeptForm(!showDeptForm)}
                className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 px-4 py-2 rounded-lg text-sm transition-colors">
                + Departamento
              </button>
              <button onClick={() => setShowForm(!showForm)}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                + Asignar Presupuesto
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 dark:bg-surface-800 rounded-lg p-1 w-fit flex-wrap">
        <button onClick={() => setMainTab('facturas')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'facturas' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
          💰 Facturas
        </button>
        <button onClick={() => setMainTab('presupuesto')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'presupuesto' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
          📊 Presupuesto
        </button>
        <button onClick={() => setMainTab('cobrar')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'cobrar' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
          📥 Cuentas por Cobrar
        </button>
        <button onClick={() => setMainTab('pagar')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'pagar' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
          📤 Cuentas por Pagar
        </button>
      </div>

      {/* ══════════ CUENTAS POR COBRAR ══════════ */}
      {mainTab === 'cobrar' && (
        <div className="space-y-4">
          {loadingArAp ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
          ) : (() => {
            const withBalance = arCustomers.filter((c) => Number(c.balance || 0) > 0)
              .sort((a, b) => Number(b.balance) - Number(a.balance));
            const totalAR = withBalance.reduce((s, c) => s + Number(c.balance), 0);
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total a cobrar', value: `$${totalAR.toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Clientes con saldo', value: withBalance.length, color: 'text-brand-600 dark:text-brand-400' },
                    { label: 'Total clientes', value: arCustomers.length, color: 'text-surface-800 dark:text-white' },
                    { label: 'Saldo promedio', value: withBalance.length > 0 ? `$${(totalAR / withBalance.length).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—', color: 'text-surface-700 dark:text-surface-300', small: true },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
                      <p className="text-xs text-surface-500 uppercase tracking-wider">{kpi.label}</p>
                      <p className={`${kpi.small ? 'text-base' : 'text-2xl'} font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                        <th className="text-left px-4 py-3">Cliente</th>
                        <th className="text-left px-4 py-3">RUC</th>
                        <th className="text-right px-4 py-3">Línea crédito</th>
                        <th className="text-right px-4 py-3">Saldo</th>
                        <th className="text-right px-4 py-3">Uso %</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {withBalance.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-surface-400">Sin clientes con saldo pendiente.</td></tr>}
                      {withBalance.map((c) => {
                        const limit = Number(c.creditLimit || 0);
                        const balance = Number(c.balance || 0);
                        const pct = limit > 0 ? Math.round((balance / limit) * 100) : 0;
                        return (
                          <tr key={c.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                            <td className="px-4 py-3 text-surface-800 dark:text-white font-medium">{c.razonSocial || c.name}</td>
                            <td className="px-4 py-3 text-surface-500 font-mono text-sm">{c.ruc || '—'}</td>
                            <td className="px-4 py-3 text-right font-mono">${limit.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right font-mono text-yellow-600 dark:text-yellow-400 font-semibold">${balance.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                            <td className={`px-4 py-3 text-right font-mono ${pct >= 90 ? 'text-red-600 dark:text-red-400' : pct >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>{pct}%</td>
                            <td className="px-4 py-3"><Link to={`/sales/customers/${c.id}`} className="text-brand-500 text-sm">Ver →</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══════════ CUENTAS POR PAGAR ══════════ */}
      {mainTab === 'pagar' && (
        <div className="space-y-4">
          {loadingArAp ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
          ) : (() => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const pendientes = payables.filter((p) => p.paymentStatus !== 'PAID');
            const totalPagar = pendientes.reduce((s, p) => s + Number(p.total || 0), 0);
            const vencidas = pendientes.filter((p) => new Date(p.dueDate) < today);
            const totalVencido = vencidas.reduce((s, p) => s + Number(p.total || 0), 0);
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total a pagar', value: `$${totalPagar.toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Vencido', value: `$${totalVencido.toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-red-600 dark:text-red-400' },
                    { label: 'Facturas pendientes', value: `${pendientes.length}`, color: 'text-brand-600 dark:text-brand-400' },
                    { label: 'Facturas vencidas', value: `${vencidas.length}`, color: 'text-red-600 dark:text-red-400' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
                      <p className="text-xs text-surface-500 uppercase tracking-wider">{kpi.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                        <th className="text-left px-4 py-3">Factura</th>
                        <th className="text-left px-4 py-3">Proveedor</th>
                        <th className="text-left px-4 py-3">Emisión</th>
                        <th className="text-left px-4 py-3">Vencimiento</th>
                        <th className="text-right px-4 py-3">Total</th>
                        <th className="text-center px-4 py-3">Estado</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {payables.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-surface-400">Sin facturas de compra confirmadas. Confirma facturas SRI para verlas aquí.</td></tr>}
                      {payables.map((p) => {
                        const paid = p.paymentStatus === 'PAID';
                        const overdue = !paid && new Date(p.dueDate) < today;
                        return (
                          <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                            <td className="px-4 py-3 font-mono text-sm text-brand-600 dark:text-brand-400">{p.numeroDoc || '—'}</td>
                            <td className="px-4 py-3 text-surface-800 dark:text-white">{p.supplierName}</td>
                            <td className="px-4 py-3 text-surface-500 text-sm">{new Date(p.fechaEmision).toLocaleDateString('es')}</td>
                            <td className={`px-4 py-3 text-sm ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}`}>{new Date(p.dueDate).toLocaleDateString('es')}</td>
                            <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">${Number(p.total).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                paid ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                : overdue ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                                : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                {paid ? 'Pagada' : overdue ? 'Vencida' : 'Pendiente'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {paid ? (
                                <button onClick={() => handlePay(p.id, false)} disabled={payingId === p.id}
                                  className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-white underline disabled:opacity-50">Revertir</button>
                              ) : (
                                <button onClick={() => handlePay(p.id, true)} disabled={payingId === p.id}
                                  className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
                                  {payingId === p.id ? '...' : 'Marcar pagada'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══════════════════ FACTURAS TAB ══════════════════ */}
      {mainTab === 'facturas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {kpiCard('Total Ventas', kpis?.totalSales ?? 0, 'text-green-600 dark:text-green-400')}
            {kpiCard('Cuentas por Cobrar', kpis?.accountsReceivable ?? 0, 'text-brand-600 dark:text-brand-400')}
            {kpiCard('Vencido por Cobrar', kpis?.overdueReceivable ?? 0, 'text-red-600 dark:text-red-400')}
            {kpiCard('Total Compras', kpis?.totalPurchases ?? 0, 'text-yellow-600 dark:text-yellow-400')}
            {kpiCard('Cuentas por Pagar', kpis?.accountsPayable ?? 0, 'text-orange-600 dark:text-orange-400')}
            {kpiCard('Flujo Neto de Caja', kpis?.netCashFlow ?? 0, (kpis?.netCashFlow ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2">
              {(['ALL', 'SALES', 'PURCHASE'] as const).map((t) => (
                <button key={t} onClick={() => setInvoiceTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${invoiceTab === t ? 'bg-brand-500 text-white' : 'border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'}`}>
                  {t === 'ALL' ? 'Todas' : t === 'SALES' ? 'Ventas' : 'Compras'}
                </button>
              ))}
            </div>
            <div className="flex bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-0.5">
              <button onClick={() => setInvoicesView('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${invoicesView === 'list' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
                ☰ Lista
              </button>
              <button onClick={() => setInvoicesView('kanban')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${invoicesView === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
                ▦ Kanban
              </button>
            </div>
          </div>

          {invoicesView === 'kanban' && (
            <KanbanBoard
              columns={INVOICE_KANBAN_COLUMNS}
              items={invoices.filter((inv) => INVOICE_KANBAN_COLUMNS.some((c) => c.id === inv.status))}
              getId={(inv) => inv.id}
              getColumnId={(inv) => inv.status}
              onMove={() => { /* de solo lectura: ver comentario en INVOICE_KANBAN_COLUMNS */ }}
              emptyLabel="Sin facturas"
              renderCard={(inv) => (
                <Link to={`/financial/invoices/${inv.id}`}
                  className="block bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400">{inv.number}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.type === 'SALES' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                      {inv.type === 'SALES' ? 'Venta' : 'Compra'}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-surface-800 dark:text-white">${Number(inv.totalAmount).toFixed(2)}</p>
                  <p className="text-xs text-surface-500">Saldo: ${(Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2)}</p>
                </Link>
              )}
            />
          )}

          {invoicesView === 'list' && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">N° Factura</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Vencimiento</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Pagado</th>
                  <th className="text-right px-4 py-3">Saldo</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {invoices.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-surface-500">No hay facturas. Crea la primera.</td></tr>
                )}
                {invoices.map((inv) => {
                  const saldo = Number(inv.totalAmount) - Number(inv.paidAmount);
                  return (
                    <tr key={inv.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-brand-600 dark:text-brand-400">{inv.number}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${inv.type === 'SALES' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                          {inv.type === 'SALES' ? 'Venta' : 'Compra'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-sm">{new Date(inv.createdAt).toLocaleDateString('es')}</td>
                      <td className="px-4 py-3 text-surface-500 text-sm">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es') : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-surface-900 dark:text-white">${Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">${Number(inv.paidAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-yellow-600 dark:text-yellow-400">${saldo.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/financial/invoices/${inv.id}`} className="text-brand-600 dark:text-brand-400 hover:underline text-sm">Ver →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* ══════════════════ PRESUPUESTO TAB ══════════════════ */}
      {mainTab === 'presupuesto' && (
        <div className="space-y-6">
          {/* Selector mes/año */}
          <div className="flex items-center gap-3">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* KPI totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
              <p className="text-surface-500 text-sm">Presupuesto Total del Mes</p>
              <p className="text-2xl font-bold mt-1 text-surface-900 dark:text-white">${totalBudget.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
              <p className="text-surface-500 text-sm">Consumido</p>
              <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">${totalConsumed.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
              {totalBudget > 0 && <p className="text-xs text-surface-500 mt-1">{Math.round((totalConsumed / totalBudget) * 100)}% del total</p>}
            </div>
            <div className={`bg-white dark:bg-surface-800 rounded-xl p-5 border shadow-soft ${totalRemaining < 0 ? 'border-red-300 dark:border-red-700' : 'border-surface-200 dark:border-surface-700'}`}>
              <p className="text-surface-500 text-sm">Disponible</p>
              <p className={`text-2xl font-bold mt-1 ${totalRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                ${totalRemaining.toLocaleString('es', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Formulario nuevo departamento */}
          {showDeptForm && (
            <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-4">
              <h3 className="font-medium text-surface-700 dark:text-surface-300 mb-3">Nuevo Departamento</h3>
              <div className="flex gap-3">
                <input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Nombre del departamento *"
                  className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="Código (opcional)"
                  className="w-36 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button onClick={handleSaveDept} disabled={saving}
                  className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm">Guardar</button>
                <button onClick={() => setShowDeptForm(false)}
                  className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 px-4 py-2 rounded-lg text-sm">Cancelar</button>
              </div>
            </div>
          )}

          {/* Formulario asignar presupuesto */}
          {showForm && (
            <div className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-700 shadow-soft p-4">
              <h3 className="font-medium text-surface-700 dark:text-surface-300 mb-3">Asignar Presupuesto — {MONTHS[month-1]} {year}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-surface-600 dark:text-surface-400">Departamento</label>
                  <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">General (sin departamento)</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-600 dark:text-surface-400">Monto Presupuestado *</label>
                  <input type="number" min="0" step="0.01" value={form.budgetAmount}
                    onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
                    className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-surface-600 dark:text-surface-400">Notas</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleSaveBudget} disabled={saving}
                  className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm">Guardar Presupuesto</button>
                <button onClick={() => setShowForm(false)}
                  className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 px-4 py-2 rounded-lg text-sm">Cancelar</button>
              </div>
            </div>
          )}

          {/* Cards por departamento */}
          {loadingBudget ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : summary.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft">
              <p className="text-surface-500 text-lg mb-2">No hay presupuestos para {MONTHS[month-1]} {year}</p>
              <p className="text-surface-400 text-sm">Usa el botón "Asignar Presupuesto" para configurar los presupuestos del mes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map((b) => (
                <div key={b.id} className={`bg-white dark:bg-surface-800 rounded-xl border shadow-soft p-5 ${
                  b.status === 'EXCEEDED' ? 'border-red-300 dark:border-red-700' :
                  b.status === 'CRITICAL' ? 'border-red-200 dark:border-red-700/50' :
                  b.status === 'WARNING' ? 'border-yellow-200 dark:border-yellow-700/50' : 'border-surface-200 dark:border-surface-700'}`}>
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-surface-900 dark:text-white">{b.departmentName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.status === 'EXCEEDED' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                      b.status === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                      b.status === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                    }`}>{b.percentUsed}%</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-surface-500">Consumido</span>
                      <span className="font-mono text-surface-900 dark:text-white">${b.consumed.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <ProgressBar percent={b.percentUsed} status={b.status} />
                    <div className="flex justify-between text-xs text-surface-400 mt-1">
                      <span>$0</span>
                      <span>${b.budgetAmount.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex justify-between text-sm">
                    <span className="text-surface-500">Disponible</span>
                    <span className={`font-bold ${b.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      ${b.remaining.toLocaleString('es', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {b.status === 'EXCEEDED' && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded p-2">
                      ⚠ Presupuesto excedido. Nuevas compras requieren aprobación de Gerencia.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
