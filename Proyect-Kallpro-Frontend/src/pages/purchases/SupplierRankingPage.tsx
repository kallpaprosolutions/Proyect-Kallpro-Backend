import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
} from 'recharts';
import { procurementApi } from '../../api/procurement';
import { reportsApi } from '../../api/reports';

function scoreColor(val: number) {
  if (val >= 75) return 'text-green-600 dark:text-green-400';
  if (val >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
function scoreColorHex(val: number) {
  if (val >= 75) return '#22c55e';
  if (val >= 50) return '#eab308';
  return '#ef4444';
}

const SCORE_FILTERS = [
  { key: 'ALL', label: 'Todos' },
  { key: 'HIGH', label: '> 75' },
  { key: 'MID', label: '50–75' },
  { key: 'LOW', label: '< 50' },
];

export default function SupplierRankingPage() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [scoreFilter, setScoreFilter] = useState('ALL');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    setError('');
    procurementApi.getSupplierRanking()
      .then(r => setRanking(r.data))
      .catch(() => setError('No se pudo cargar el ranking. Verifica el backend.'))
      .finally(() => setLoading(false));
  }

  async function exportExcel() {
    setExporting(true);
    try { await reportsApi.suppliersExcel(); } catch {} finally { setExporting(false); }
  }

  const filtered = useMemo(() => {
    let list = ranking.slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => (s.name || '').toLowerCase().includes(q) || (s.ruc || '').toLowerCase().includes(q));
    }
    if (scoreFilter !== 'ALL') {
      list = list.filter((s) => {
        const v = Number(s.totalScore || 0);
        if (scoreFilter === 'HIGH') return v >= 75;
        if (scoreFilter === 'MID') return v >= 50 && v < 75;
        if (scoreFilter === 'LOW') return v < 50;
        return true;
      });
    }
    return list;
  }, [ranking, search, scoreFilter]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-surface-500">
      Calculando ranking...
    </div>
  );

  const selectedSupplier = selected ? ranking.find(s => s.id === selected) : null;

  const radarData = selectedSupplier ? [
    { metric: 'Precio',       value: Number(selectedSupplier.priceScore || 0),       fullMark: 100 },
    { metric: 'Entrega',      value: Number(selectedSupplier.deliveryScore || 0),    fullMark: 100 },
    { metric: 'Calidad',      value: Number(selectedSupplier.qualityScore || 0),     fullMark: 100 },
    { metric: 'Cumplimiento', value: Number(selectedSupplier.complianceScore || 0),  fullMark: 100 },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏅</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Ranking de Proveedores</h1>
            <p className="text-sm text-surface-500">{filtered.length} de {ranking.length} proveedores evaluados</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel} disabled={exporting}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
            {exporting ? 'Generando...' : '📥 Exportar Excel'}
          </button>
          <Link to="/purchases/suppliers" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            Ver proveedores
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">Reintentar</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar proveedor por nombre o RUC..."
          className="flex-1 min-w-[240px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
        />
        <div className="flex bg-surface-100 dark:bg-surface-700 rounded-lg p-1">
          {SCORE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setScoreFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                scoreFilter === f.key ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-soft' : 'text-surface-500 hover:text-surface-700 dark:hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking list */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-surface-400 text-sm text-center py-12">
              {ranking.length === 0 ? 'Sin proveedores activos' : 'Sin proveedores que coincidan con los filtros'}
            </p>
          ) : filtered.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              className={`w-full text-left bg-white dark:bg-surface-800 border rounded-2xl p-4 transition-colors shadow-soft
                ${selected === s.id ? 'border-brand-500 dark:border-brand-500 ring-2 ring-brand-500/20' : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'}`}
            >
              <div className="flex items-center gap-3">
                {/* Position medal */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${i === 0 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400' :
                    i === 1 ? 'bg-surface-200 dark:bg-surface-600 text-surface-600 dark:text-surface-300' :
                    i === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' :
                    'bg-surface-100 dark:bg-surface-700 text-surface-400'}`}>
                  {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-surface-900 dark:text-white font-medium truncate">{s.name}</p>
                    {s.ruc && <span className="text-xs text-surface-400">{s.ruc}</span>}
                  </div>
                  {/* Mini score bars */}
                  <div className="flex gap-2 mt-1.5">
                    {[
                      { v: s.priceScore, l: 'Precio' },
                      { v: s.deliveryScore, l: 'Entrega' },
                      { v: s.qualityScore, l: 'Calidad' },
                      { v: s.complianceScore, l: 'Cumpl.' },
                    ].map(({ v, l }) => (
                      <div key={l} className="flex items-center gap-1">
                        <span className="text-[10px] text-surface-400 w-10">{l}</span>
                        <div className="w-10 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v >= 75 ? 'bg-green-500' : v >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={`text-xl font-bold ${scoreColor(s.totalScore)}`}>{Math.round(s.totalScore)}</p>
                  <p className="text-xs text-surface-400">{s.recordsCount} OCs</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel - RadarChart */}
        <div>
          {selectedSupplier ? (
            <div className="space-y-3 sticky top-4">
              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-surface-900 dark:text-white">{selectedSupplier.name}</h3>
                  <span className={`text-2xl font-bold ${scoreColor(selectedSupplier.totalScore)}`}>
                    {Math.round(selectedSupplier.totalScore)}
                  </span>
                </div>
                <p className="text-xs text-surface-500 mb-4">
                  Score total · {selectedSupplier.recordsCount} OCs evaluadas
                </p>

                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(148,163,184,0.3)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar
                      name={selectedSupplier.name}
                      dataKey="value"
                      stroke={scoreColorHex(selectedSupplier.totalScore)}
                      fill={scoreColorHex(selectedSupplier.totalScore)}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(v: any) => [`${Math.round(Number(v))}/100`, 'Score']}
                    />
                  </RadarChart>
                </ResponsiveContainer>

                {/* Breakdown */}
                <div className="space-y-2 mt-2">
                  {[
                    { l: 'Precio',        v: selectedSupplier.priceScore },
                    { l: 'Entrega',       v: selectedSupplier.deliveryScore },
                    { l: 'Calidad',       v: selectedSupplier.qualityScore },
                    { l: 'Cumplimiento',  v: selectedSupplier.complianceScore },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex items-center justify-between text-xs">
                      <span className="text-surface-500">{l}</span>
                      <span className={`font-mono font-semibold ${scoreColor(v)}`}>{Math.round(v)}/100</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                to={`/purchases/suppliers/${selectedSupplier.id}`}
                className="block w-full py-2.5 bg-brand-50 dark:bg-brand-900/40 hover:bg-brand-100 dark:hover:bg-brand-800/50 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 text-sm text-center rounded-xl transition-colors font-medium"
              >
                Ver perfil completo →
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-8 text-center text-surface-400 text-sm">
              <p className="text-3xl mb-2">📊</p>
              <p>Selecciona un proveedor para ver su desglose de score con gráfico radar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
