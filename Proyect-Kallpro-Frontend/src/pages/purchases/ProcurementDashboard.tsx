import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Cell,
} from 'recharts';
import { procurementApi } from '../../api/procurement';
import { reportsApi } from '../../api/reports';

interface Props { embedded?: boolean; }

const SUPPLIER_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ProcurementDashboard({ embedded = false }: Props) {
  const [kpis, setKpis]         = useState<any>(null);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading]   = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await procurementApi.getProcurementKPIs();
      setKpis(res.data);
    } catch {}
    setLoading(false);
  }

  async function loadInsights() {
    setLoadingAI(true);
    try {
      const res = await procurementApi.getProcurementInsights();
      setInsights(res.data.insights);
    } catch {
      setInsights('No se pudo conectar con Ollama. Verifica que esté corriendo en puerto 11434.');
    }
    setLoadingAI(false);
  }

  async function exportExcel() {
    setExporting(true);
    try { await reportsApi.purchasesExcel(); } catch {} finally { setExporting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-surface-400">Cargando analytics...</div>
  );

  if (!kpis) return (
    <div className="flex items-center justify-center py-24 text-surface-400 text-sm">Sin datos disponibles</div>
  );

  // Datos para Recharts (transformación segura)
  const monthlyData = (kpis.monthlySpend ?? []).map((m: any) => ({
    month: m.month?.slice(5) || m.month,
    total: Number(m.total) || 0,
  }));

  const supplierData = (kpis.topSuppliers ?? []).map((s: any) => ({
    name: s.name?.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    fullName: s.name,
    total: Number(s.total) || 0,
    supplierId: s.supplierId,
  }));

  return (
    <div className={`space-y-6${embedded ? ' p-5' : ''}`}>
      {/* Header con export */}
      {!embedded && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📊</div>
            <div>
              <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Procurement Analytics</h1>
              <p className="text-sm text-surface-500">KPIs y métricas de compras</p>
            </div>
          </div>
          <button onClick={exportExcel} disabled={exporting}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
            {exporting ? 'Generando...' : '📥 Exportar Excel'}
          </button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gasto del mes', value: `$${Number(kpis.totalSpendMonth || 0).toFixed(2)}`, sub: `${kpis.totalOrders} órdenes totales`, color: 'text-green-600 dark:text-green-400' },
          { label: 'OC Pendientes', value: kpis.pendingOrders, sub: 'Por aprobar / recibir', color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Tiempo aprobación', value: kpis.avgApprovalDays > 0 ? `${kpis.avgApprovalDays}d` : '—', sub: 'Promedio días', color: 'text-brand-600 dark:text-brand-400' },
          {
            label: 'Entregas a tiempo',
            value: kpis.onTimeDeliveryRate !== null ? `${kpis.onTimeDeliveryRate}%` : 'N/D',
            sub: 'Últimos 6 meses',
            color: kpis.onTimeDeliveryRate === null ? 'text-surface-400' : kpis.onTimeDeliveryRate >= 80 ? 'text-green-600 dark:text-green-400' : kpis.onTimeDeliveryRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-50 dark:bg-surface-900/50 border border-surface-100 dark:border-surface-700 rounded-2xl p-4">
            <p className="text-xs text-surface-500 uppercase">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-surface-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly spend - Recharts ComposedChart */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white">📈 Gasto mensual (OCs recibidas)</h3>
            <span className="text-xs text-surface-400">{monthlyData.length} meses</span>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: any) => [`$${Number(v).toLocaleString('es', { minimumFractionDigits: 2 })}`, 'Gasto']}
                />
                <Bar dataKey="total" fill="#00B8E0" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="total" stroke="#0D1F6E" strokeWidth={2} dot={{ fill: '#0D1F6E', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">Sin datos de historial</p>
          )}
        </div>

        {/* Top suppliers - Horizontal BarChart */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white">🏆 Top proveedores del mes</h3>
            <span className="text-xs text-surface-400">{supplierData.length} proveedores</span>
          </div>
          {supplierData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={supplierData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: any, _n: any, p: any) => [`$${Number(v).toLocaleString('es', { minimumFractionDigits: 2 })}`, p.payload.fullName]}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {supplierData.map((_: any, i: number) => (
                    <Cell key={i} fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">Sin órdenes este mes</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-surface-800 dark:text-white">🤖 Análisis Estratégico IA</h3>
          <button
            onClick={loadInsights}
            disabled={loadingAI}
            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {loadingAI ? '⏳ Analizando...' : '✨ Generar Insights'}
          </button>
        </div>
        {insights ? (
          <div className="text-surface-700 dark:text-surface-300 text-sm whitespace-pre-wrap leading-relaxed bg-surface-50 dark:bg-surface-900/50 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
            {insights}
          </div>
        ) : (
          <p className="text-surface-400 text-sm text-center py-4">
            Haz clic en "Generar Insights" para obtener recomendaciones estratégicas de Ollama
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/purchases/requisitions', icon: '📋', label: 'Requisiciones', sub: kpis.totalRequisitions > 0 ? `${kpis.totalRequisitions} este mes` : '' },
          { to: '/approvals', icon: '✅', label: 'Aprobaciones', sub: '' },
          { to: '/purchases/suppliers/ranking', icon: '🏅', label: 'Ranking', sub: '' },
          { to: '/purchases/analytics', icon: '📊', label: 'Analytics avanzado', sub: '' },
        ].map((link) => (
          <Link key={link.to} to={link.to} className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-4 text-center transition-colors">
            <p className="text-xl mb-1">{link.icon}</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">{link.label}</p>
            {link.sub && <p className="text-xs text-surface-400 mt-0.5">{link.sub}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
