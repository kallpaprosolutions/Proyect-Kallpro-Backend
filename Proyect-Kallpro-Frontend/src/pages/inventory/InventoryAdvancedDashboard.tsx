import { useEffect, useState } from 'react';
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Area,
} from 'recharts';
import { rotationApi } from '../../api/rotation';
import { inventoryApi } from '../../api/inventory';
import { ollamaApi } from '../../api/ollama';
import { Link } from 'react-router-dom';

interface RotationData {
  productId: string; name: string; sku?: string; category?: string;
  totalStock: number; totalValue: number; avgCost: number; unit: string;
  valuationMethod: string; movementsLast90: number; consumedLast90: number;
  avgDailyConsumption: number; dio: number; rotationRate: number;
  abcClass: 'A' | 'B' | 'C' | 'D'; cumulativeValuePct: number;
  minStock: number; isLowStock: boolean; isZeroStock: boolean;
  lastMovementAt?: string;
}
interface ObsolescenceReport {
  totalInventoryValue: number; obsoleteValue: number; obsoletePct: number;
  lowRotationValue: number; avgDIO: number; avgRotationRate: number;
  byClass: Record<string, { count: number; value: number; pct: number }>;
  expiringIn30: number; expiringIn90: number; expiredBatches: number;
}
interface Trend { date: string; entries: number; exits: number; entryValue: number; exitValue: number; netValue: number; }
interface Batch {
  id: string; product: { name: string; sku?: string }; warehouse: { name: string };
  lotNumber?: string; supplierBatch?: string; receivedAt: string; expiryDate?: string;
  remainingQty: string; unitCost: string; isExhausted: boolean;
}

const ABC_COLORS: Record<string, string> = { A: '#34d399', B: '#facc15', C: '#fb923c', D: '#f87171' };
const ABC_BG: Record<string, string> = {
  A: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
  B: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
  C: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  D: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
};
const ABC_DESC: Record<string, string> = {
  A: 'Alta rotación / Alto valor',
  B: 'Rotación media',
  C: 'Baja rotación',
  D: 'Sin movimiento',
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs shadow-xl max-w-xs">
      {label && <p className="text-surface-500 mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-bold">
            {typeof p.value === 'number'
              ? p.value > 1000 ? `$${p.value.toLocaleString('es', { minimumFractionDigits: 2 })}`
              : p.value > 100 ? p.value.toFixed(1)
              : p.value.toFixed(2)
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

function getBatchStatus(batch: Batch): { label: string; color: string; days?: number } {
  if (!batch.expiryDate) return { label: 'Sin Vencimiento', color: 'bg-surface-100 dark:bg-surface-700 text-surface-500' };
  const now = new Date();
  const exp = new Date(batch.expiryDate);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'VENCIDO', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700', days };
  if (days <= 30) return { label: `${days}d — CRÍTICO`, color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30', days };
  if (days <= 90) return { label: `${days}d — Próximo`, color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30', days };
  return { label: `${days}d — Vigente`, color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30', days };
}

const GRID_STROKE = '#e5e7eb';
const AXIS_TICK = { fill: '#6b7280', fontSize: 11 };

export default function InventoryAdvancedDashboard() {
  const [tab, setTab] = useState<'rotation' | 'lots' | 'trend' | 'financial'>('rotation');
  const [rotation, setRotation] = useState<RotationData[]>([]);
  const [obsolescence, setObsolescence] = useState<ObsolescenceReport | null>(null);
  const [trend, setTrend] = useState<Trend[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trendMonths, setTrendMonths] = useState(6);
  const [abcFilter, setAbcFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [sortRot, setSortRot] = useState<'value' | 'dio' | 'rotation'>('value');

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [forecastProductId, setForecastProductId] = useState('');
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastData, setForecastData] = useState<any | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [healthScore, setHealthScore] = useState<any | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      rotationApi.getAnalysis(),
      rotationApi.getObsolescence(),
      rotationApi.getExpiring(365),
    ]).then(([r, o, b]) => {
      setRotation(r.data);
      setObsolescence(o.data);
      setBatches(b.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    rotationApi.getTrend(trendMonths).then((r) => setTrend(r.data));
  }, [trendMonths]);

  useEffect(() => {
    inventoryApi.getProducts().then(r => setAllProducts(r.data));
  }, []);

  const loadForecast = async (productId: string) => {
    if (!productId) return;
    setLoadingForecast(true);
    setForecastData(null);
    try {
      const res = await ollamaApi.getSmartForecast(productId);
      setForecastData(res.data);
    } catch { setForecastData(null); }
    setLoadingForecast(false);
  };

  const loadHealthScore = async () => {
    setLoadingHealth(true);
    try {
      const res = await ollamaApi.getInventoryHealthScore();
      setHealthScore(res.data);
    } catch { setHealthScore(null); }
    setLoadingHealth(false);
  };

  const filteredRotation = rotation
    .filter((d) => abcFilter === 'ALL' || d.abcClass === abcFilter)
    .sort((a, b) => {
      if (sortRot === 'value') return b.totalValue - a.totalValue;
      if (sortRot === 'dio') return (b.dio === 9999 ? 99999 : b.dio) - (a.dio === 9999 ? 99999 : a.dio);
      return a.rotationRate - b.rotationRate;
    });

  const filteredBatches = batches.filter((b) => {
    if (batchFilter === 'ALL') return true;
    const s = getBatchStatus(b);
    if (batchFilter === 'EXPIRED') return s.days !== undefined && s.days < 0;
    if (batchFilter === 'CRITICAL') return s.days !== undefined && s.days >= 0 && s.days <= 30;
    if (batchFilter === 'UPCOMING') return s.days !== undefined && s.days > 30 && s.days <= 90;
    return true;
  });

  const abcBarData = ['A', 'B', 'C', 'D'].map((k) => ({
    class: k,
    productos: obsolescence?.byClass[k]?.count || 0,
    valor: parseFloat((obsolescence?.byClass[k]?.value || 0).toFixed(2)),
    color: ABC_COLORS[k],
  }));

  const donutData = ['A', 'B', 'C', 'D']
    .filter((k) => (obsolescence?.byClass[k]?.value || 0) > 0)
    .map((k) => ({ name: `Clase ${k}`, value: parseFloat((obsolescence?.byClass[k]?.value || 0).toFixed(2)), color: ABC_COLORS[k] }));

  const obsoleteProducts = rotation.filter((d) => d.abcClass === 'D').sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-surface-400">Cargando análisis avanzado...</div>
  );

  const cardCls = 'bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft';
  const tabBtnCls = (active: boolean) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-brand-500 text-white' : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-white'}`;

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-1 w-fit flex-wrap">
        {[
          { key: 'rotation',  label: '📈 Rotación & ABC' },
          { key: 'lots',      label: '🏷️ Lotes & Caducidad' },
          { key: 'trend',     label: '📉 Tendencias' },
          { key: 'financial', label: '💰 Impacto Financiero' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={tabBtnCls(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: ROTACIÓN & ABC ══ */}
      {tab === 'rotation' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">Valor Total Inventario</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">${(obsolescence?.totalInventoryValue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">DIO Promedio</p>
              <p className={`text-xl font-bold mt-1 ${(obsolescence?.avgDIO || 0) > 90 ? 'text-red-600 dark:text-red-400' : (obsolescence?.avgDIO || 0) > 45 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                {(obsolescence?.avgDIO || 0).toFixed(1)} <span className="text-sm font-normal text-surface-400">días</span>
              </p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">Rotación Anual Prom.</p>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400 mt-1">{(obsolescence?.avgRotationRate || 0).toFixed(2)} <span className="text-sm font-normal text-surface-400">veces/año</span></p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">% Obsolescencia</p>
              <p className={`text-xl font-bold mt-1 ${(obsolescence?.obsoletePct || 0) > 15 ? 'text-red-600 dark:text-red-400' : (obsolescence?.obsoletePct || 0) > 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                {(obsolescence?.obsoletePct || 0).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={`${cardCls} p-5`}>
              <h3 className="font-semibold text-surface-800 dark:text-white mb-1">Clasificación ABC — Cantidad de Productos</h3>
              <p className="text-xs text-surface-400 mb-4">A=80% valor acumulado · B=15% · C=5% · D=sin movimiento</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={abcBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="class" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="productos" name="Productos" radius={[4,4,0,0]}>
                    {abcBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`${cardCls} p-5`}>
              <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Distribución de Valor por Clase</h3>
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`$${Number(v).toLocaleString('es', { minimumFractionDigits: 2 })}`, 'Valor']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {['A','B','C','D'].map((k) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ABC_COLORS[k] }} />
                      <span className="text-surface-500 flex-1">Clase {k} — {ABC_DESC[k]}</span>
                      <span className="font-bold" style={{ color: ABC_COLORS[k] }}>{(obsolescence?.byClass[k]?.pct || 0).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-surface-500">Filtrar por clase:</span>
              {['ALL','A','B','C','D'].map((k) => (
                <button key={k} onClick={() => setAbcFilter(k)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${abcFilter === k ? k === 'ALL' ? 'bg-brand-500 text-white border-brand-500' : `${ABC_BG[k]}` : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-400 dark:hover:border-surface-500'}`}>
                  {k === 'ALL' ? 'Todos' : `Clase ${k}`}
                  {k !== 'ALL' && <span className="ml-1 opacity-70">({obsolescence?.byClass[k]?.count || 0})</span>}
                </button>
              ))}
              <div className="ml-auto flex gap-2 items-center">
                <span className="text-xs text-surface-400">Ordenar:</span>
                {[{k:'value',l:'Valor'},{k:'dio',l:'DIO'},{k:'rotation',l:'Rotación'}].map((s) => (
                  <button key={s.k} onClick={() => setSortRot(s.k as any)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${sortRot === s.k ? 'bg-surface-800 dark:bg-surface-100 text-white dark:text-surface-900 border-surface-700 dark:border-surface-200' : 'border-surface-200 dark:border-surface-700 text-surface-400 hover:text-surface-700 dark:hover:text-white'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${cardCls} overflow-hidden`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs">
                    <th className="text-left px-4 py-2.5">Producto</th>
                    <th className="text-left px-4 py-2.5">Categoría</th>
                    <th className="text-right px-4 py-2.5">Stock</th>
                    <th className="text-right px-4 py-2.5">Valor</th>
                    <th className="text-center px-4 py-2.5">ABC</th>
                    <th className="text-right px-4 py-2.5">DIO</th>
                    <th className="text-right px-4 py-2.5">Rotación/año</th>
                    <th className="text-left px-4 py-2.5">Último mov.</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {filteredRotation.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-surface-400">Sin resultados</td></tr>
                  )}
                  {filteredRotation.map((d) => (
                    <tr key={d.productId} className="hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-surface-800 dark:text-white">{d.name}</p>
                        {d.sku && <p className="text-xs text-surface-400">SKU: {d.sku}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-surface-500 text-xs">{d.category || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-surface-700 dark:text-surface-300">{d.totalStock.toFixed(2)} {d.unit}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-surface-800 dark:text-white">${d.totalValue.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${ABC_BG[d.abcClass]}`}>{d.abcClass}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        <span className={d.dio > 180 ? 'text-red-600 dark:text-red-400' : d.dio > 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-600 dark:text-surface-300'}>
                          {d.dio >= 9999 ? '∞' : d.dio.toFixed(0)} d
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-surface-600 dark:text-surface-300">{d.rotationRate.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-surface-500">
                        {d.lastMovementAt ? new Date(d.lastMovementAt).toLocaleDateString('es') : <span className="text-red-600 dark:text-red-400">Sin movimiento</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link to={`/inventory/products/${d.productId}`} className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 text-xs">Ver →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: LOTES & CADUCIDAD ══ */}
      {tab === 'lots' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">Lotes Activos con Caducidad</p>
              <p className="text-2xl font-bold text-surface-800 dark:text-white mt-1">{batches.filter((b) => !b.isExhausted && b.expiryDate).length}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800/60 shadow-soft">
              <p className="text-surface-500 text-xs">Vencen en 30 días</p>
              <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{obsolescence?.expiringIn30 || 0}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800/60 shadow-soft">
              <p className="text-surface-500 text-xs">Vencen en 90 días</p>
              <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{obsolescence?.expiringIn90 || 0}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-300 dark:border-red-900 shadow-soft">
              <p className="text-surface-500 text-xs">Lotes Vencidos</p>
              <p className="text-2xl font-bold mt-1 text-red-700 dark:text-red-500">{obsolescence?.expiredBatches || 0}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { k: 'ALL', l: 'Todos' },
              { k: 'EXPIRED', l: '🔴 Vencidos' },
              { k: 'CRITICAL', l: '🟠 Críticos <30d' },
              { k: 'UPCOMING', l: '🟡 Próximos <90d' },
            ].map((opt) => (
              <button key={opt.k} onClick={() => setBatchFilter(opt.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${batchFilter === opt.k ? 'bg-brand-500 text-white border-brand-500' : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-400 dark:hover:border-surface-500'}`}>
                {opt.l}
              </button>
            ))}
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs">
                  <th className="text-left px-4 py-2.5">Producto</th>
                  <th className="text-left px-4 py-2.5">Bodega</th>
                  <th className="text-left px-4 py-2.5">Nº Lote</th>
                  <th className="text-left px-4 py-2.5">Ingreso</th>
                  <th className="text-left px-4 py-2.5">Caducidad</th>
                  <th className="text-center px-4 py-2.5">Estado</th>
                  <th className="text-right px-4 py-2.5">Qty</th>
                  <th className="text-right px-4 py-2.5">Costo</th>
                  <th className="text-right px-4 py-2.5">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filteredBatches.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-surface-400">
                    {batchFilter === 'ALL' ? 'No hay lotes con fecha de caducidad registrada.' : 'No hay lotes en esta categoría.'}
                  </td></tr>
                )}
                {filteredBatches.map((b) => {
                  const s = getBatchStatus(b);
                  const value = Number(b.remainingQty) * Number(b.unitCost);
                  return (
                    <tr key={b.id} className={`hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors ${s.days !== undefined && s.days < 0 ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-sm text-surface-800 dark:text-white">{b.product.name}</td>
                      <td className="px-4 py-2.5 text-surface-500 text-xs">{b.warehouse.name}</td>
                      <td className="px-4 py-2.5 text-surface-500 font-mono text-xs">{b.lotNumber || b.supplierBatch || '—'}</td>
                      <td className="px-4 py-2.5 text-surface-500 text-xs">{new Date(b.receivedAt).toLocaleDateString('es')}</td>
                      <td className="px-4 py-2.5 text-xs text-surface-700 dark:text-surface-300">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('es') : <span className="text-surface-300 dark:text-surface-600">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-surface-700 dark:text-surface-300">{Number(b.remainingQty).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-surface-600 dark:text-surface-400">${Number(b.unitCost).toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-xs text-surface-800 dark:text-white">${value.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB: TENDENCIAS ══ */}
      {tab === 'trend' && (
        <div className="space-y-5">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-surface-500">Período:</span>
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => setTrendMonths(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${trendMonths === m ? 'bg-brand-500 text-white border-brand-500' : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-400 dark:hover:border-surface-500'}`}>
                {m}M
              </button>
            ))}
          </div>

          <div className={`${cardCls} p-5`}>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Entradas vs Salidas — Cantidad</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6b7280' }} />
                <Bar dataKey="entries" name="Entradas" fill="#34d399" radius={[2,2,0,0]} />
                <Bar dataKey="exits" name="Salidas" fill="#f87171" radius={[2,2,0,0]} />
                <Line type="monotone" dataKey="entries" stroke="#34d399" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className={`${cardCls} p-5`}>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Valor Entradas vs Salidas ($)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6b7280' }} />
                <Area type="monotone" dataKey="entryValue" name="Valor Entradas" fill="#34d399" stroke="#34d399" fillOpacity={0.2} />
                <Area type="monotone" dataKey="exitValue" name="Valor Salidas" fill="#f87171" stroke="#f87171" fillOpacity={0.2} />
                <Line type="monotone" dataKey="netValue" name="Neto" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-surface-100 dark:border-surface-700">
              <h3 className="font-semibold text-sm text-surface-800 dark:text-white">Resumen Mensual</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs">
                  <th className="text-left px-4 py-2.5">Mes</th>
                  <th className="text-right px-4 py-2.5">Entradas (qty)</th>
                  <th className="text-right px-4 py-2.5">Salidas (qty)</th>
                  <th className="text-right px-4 py-2.5">Valor Entradas</th>
                  <th className="text-right px-4 py-2.5">Valor Salidas</th>
                  <th className="text-right px-4 py-2.5">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {trend.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-surface-400">Sin datos de movimientos</td></tr>}
                {trend.map((t) => (
                  <tr key={t.date} className="hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-surface-700 dark:text-surface-300">{t.date}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-600 dark:text-green-400">{t.entries.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">{t.exits.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-700 dark:text-surface-300">${t.entryValue.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-700 dark:text-surface-300">${t.exitValue.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${t.netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {t.netValue >= 0 ? '+' : ''}${t.netValue.toLocaleString('es', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Demand Forecasting */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-surface-800 dark:text-white">🤖 Predicción de Demanda con IA</h3>
                <p className="text-surface-400 text-xs mt-0.5">Ollama qwen2.5 analiza el historial y proyecta los próximos 2 meses</p>
              </div>
              {!forecastData && !loadingForecast && (
                <span className="text-xs text-surface-400 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-1">Selecciona un producto</span>
              )}
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                value={forecastSearch}
                onChange={e => { setForecastSearch(e.target.value); setForecastProductId(''); setForecastData(null); }}
                placeholder="Buscar producto para predecir demanda..."
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {forecastSearch && !forecastProductId && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg max-h-40 overflow-y-auto z-10 shadow-card">
                  {allProducts
                    .filter(p => p.name.toLowerCase().includes(forecastSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(forecastSearch.toLowerCase()))
                    .slice(0, 8)
                    .map((p: any) => (
                      <button key={p.id} type="button"
                        onClick={() => { setForecastProductId(p.id); setForecastSearch(p.name); loadForecast(p.id); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-surface-400 text-xs">{p.sku || p.unit}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {loadingForecast && (
              <div className="flex items-center justify-center py-10 gap-3 text-surface-400 text-sm">
                <span className="animate-spin">⚙️</span> Consultando Ollama qwen2.5...
              </div>
            )}

            {forecastData && !loadingForecast && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center border border-surface-100 dark:border-surface-700">
                    <p className="text-surface-500 text-xs">Stock actual</p>
                    <p className="text-surface-800 dark:text-white font-bold text-lg">{forecastData.currentStock}</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center border ${forecastData.daysOfStock < 21 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-surface-50 dark:bg-surface-900 border-surface-100 dark:border-surface-700'}`}>
                    <p className="text-surface-500 text-xs">Días de stock</p>
                    <p className={`font-bold text-lg ${forecastData.daysOfStock < 21 ? 'text-red-600 dark:text-red-400' : 'text-surface-800 dark:text-white'}`}>
                      {forecastData.daysOfStock > 9000 ? '∞' : forecastData.daysOfStock}
                    </p>
                  </div>
                  <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center border border-surface-100 dark:border-surface-700">
                    <p className="text-surface-500 text-xs">Consumo diario</p>
                    <p className="text-brand-600 dark:text-brand-400 font-bold text-lg">{forecastData.avgDailyConsumption}</p>
                  </div>
                </div>

                {forecastData.monthlyHistory?.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={forecastData.monthlyHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                      <Bar dataKey="quantity" fill="#8b5cf6" name="Salidas" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                <div className="bg-indigo-50 dark:bg-purple-900/20 border border-indigo-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-indigo-600 dark:text-purple-400 text-sm font-semibold">🤖 Análisis de Ollama</span>
                  </div>
                  <p className="text-surface-700 dark:text-surface-300 text-xs leading-relaxed whitespace-pre-wrap">{forecastData.prediction}</p>
                </div>

                {forecastData.needsAttention && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
                    <span className="text-red-500 text-sm">⚠️</span>
                    <span className="text-red-700 dark:text-red-300 text-xs">Stock crítico — menos de 21 días de inventario disponible</span>
                    <Link to="/purchases" className="ml-auto text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300">Crear OC →</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: IMPACTO FINANCIERO ══ */}
      {tab === 'financial' && (
        <div className="space-y-5">
          {/* Health Score */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-surface-800 dark:text-white">🏥 Health Score del Inventario</h3>
                <p className="text-surface-400 text-xs mt-0.5">Análisis integral con recomendaciones de Ollama IA</p>
              </div>
              <button
                onClick={loadHealthScore}
                disabled={loadingHealth}
                className="text-sm px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingHealth ? '⏳ Analizando...' : '🤖 Analizar con IA'}
              </button>
            </div>
            {healthScore && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-900 rounded-xl p-6 border border-surface-100 dark:border-surface-700">
                  <div className={`text-5xl font-black mb-1 ${
                    healthScore.score >= 70 ? 'text-green-600 dark:text-green-400' :
                    healthScore.score >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                  }`}>{healthScore.score}</div>
                  <p className="text-surface-400 text-xs">/ 100</p>
                  <p className="text-surface-700 dark:text-surface-300 text-sm mt-2 font-medium">
                    {healthScore.score >= 70 ? '✅ Saludable' : healthScore.score >= 40 ? '⚠️ Mejorable' : '🚨 Crítico'}
                  </p>
                </div>
                <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 space-y-2 border border-surface-100 dark:border-surface-700">
                  <p className="text-surface-400 text-xs font-medium mb-3">DESGLOSE</p>
                  {[
                    { label: 'Saludables', val: healthScore.breakdown?.healthy, color: 'text-green-600 dark:text-green-400' },
                    { label: 'Stock bajo', val: healthScore.breakdown?.lowStock, color: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Sin stock', val: healthScore.breakdown?.zeroStock, color: 'text-red-600 dark:text-red-400' },
                    { label: 'Stock muerto', val: healthScore.breakdown?.deadStock, color: 'text-orange-600 dark:text-orange-400' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-surface-500">{item.label}</span>
                      <span className={item.color + ' font-medium'}>{item.val || 0}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1 border-t border-surface-200 dark:border-surface-700">
                    <span className="text-surface-500">Vencen &lt;30d</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">{healthScore.expiringBatches || 0} lotes</span>
                  </div>
                </div>
                <div className="bg-indigo-50 dark:bg-purple-900/20 border border-indigo-200 dark:border-purple-800 rounded-xl p-4">
                  <p className="text-indigo-600 dark:text-purple-300 text-xs font-medium mb-2">🤖 Acciones prioritarias:</p>
                  <p className="text-surface-700 dark:text-surface-300 text-xs leading-relaxed whitespace-pre-wrap">{healthScore.actions}</p>
                </div>
              </div>
            )}
            {!healthScore && !loadingHealth && (
              <p className="text-surface-400 text-sm text-center py-4">Haz clic en "Analizar con IA" para obtener el health score</p>
            )}
          </div>

          {/* Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">Inventario Total</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">${(obsolescence?.totalInventoryValue || 0).toLocaleString('es', { minimumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800/60 shadow-soft">
              <p className="text-surface-500 text-xs">Inventario Obsoleto (D)</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">${(obsolescence?.obsoleteValue || 0).toLocaleString('es', { minimumFractionDigits: 0 })}</p>
              <p className="text-xs text-surface-400">{(obsolescence?.obsoletePct || 0).toFixed(1)}% del total</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-200 dark:border-orange-800/40 shadow-soft">
              <p className="text-surface-500 text-xs">Baja Rotación (C)</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">${(obsolescence?.lowRotationValue || 0).toLocaleString('es', { minimumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800/40 shadow-soft">
              <p className="text-surface-500 text-xs">Capital Inmovilizado</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300 mt-1">
                ${((obsolescence?.obsoleteValue || 0) + (obsolescence?.lowRotationValue || 0)).toLocaleString('es', { minimumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-surface-400">Clases C + D</p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-surface-500 text-xs">Costo Diario Inventario</p>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                ${obsolescence && obsolescence.avgDIO > 0
                  ? (obsolescence.totalInventoryValue / obsolescence.avgDIO).toLocaleString('es', { minimumFractionDigits: 0 })
                  : '0'}
              </p>
              <p className="text-xs text-surface-400">por día inmovilizado</p>
            </div>
          </div>

          <div className={`${cardCls} p-5`}>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Valor por Clase ABC — Análisis de Riesgo</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={abcBarData.filter((d) => d.valor > 0)} margin={{ top: 5, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="class" tick={AXIS_TICK} tickFormatter={(v) => `Clase ${v}`} />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`$${Number(v).toLocaleString('es', { minimumFractionDigits: 2 })}`, 'Valor']} />
                <Bar dataKey="valor" name="Valor" radius={[4,4,0,0]}>
                  {abcBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-red-200 dark:border-red-800/40 overflow-hidden shadow-soft">
            <div className="px-5 py-3 border-b border-red-100 dark:border-red-800/40 flex justify-between items-center">
              <h3 className="font-semibold text-red-600 dark:text-red-400">🚨 ¿Dónde estoy perdiendo dinero? — Clase D (Sin Rotación)</h3>
              <span className="text-xs text-surface-400">{obsolescence?.byClass['D']?.count || 0} productos · ${(obsolescence?.obsoleteValue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
            </div>
            {obsoleteProducts.length === 0 ? (
              <div className="text-center py-8 text-green-600 dark:text-green-400 text-sm">✅ No hay productos sin rotación. ¡Excelente!</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs">
                    <th className="text-left px-4 py-2.5">Producto</th>
                    <th className="text-right px-4 py-2.5">Stock</th>
                    <th className="text-right px-4 py-2.5">Valor Inmovilizado</th>
                    <th className="text-left px-4 py-2.5">Último Movimiento</th>
                    <th className="text-right px-4 py-2.5">Días Sin Mov.</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {obsoleteProducts.map((d) => {
                    const daysSince = d.lastMovementAt
                      ? Math.ceil((new Date().getTime() - new Date(d.lastMovementAt).getTime()) / (1000 * 60 * 60 * 24))
                      : 9999;
                    return (
                      <tr key={d.productId} className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-surface-800 dark:text-white">{d.name}</p>
                          <p className="text-xs text-surface-400">{d.sku ? `SKU: ${d.sku}` : ''}{d.sku && d.category ? ' · ' : ''}{d.category || ''}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-surface-700 dark:text-surface-300">{d.totalStock.toFixed(2)} {d.unit}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600 dark:text-red-400">${d.totalValue.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-xs text-surface-500">
                          {d.lastMovementAt ? new Date(d.lastMovementAt).toLocaleDateString('es') : <span className="text-red-600 dark:text-red-500">Nunca</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-red-600 dark:text-red-400 font-bold text-xs">{daysSince >= 9999 ? '∞' : daysSince} días</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link to={`/inventory/products/${d.productId}`} className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 text-xs">Ver →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${cardCls} p-5 space-y-3`}>
            <h3 className="font-semibold text-brand-600 dark:text-brand-400 mb-3">🤖 Recomendaciones del Sistema</h3>
            {(obsolescence?.obsoletePct || 0) > 15 && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                <strong>⚠ Alto porcentaje de inventario obsoleto ({(obsolescence?.obsoletePct || 0).toFixed(1)}%).</strong> Considera realizar una campaña de liquidación o dar de baja los productos clase D con mayor valor inmovilizado.
              </div>
            )}
            {(obsolescence?.avgDIO || 0) > 90 && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
                <strong>📦 Los días de inventario promedio son elevados ({(obsolescence?.avgDIO || 0).toFixed(0)} días).</strong> Reducir el DIO por debajo de 60 días liberaría capital de trabajo significativo.
              </div>
            )}
            {(obsolescence?.expiredBatches || 0) > 0 && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-200">
                <strong>🚨 Existen {obsolescence?.expiredBatches} lote(s) vencido(s)</strong> que deben ser dados de baja inmediatamente. Genera un ajuste de inventario y registra la pérdida contable.
              </div>
            )}
            {(obsolescence?.expiringIn30 || 0) > 0 && (
              <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg p-3 text-sm text-orange-700 dark:text-orange-300">
                <strong>🔔 {obsolescence?.expiringIn30} lote(s) vencen en los próximos 30 días.</strong> Prioriza su consumo o venta antes del vencimiento.
              </div>
            )}
            {(obsolescence?.obsoletePct || 0) <= 5 && (obsolescence?.avgDIO || 0) <= 60 && (obsolescence?.expiredBatches || 0) === 0 && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                <strong>✅ Tu inventario está en buen estado.</strong> Rotación saludable, bajo porcentaje de obsolescencia y sin lotes vencidos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
