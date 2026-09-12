import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
} from 'recharts';
import { procurementApi } from '../../api/procurement';
import { purchasesApi } from '../../api/purchases';
import { reportsApi } from '../../api/reports';

const RANGES = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];
const PIE_COLORS = ['#00B8E0', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#0ea5e9', '#84cc16'];

function fmtMoney(v: number) {
  return `$${Number(v || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function SpendAnalyticsPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(6);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setError('');
    setLoading(true);
    const results = await Promise.allSettled([
      procurementApi.getProcurementKPIs(),
      purchasesApi.getOrders(),
    ]);
    const allFailed = results.every((r) => r.status === 'rejected');
    if (allFailed) {
      setError('No se pudo cargar los datos. Verifica que el backend esté corriendo.');
      setLoading(false);
      return;
    }
    if (results[0].status === 'fulfilled') setKpis(results[0].value.data);
    if (results[1].status === 'fulfilled') setOrders(results[1].value.data);
    setLoading(false);
  }

  async function exportExcel() {
    setExporting(true);
    try { await reportsApi.purchasesExcel(); } catch {} finally { setExporting(false); }
  }

  // Filtrar monthly data por rango
  const trendData = useMemo(() => {
    const list = (kpis?.monthlySpend ?? []) as any[];
    const sliced = list.slice(-range);
    return sliced.map((m) => ({
      month: m.month?.slice(5) || m.month,
      total: Number(m.total) || 0,
    }));
  }, [kpis, range]);

  // Top suppliers
  const supplierData = useMemo(() => {
    return ((kpis?.topSuppliers ?? []) as any[]).map((s) => ({
      name: s.name?.length > 18 ? s.name.slice(0, 18) + '…' : s.name,
      fullName: s.name,
      total: Number(s.total) || 0,
      supplierId: s.supplierId,
    }));
  }, [kpis]);

  // Breakdown por status (de las orders)
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const k = o.status || 'UNKNOWN';
      map[k] = (map[k] || 0) + Number(o.totalAmount || 0);
    });
    const labels: Record<string, string> = {
      DRAFT: 'Borrador', SUBMITTED: 'Enviada', APPROVED: 'Aprobada',
      PENDING_L1: 'Aprob. N1', PENDING_L2: 'Aprob. N2', PENDING_L3: 'Aprob. N3',
      PENDING_L4: 'Aprob. N4', PENDING_L5: 'Aprob. N5',
      PARTIAL: 'Parcial', RECEIVED: 'Recibida', REJECTED: 'Rechazada', CANCELLED: 'Cancelada',
    };
    return Object.entries(map).map(([k, v]) => ({ name: labels[k] || k, value: v }));
  }, [orders]);

  // KPIs calculados
  const computedKpis = useMemo(() => {
    const totalSpend = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const avgPO = orders.length > 0 ? totalSpend / orders.length : 0;
    const received = orders.filter((o) => o.status === 'RECEIVED');
    const onTime = kpis?.onTimeDeliveryRate ?? null;
    return { totalSpend, avgPO, receivedCount: received.length, onTime };
  }, [orders, kpis]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📊</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Spend Analytics</h1>
            <p className="text-sm text-surface-500">Análisis completo de gasto, proveedores y tendencias</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-surface-100 dark:bg-surface-700 rounded-lg p-1">
            {RANGES.map((r) => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === r.value ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-soft' : 'text-surface-500 hover:text-surface-700 dark:hover:text-white'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={exportExcel} disabled={exporting}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
            {exporting ? 'Generando...' : '📥 Exportar Excel'}
          </button>
          <Link to="/purchases" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            ← Volver
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={loadAll} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">Reintentar</button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Gasto total', value: fmtMoney(computedKpis.totalSpend), sub: `${orders.length} órdenes`, color: 'text-brand-600 dark:text-brand-400' },
          { label: 'Ticket promedio', value: fmtMoney(computedKpis.avgPO), sub: 'Por OC', color: 'text-surface-800 dark:text-white' },
          { label: 'OCs recibidas', value: computedKpis.receivedCount, sub: `${orders.length > 0 ? Math.round((computedKpis.receivedCount / orders.length) * 100) : 0}% del total`, color: 'text-green-600 dark:text-green-400' },
          { label: 'On-time delivery', value: computedKpis.onTime !== null ? `${computedKpis.onTime}%` : 'N/D', sub: 'Últimos 6 meses', color: computedKpis.onTime === null ? 'text-surface-400' : computedKpis.onTime >= 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-surface-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend - Area + Line */}
        <div className="lg:col-span-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-white">📈 Tendencia de gasto ({range}M)</h3>
            <span className="text-xs text-surface-400">{trendData.length} {trendData.length === 1 ? 'mes' : 'meses'}</span>
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00B8E0" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00B8E0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: any) => [fmtMoney(v), 'Gasto']}
                />
                <Area type="monotone" dataKey="total" stroke="#00B8E0" strokeWidth={2.5} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-20">Sin datos de tendencia disponibles</p>
          )}
        </div>

        {/* Status pie */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
          <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-4">🍩 Gasto por estado</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: any) => fmtMoney(Number(v))}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-20">Sin datos</p>
          )}
        </div>
      </div>

      {/* Top suppliers chart */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-surface-800 dark:text-white">🏆 Top {supplierData.length} proveedores por gasto</h3>
          <Link to="/purchases/suppliers/ranking" className="text-xs text-brand-500 hover:underline">Ver ranking completo →</Link>
        </div>
        {supplierData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(220, supplierData.length * 36)}>
            <BarChart data={supplierData} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
                formatter={(v: any, _n: any, p: any) => [fmtMoney(Number(v)), p.payload.fullName]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {supplierData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-surface-400 text-sm text-center py-12">Sin proveedores activos en el período</p>
        )}
      </div>

      {/* Combo barchart: gasto mensual ordenado */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
        <h3 className="font-semibold text-sm text-surface-800 dark:text-white mb-4">📊 Gasto mensual comparativo</h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
                formatter={(v: any) => [fmtMoney(Number(v)), 'Total']}
              />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-surface-400 text-sm text-center py-12">Sin historial</p>
        )}
      </div>
    </div>
  );
}
