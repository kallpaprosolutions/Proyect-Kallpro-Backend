import { useEffect, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { dashboardApi } from '../../api/dashboard';
import { useTheme } from '../../hooks/useTheme';
import {
  CHART_COLORS, getTooltipStyle, getLegendStyle, getGridProps, getAxisProps, fmt, barAnimation,
} from '../../lib/chartTheme';
import StatCard from '../../components/ui/StatCard';
import { SkeletonStatCards, SkeletonCard } from '../../components/ui/Skeleton';
import {
  Package, DollarSign, Clock, ShoppingCart, FileText, CreditCard,
} from 'lucide-react';

const fmtCurrency = fmt.currency;
const fmtInt = fmt.integer;

export default function GerencialDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

  useEffect(() => {
    dashboardApi.getExecutive()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => window.print();

  const tooltip = getTooltipStyle(isDark);
  const legend = getLegendStyle(isDark);
  const grid = getGridProps(isDark);
  const axis = getAxisProps(isDark);

  if (loading) return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
          <div className="h-3 w-32 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
        </div>
      </div>
      <SkeletonStatCards count={6} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonCard className="lg:col-span-2 h-72" />
        <SkeletonCard className="h-72" />
      </div>
    </div>
  );

  const { kpis, charts, budget, lowStock, requisitions } = data ?? {};

  return (
    <div className="max-w-screen-xl mx-auto" id="dashboard-print">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Panel Gerencial</h1>
            <p className="text-sm text-surface-500">{new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <button onClick={handlePrint}
          className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
          Imprimir Informe
        </button>
      </div>

      <div className="space-y-8">
        {/* ─── KPIs con storytelling ─── */}
        <section>
          <h2 className="text-xs uppercase text-surface-400 font-semibold mb-3 tracking-wider">Indicadores del Mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Valor de Inventario" value={fmtCurrency(kpis?.totalInventoryValue ?? 0)}
              icon={<Package className="w-5 h-5" />} color="brand" index={0} />
            <StatCard label="Gasto del Mes" value={fmtCurrency(kpis?.monthlySpend ?? 0)}
              icon={<ShoppingCart className="w-5 h-5" />} subtitle="OCs recibidas" color="purple" index={1} />
            <StatCard label="Aprobaciones" value={fmtInt(kpis?.pendingApprovals ?? 0)}
              icon={<Clock className="w-5 h-5" />}
              color={kpis?.pendingApprovals > 0 ? 'amber' : 'emerald'} index={2}
              subtitle={kpis?.pendingApprovals > 0 ? 'Pendientes' : 'Al día'} />
            <StatCard label="OCs Pendientes" value={fmtInt(kpis?.pendingPOs ?? 0)}
              icon={<FileText className="w-5 h-5" />}
              color={kpis?.pendingPOs > 0 ? 'amber' : 'emerald'} index={3} />
            <StatCard label="Compras SRI" value={fmtCurrency(kpis?.sriTotalMes ?? 0)}
              icon={<FileText className="w-5 h-5" />} subtitle="Mes actual" color="blue" index={4} />
            <StatCard label="IVA Crédito" value={fmtCurrency(kpis?.sriIVAMes ?? 0)}
              icon={<CreditCard className="w-5 h-5" />} subtitle="Mes actual" color="emerald" index={5} />
          </div>
        </section>

        {/* ─── Gráficos principales ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up">
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">Gasto de Compras — Últimos 6 Meses</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.spendTrend ?? []} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="mes" {...axis} />
                <YAxis {...axis} tickFormatter={fmt.currencyK} />
                <Tooltip {...tooltip} formatter={(v: any) => [fmtCurrency(Number(v)), 'Total Compras']} />
                <Bar dataKey="total" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} {...barAnimation} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">Top 5 Proveedores</h3>
            {charts?.topSuppliers?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={charts.topSuppliers} dataKey="total" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false} {...barAnimation}>
                    {charts.topSuppliers.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS.categorical[index % CHART_COLORS.categorical.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltip} formatter={(v: any, name: any) => [fmtCurrency(Number(v)), name]} />
                  <Legend {...legend} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-surface-400 text-sm">Sin datos</div>
            )}
          </div>
        </section>

        {/* ─── Top productos + Bajo stock ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up">
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">Top 5 Productos por Valor de Stock</h3>
            {charts?.top5Products?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.top5Products} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid {...grid} horizontal={false} />
                  <XAxis type="number" {...axis} tickFormatter={fmt.currencyK} />
                  <YAxis type="category" dataKey="name" {...axis} width={120}
                    tickFormatter={(v: string) => v.length > 18 ? v.substring(0, 18) + '…' : v} />
                  <Tooltip {...tooltip} formatter={(v: any) => [fmtCurrency(Number(v)), 'Valor']} />
                  <Bar dataKey="value" fill={CHART_COLORS.categorical[1]} radius={[0, 4, 4, 0]} {...barAnimation} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-surface-400 text-sm">Sin datos de inventario</div>
            )}
          </div>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">
              Alertas de Stock Bajo
              {lowStock?.length > 0 && (
                <span className="ml-2 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">{lowStock.length}</span>
              )}
            </h3>
            {lowStock?.length === 0 ? (
              <div className="flex items-center justify-center h-[200px]">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-green-600 dark:text-green-400 text-sm font-medium">Todos los productos con stock adecuado</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {lowStock?.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-white">{p.name}</p>
                      {p.sku && <p className="text-xs text-surface-500">{p.sku}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${p.qty === 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {p.qty === 0 ? 'SIN STOCK' : `${p.qty.toFixed(1)} uds`}
                      </p>
                      <p className="text-xs text-surface-500">Mínimo: {p.minStock}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Presupuesto vs Actual ─── */}
        {budget?.length > 0 && (
          <section>
            <h2 className="text-xs uppercase text-surface-400 font-semibold mb-3 tracking-wider">Presupuesto vs Consumo — Mes Actual</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden animate-fade-in-up">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-4 py-3">Departamento</th>
                      <th className="text-right px-4 py-3">Presupuesto</th>
                      <th className="text-right px-4 py-3">Consumido</th>
                      <th className="text-right px-4 py-3">Disponible</th>
                      <th className="text-center px-4 py-3">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {budget.map((b: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-white">{b.department}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-surface-700 dark:text-surface-300">{fmtCurrency(b.budgetAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-yellow-600 dark:text-yellow-400">{fmtCurrency(b.consumed)}</td>
                        <td className={`px-4 py-3 text-right font-mono text-sm ${b.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {fmtCurrency(b.remaining)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-100 dark:bg-surface-700 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${b.percentUsed >= 100 ? 'bg-red-500' : b.percentUsed >= 90 ? 'bg-red-400' : b.percentUsed >= 70 ? 'bg-yellow-400' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(b.percentUsed, 100)}%` }} />
                            </div>
                            <span className="text-xs text-surface-500 w-8 text-right">{b.percentUsed}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4 text-sm">Comparativo por Departamento</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={budget} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid {...grid} />
                    <XAxis dataKey="department" {...axis}
                      tickFormatter={(v: string) => v.length > 10 ? v.substring(0, 10) + '…' : v} />
                    <YAxis {...axis} tickFormatter={fmt.currencyK} />
                    <Tooltip {...tooltip}
                      formatter={(v: any, name: any) => [fmtCurrency(Number(v)), name === 'budgetAmount' ? 'Presupuesto' : 'Consumido']} />
                    <Legend {...legend}
                      formatter={(v: string) => v === 'budgetAmount' ? 'Presupuesto' : 'Consumido'} />
                    <Bar dataKey="budgetAmount" fill={isDark ? CHART_COLORS.budgetDark : CHART_COLORS.budget} radius={[4, 4, 0, 0]} {...barAnimation} />
                    <Bar dataKey="consumed" fill={CHART_COLORS.actual} radius={[4, 4, 0, 0]} {...barAnimation} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* ─── Estado de Requisiciones ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up">
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">Estado de Requisiciones</h3>
            {Object.keys(requisitions?.byStatus ?? {}).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={Object.entries(requisitions.byStatus).map(([status, count]) => ({
                      name: {
                        DRAFT: 'Borrador', PENDING_L1: 'Pend. L1', PENDING_L2: 'Pend. L2',
                        PENDING_L3: 'Pend. Gerencia', APPROVED: 'Aprobadas', QUOTED: 'En Cotización',
                        PO_CREATED: 'OC Generada', REJECTED: 'Rechazadas',
                      }[status] ?? status,
                      value: count,
                    }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false} {...barAnimation}>
                    {Object.keys(requisitions.byStatus).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS.categorical[index % CHART_COLORS.categorical.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltip} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-surface-400 text-sm">Sin requisiciones</div>
            )}
          </div>

          {/* Resumen ejecutivo */}
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-4">Resumen Ejecutivo</h3>
            <div className="space-y-3">
              {[
                { label: 'Valor Total Inventario', value: fmtCurrency(kpis?.totalInventoryValue ?? 0), color: 'text-brand-600 dark:text-brand-400' },
                { label: 'Compras del Mes (OCs)', value: fmtCurrency(kpis?.monthlySpend ?? 0), color: 'text-surface-900 dark:text-white' },
                { label: 'Compras SRI del Mes', value: fmtCurrency(kpis?.sriTotalMes ?? 0), color: 'text-surface-900 dark:text-white' },
                { label: 'IVA Crédito Fiscal del Mes', value: fmtCurrency(kpis?.sriIVAMes ?? 0), color: 'text-green-600 dark:text-green-400' },
                { label: 'Retenciones IR del Mes', value: fmtCurrency(kpis?.sriRetencionMes ?? 0), color: 'text-surface-900 dark:text-white' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-surface-100 dark:border-surface-700 pb-3">
                  <span className="text-surface-500 text-sm">{item.label}</span>
                  <span className={`font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-surface-500 text-sm">Aprobaciones Pendientes</span>
                <span className={`font-bold ${kpis?.pendingApprovals > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                  {kpis?.pendingApprovals ?? 0}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="text-center text-surface-400 text-xs pb-4 print:block">
          KallpaPro ERP — Informe generado: {new Date().toLocaleString('es-EC')}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .bg-surface-800 { background: #f9fafb !important; }
          .dark\\:text-white { color: #111827 !important; }
          .border-surface-700 { border-color: #e5e7eb !important; }
          .text-surface-500 { color: #6b7280 !important; }
        }
      `}</style>
    </div>
  );
}
