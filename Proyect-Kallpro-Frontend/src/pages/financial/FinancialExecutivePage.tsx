import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { financialApi } from '../../api/financial';
import { KPITile } from '../../components/finance/KPITile';
import { RatioCard } from '../../components/finance/RatioCard';
import { DCFSlider } from '../../components/finance/DCFSlider';
import { AIInsightCard } from '../../components/finance/AIInsightCard';
import { SavingsCard } from '../../components/finance/SavingsCard';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
  { id: '4d', label: '🔲 4D', icon: '🔲' },
  { id: 'ratios', label: '📈 Ratios', icon: '📈' },
  { id: 'dcf', label: '💹 DCF', icon: '💹' },
  { id: 'scenarios', label: '🔮 Escenarios', icon: '🔮' },
  { id: 'sri', label: '🏛️ SRI', icon: '🏛️' },
];


const DIMENSION_LABELS: Record<string, string> = {
  tiempo: '⏱ Tiempo',
  dinero: '💸 Dinero',
  calidad: '✅ Calidad',
  logistica: '🚚 Logística',
};

function getPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Tab: Dashboard Ejecutivo ─────────────────────────────────────────────────
function DashboardTab() {
  const { data: exec, isLoading } = useQuery({
    queryKey: ['financial-executive'],
    queryFn: () => financialApi.getExecutiveSummary().then(r => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-surface-400">Cargando resumen ejecutivo...</div>;
  if (!exec) return null;

  const { savings, optimization4d, aiInsights, ratiosSummary } = exec;

  return (
    <div className="space-y-6">
      {/* Savings Card */}
      <SavingsCard
        total={savings?.total ?? 0}
        breakdown={savings?.breakdown ?? { hard: 0, costAvoidance: 0, consolidation: 0, downtimeAvoided: 0 }}
        period={savings?.period ?? getPeriod()}
      />

      {/* 4D Score overview */}
      {optimization4d?.summary && (
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Optimización 4D — Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['tiempo', 'dinero', 'calidad', 'logistica'] as const).map(dim => {
              const score = optimization4d.summary[`${dim}Score`] as number;
              return (
                <div key={dim} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {score}
                  </div>
                  <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{DIMENSION_LABELS[dim]}</div>
                  <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center">
            <span className="text-sm text-surface-500">Score Global: </span>
            <span className="text-xl font-bold text-brand-600 dark:text-brand-400">{optimization4d.summary.overallScore}</span>
          </div>
        </div>
      )}

      {/* Ratio summary */}
      {ratiosSummary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{ratiosSummary.healthy}</div>
            <div className="text-sm text-emerald-700 mt-1">✅ Saludables</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{ratiosSummary.warning}</div>
            <div className="text-sm text-amber-700 mt-1">⚠️ Atención</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{ratiosSummary.critical}</div>
            <div className="text-sm text-red-700 mt-1">🔴 Críticos</div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {aiInsights?.insights?.length > 0 && (
        <div>
          <h3 className="font-semibold text-surface-800 dark:text-white mb-3">🤖 Insights de IA</h3>
          <div className="space-y-3">
            {aiInsights.insights.map((insight: any, i: number) => (
              <AIInsightCard key={i} insight={insight} index={i} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Generado por: {aiInsights.model} · {new Date(aiInsights.generatedAt).toLocaleString('es-EC')}
            {aiInsights.cached && ' · 🔄 Desde caché'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: 4D Optimization ────────────────────────────────────────────────────
function Optimization4DTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['4d-kpis'],
    queryFn: () => financialApi.get4DOptimization().then(r => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-surface-400">Calculando KPIs 4D...</div>;
  if (!data) return null;

  const dimensions = [
    { key: 'tiempo', label: DIMENSION_LABELS.tiempo, data: data.tiempo },
    { key: 'dinero', label: DIMENSION_LABELS.dinero, data: data.dinero },
    { key: 'calidad', label: DIMENSION_LABELS.calidad, data: data.calidad },
    { key: 'logistica', label: DIMENSION_LABELS.logistica, data: data.logistica },
  ];

  return (
    <div className="space-y-6">
      {dimensions.map(({ key, label, data: kpis }) => (
        <div key={key} className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">{label}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpis?.map((kpi: any) => (
              <KPITile
                key={kpi.code}
                label={kpi.name}
                value={kpi.value}
                unit={kpi.unit}
                status={kpi.status}
                formula={kpi.description}
                benchmark={kpi.benchmarkLabel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Ratios Financieros ─────────────────────────────────────────────────
function RatiosTab() {
  const [category, setCategory] = useState<string>('liquidez');
  const { data, isLoading } = useQuery({
    queryKey: ['ratios', category],
    queryFn: () => financialApi.getRatios(category).then(r => r.data),
  });

  const CATEGORIES = [
    { id: 'liquidez', label: '💧 Liquidez' },
    { id: 'solvencia', label: '🏦 Solvencia' },
    { id: 'rentabilidad', label: '💰 Rentabilidad' },
    { id: 'eficiencia', label: '⚙️ Eficiencia' },
    { id: 'valor', label: '📊 Valor' },
    { id: 'sri', label: '🏛️ Fiscal' },
  ];

  const ratios = Array.isArray(data) ? data : (data?.ratios ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              category === cat.id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600',
            ].join(' ')}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Calculando ratios...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ratios.map((r: any) => (
            <RatioCard
              key={r.code}
              code={r.code}
              name={r.name}
              value={r.value}
              unit={r.unit}
              benchmarkLabel={r.benchmarkLabel}
              status={r.status}
              variationYoY={r.variationYoY}
              formula={r.formula}
            />
          ))}
          {ratios.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-400">Sin datos disponibles para esta categoría</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: DCF Valuation ──────────────────────────────────────────────────────
function DCFTab() {
  const [assumptions, setAssumptions] = useState({
    growthRate: 10,
    ebitdaMargin: 20,
    taxRate: 25,
    wacc: 12,
    perpetualGrowth: 3,
    capexPct: 5,
    wcChangePct: 2,
    projectionYears: 5,
  });

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const calcMutation = useMutation({
    mutationFn: () => financialApi.calculateDCF(assumptions).then(r => r.data),
    onSuccess: (data) => { setResult(data); setError(null); },
    onError: (err: any) => setError(err.response?.data?.error ?? 'Error al calcular'),
  });

  const handleSliderChange = useCallback((key: string) => (value: number) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const sliders = [
    { key: 'growthRate', label: 'Crecimiento de Ingresos', min: -10, max: 50, step: 1, unit: '%', desc: 'CAGR esperado de los ingresos' },
    { key: 'ebitdaMargin', label: 'Margen EBITDA', min: 5, max: 60, step: 1, unit: '%', desc: 'EBITDA como % de ingresos' },
    { key: 'wacc', label: 'WACC (Costo de Capital)', min: 6, max: 25, step: 0.5, unit: '%', desc: 'Tasa de descuento ponderada' },
    { key: 'perpetualGrowth', label: 'Crecimiento a Perpetuidad', min: 0, max: 8, step: 0.5, unit: '%', desc: 'Tasa de crecimiento terminal (< WACC)' },
    { key: 'capexPct', label: 'CapEx / Ingresos', min: 0, max: 20, step: 0.5, unit: '%', desc: 'Inversión de capital como % de ingresos' },
    { key: 'projectionYears', label: 'Años de Proyección', min: 3, max: 10, step: 1, unit: ' años', desc: 'Período de flujos explícitos' },
  ];

  const formatM = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Parámetros DCF</h3>
          {sliders.map(s => (
            <DCFSlider
              key={s.key}
              label={s.label}
              value={(assumptions as any)[s.key]}
              min={s.min}
              max={s.max}
              step={s.step}
              unit={s.unit}
              description={s.desc}
              onChange={handleSliderChange(s.key)}
            />
          ))}
          <button
            onClick={() => calcMutation.mutate()}
            disabled={calcMutation.isPending}
            className="w-full bg-brand-500 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {calcMutation.isPending ? '⏳ Calculando...' : '🔢 Calcular DCF'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-6">
                <p className="text-blue-200 text-sm mb-1">Enterprise Value</p>
                <p className="text-4xl font-black">{formatM(result.enterpriseValue)}</p>
                <p className="text-blue-300 text-sm mt-2">Equity Value: <span className="font-bold text-white">{formatM(result.equityValue)}</span></p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/15 rounded-lg p-3">
                    <p className="text-xs text-blue-200">VPN Flujos</p>
                    <p className="font-bold">{formatM(result.pvExplicitFlows)}</p>
                  </div>
                  <div className="bg-white/15 rounded-lg p-3">
                    <p className="text-xs text-blue-200">VPN Terminal</p>
                    <p className="font-bold">{formatM(result.pvTerminal)}</p>
                  </div>
                </div>
              </div>

              {/* Sensitivity Matrix */}
              {result.sensitivity && (
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                  <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Matriz de Sensibilidad (Equity Value)</h4>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="text-left p-1 text-gray-400">WACC \ Crec.</th>
                          {result.sensitivity[0]?.map((_: any, j: number) => (
                            <th key={j} className="p-1 text-center text-blue-600">
                              {(assumptions.perpetualGrowth - 2 + j).toFixed(1)}%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.sensitivity.map((row: number[], i: number) => (
                          <tr key={i}>
                            <td className="p-1 font-medium text-gray-600">{(assumptions.wacc - 2 + i).toFixed(1)}%</td>
                            {row.map((val, j) => (
                              <td
                                key={j}
                                className={`p-1 text-center font-medium rounded ${
                                  i === 2 && j === 2 ? 'bg-blue-100 text-blue-800' :
                                  val < 0 ? 'text-red-600' : 'text-gray-700'
                                }`}
                              >
                                {formatM(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Yearly projections chart */}
              {result.yearlyProjections?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Proyecciones Anuales</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={result.yearlyProjections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatM(v)} tick={{ fontSize: 10 }} width={55} />
                      <Tooltip formatter={(v: any) => formatM(v ?? 0)} />
                      <Bar dataKey="fcff" fill="#3b82f6" radius={[4, 4, 0, 0]} name="FCF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-700 p-10 text-center text-surface-400">
              <p className="text-4xl mb-2">💹</p>
              <p className="text-sm">Ajusta los parámetros y presiona <strong>Calcular DCF</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Scenarios ──────────────────────────────────────────────────────────
function ScenariosTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['scenarios-predefined'],
    queryFn: () => financialApi.getPredefinedScenarios().then(r => r.data),
  });

  const SCENARIO_COLORS: Record<string, string> = {
    pesimista: '#ef4444',
    base: '#3b82f6',
    optimista: '#10b981',
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Calculando escenarios...</div>;
  if (!data) return null;

  // Service returns: { name, type, revenue, ebitda, ebitdaMargin (as %), netIncome, ... }
  const chartData = (Array.isArray(data) ? data : []).map((s: any) => ({
    name: s.name,
    revenue: s.revenue ?? 0,
    ebitda: s.ebitda ?? 0,
    netIncome: s.netIncome ?? 0,
    color: SCENARIO_COLORS[s.type ?? 'base'] ?? '#6b7280',
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Array.isArray(data) ? data : []).map((scenario: any) => {
          const type = scenario.type ?? 'base';
          const color = SCENARIO_COLORS[type] ?? '#6b7280';
          return (
            <div
              key={scenario.name}
              className="rounded-xl border-2 p-5 space-y-3"
              style={{ borderColor: color, backgroundColor: `${color}10` }}
            >
              <div>
                <h3 className="font-bold text-surface-900 dark:text-white">{scenario.name}</h3>
                <p className="text-sm text-surface-500 capitalize">{type}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-surface-600 dark:text-surface-300">Ingresos</span>
                  <span className="font-bold" style={{ color }}>
                    ${Math.round(scenario.revenue ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-600 dark:text-surface-300">EBITDA</span>
                  <span className="font-medium">${Math.round(scenario.ebitda ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-600 dark:text-surface-300">Utilidad Neta</span>
                  <span className="font-medium">${Math.round(scenario.netIncome ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-600 dark:text-surface-300">Margen EBITDA</span>
                  <span className="font-medium">{(scenario.ebitdaMargin ?? 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Comparación de Escenarios</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `$${Number(v ?? 0).toLocaleString()}`} />
              <Bar dataKey="revenue" name="Ingresos">
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Tab: SRI Cumplimiento ───────────────────────────────────────────────────
function SRITab() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriod());

  const { data: forms } = useQuery({
    queryKey: ['sri-forms'],
    queryFn: () => financialApi.getSRIForms().then(r => r.data),
  });

  const { data: warnings } = useQuery({
    queryKey: ['sri-warnings'],
    queryFn: () => financialApi.getSRICalendarWarnings().then(r => r.data),
  });

  const { data: form104 } = useQuery({
    queryKey: ['form-104', selectedPeriod],
    queryFn: () => financialApi.getForm104(selectedPeriod).then(r => r.data),
    enabled: !!selectedPeriod,
  });

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    ready: 'bg-blue-100 text-blue-700',
    submitted: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
  };

  const SEVERITY_COLORS: Record<string, string> = {
    ok: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-red-200 bg-red-50 animate-pulse',
  };

  return (
    <div className="space-y-6">
      {/* Calendar Warnings */}
      {warnings?.length > 0 && (
        <div>
          <h3 className="font-semibold text-surface-800 dark:text-white mb-3">⏰ Alertas de Vencimiento</h3>
          <div className="space-y-2">
            {warnings.map((w: any) => (
              <div key={w.formCode} className={`rounded-xl border-2 p-4 ${SEVERITY_COLORS[w.severity]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-surface-800 dark:text-white">{w.name}</span>
                    <p className="text-sm text-surface-600 dark:text-surface-300 mt-0.5">{w.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-surface-800 dark:text-white">{w.daysUntilDue}d</div>
                    <div className="text-xs text-surface-500">para vencer</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form 104 Summary */}
      {form104 && (
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">📋 Form 104 — IVA {selectedPeriod}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPITile label="IVA Repercutido" value={form104.ivaRepercutido} unit="USD" status="neutral" />
            <KPITile label="IVA Soportado" value={form104.ivaSoportado} unit="USD" status="neutral" />
            <KPITile
              label="IVA Neto a Pagar"
              value={form104.ivaNeto}
              unit="USD"
              status={form104.ivaNeto > 0 ? 'yellow' : 'green'}
            />
            <KPITile
              label="Crédito Tributario"
              value={form104.creditoTributario}
              unit="USD"
              status={form104.creditoTributario > 0 ? 'green' : 'neutral'}
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Tasa IVA: {form104.tasaVigente}% · {form104.totalFacturasEmitidas} facturas emitidas ·
            {form104.totalDocumentosCompras} doc. de compras
          </p>
        </div>
      )}

      {/* Forms list */}
      <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <h3 className="font-semibold text-surface-800 dark:text-white">📁 Formularios SRI</h3>
        </div>
        <div className="divide-y divide-surface-100 dark:divide-surface-700">
          {forms?.slice(0, 10).map((form: any) => (
            <div
              key={`${form.formCode}-${form.period}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-white dark:hover:bg-surface-700 cursor-pointer transition-colors"
              onClick={() => form.formCode === '104' && setSelectedPeriod(form.period)}
            >
              <div>
                <span className="font-medium text-surface-800 dark:text-white text-sm">{form.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400">{form.dueDate}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[form.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {form.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function FinancialExecutivePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const TAB_CONTENT: Record<string, React.ReactNode> = {
    dashboard: <DashboardTab />,
    '4d': <Optimization4DTab />,
    ratios: <RatiosTab />,
    dcf: <DCFTab />,
    scenarios: <ScenariosTab />,
    sri: <SRITab />,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-xl">💰</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Finanzas Integral</h1>
          <p className="text-sm text-surface-500">NIIF · SRI Ecuador · LOGIFI™ Analytics</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft mb-6 overflow-hidden">
        <div className="flex gap-0 overflow-x-auto border-b border-surface-200 dark:border-surface-700">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:border-surface-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {TAB_CONTENT[activeTab]}
        </div>
      </div>
    </div>
  );
}
