import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Analytics {
  period: { days: number; start: string; end: string };
  overview: {
    totalProducts: number; totalInventoryValue: number; totalUnits: number;
    outOfStockCount: number; lowStockCount: number; outOfStockRate: number;
  };
  rotation: {
    rotationIndex: number; doh: number; cogsPeriod: number;
    totalInUnits: number; totalOutUnits: number;
  };
  velocity: { avgDailyIn: number; avgDailyOut: number; inUnits30d: number; outUnits30d: number };
  holding: { holdingCostMonthly: number; holdingCostAnnual: number; holdingRate: number };
  abc: {
    items: AbcItem[];
    summary: { aCount: number; bCount: number; cCount: number;
      aValuePct: number; bValuePct: number; cValuePct: number };
  };
  deadStock: DeadItem[];
  slowMoving: SlowItem[];
  weeklyTrend: TrendWeek[];
  topByValue: TopProduct[];
  categoryBreakdown: CatItem[];
  expiryRisk: ExpiryItem[];
}

interface AbcItem {
  productId: string; name: string; sku: string;
  consumptionValue: number; stockValue: number; totalQty: number;
  categoryName: string; abcCategory: 'A' | 'B' | 'C'; cumulativePct: number;
  movementCount: number;
}

interface DeadItem {
  productId: string; name: string; sku: string;
  totalQty: number; stockValue: number; daysSinceLastMovement: number | null; categoryName: string;
}

interface SlowItem {
  productId: string; name: string; sku: string;
  totalQty: number; stockValue: number; movementCount: number; categoryName: string;
}

interface TrendWeek { label: string; in: number; out: number }
interface TopProduct { productId: string; name: string; sku: string; stockValue: number; totalQty: number; percentage: number }
interface CatItem    { name: string; value: number; count: number }
interface ExpiryItem { productName: string; sku: string; warehouseName: string; lotNumber: string; expiryDate: string; remainingQty: number; daysUntilExpiry: number }

// Pronóstico de demanda + tendencia de rotación
type DemandTrend = 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';
type RotationLevel = 'ALTA' | 'MEDIA' | 'BAJA';
interface DemandProduct {
  productId: string; name: string; sku: string;
  history: number[]; totalUnits: number; forecastNextPeriod: number; trend: DemandTrend;
}
interface RotationProduct extends DemandProduct {
  stockValue: number; annualizedTurnover: number; rotationLevel: RotationLevel;
}
interface ForecastResponse { periods: string[]; products: DemandProduct[] }
interface RotationResponse { periods: string[]; products: RotationProduct[] }

// C2 — Panel de operaciones de inventario
interface OperationsWarehouse {
  warehouseId: string; warehouseName: string;
  recepcionesPendientes: number;
  expediciones: { enEspera: number; porEntregar: number; conDemora: number; parciales: number };
  traslados: { entrantesHoy: number; salientesHoy: number };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 2) =>
  n.toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtK = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(1)}K` :
  `$${fmt(n)}`;

// ─── Canvas: Grouped Bar Chart (weekly trend) — light theme ──────────────────

function TrendChart({ data }: { data: TrendWeek[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const pad    = { top: 20, right: 16, bottom: 40, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top  - pad.bottom;

    const maxVal = Math.max(...data.flatMap(d => [d.in, d.out]), 1);
    const gridLines = 4;

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + chartH - (i / gridLines) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle  = 'rgba(107,114,128,0.85)';
      ctx.font       = '10px system-ui';
      ctx.textAlign  = 'right';
      ctx.fillText(fmt((i / gridLines) * maxVal, 0), pad.left - 6, y + 3.5);
    }

    // Bars
    const groupW  = chartW / data.length;
    const barW    = Math.max(4, groupW * 0.28);
    const gapW    = barW * 0.3;

    data.forEach((d, i) => {
      const x = pad.left + i * groupW + groupW / 2;

      // IN bar (green)
      const inH = (d.in / maxVal) * chartH;
      ctx.fillStyle = 'rgba(22,163,74,0.85)';
      const rx = x - barW - gapW / 2;
      ctx.beginPath();
      ctx.roundRect(rx, pad.top + chartH - inH, barW, inH, [3, 3, 0, 0]);
      ctx.fill();

      // OUT bar (orange)
      const outH = (d.out / maxVal) * chartH;
      ctx.fillStyle = 'rgba(249,115,22,0.75)';
      ctx.beginPath();
      ctx.roundRect(x + gapW / 2, pad.top + chartH - outH, barW, outH, [3, 3, 0, 0]);
      ctx.fill();

      // X label (every 2nd)
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(107,114,128,0.8)';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x, pad.top + chartH + 14);
      }
    });

    // Legend
    const ly = pad.top + chartH + 30;
    ctx.fillStyle = 'rgba(22,163,74,0.85)';
    ctx.fillRect(pad.left, ly - 8, 10, 8);
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Entradas', pad.left + 14, ly);

    ctx.fillStyle = 'rgba(249,115,22,0.75)';
    ctx.fillRect(pad.left + 85, ly - 8, 10, 8);
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Salidas', pad.left + 99, ly);
  }, [data]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Donut Chart (ABC) — light theme ─────────────────────────────────

function DonutChart({ summary }: { summary: Analytics['abc']['summary'] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const S   = Math.min(canvas.offsetWidth, canvas.offsetHeight);
    canvas.width  = S * dpr;
    canvas.height = S * dpr;
    ctx.scale(dpr, dpr);

    const cx = S / 2, cy = S / 2;
    const outerR = S * 0.42;
    const innerR = S * 0.26;

    const total = summary.aCount + summary.bCount + summary.cCount || 1;
    const segments = [
      { value: summary.aCount, color: '#16a34a', label: 'A', pct: summary.aValuePct },
      { value: summary.bCount, color: '#3b82f6', label: 'B', pct: summary.bValuePct },
      { value: summary.cCount, color: '#d1d5db', label: 'C', pct: summary.cValuePct },
    ];

    let angle = -Math.PI / 2;
    for (const seg of segments) {
      const sweep = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      angle += sweep;
    }

    // Inner hole — white for light theme
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#111827';
    ctx.font      = `bold ${Math.round(S * 0.12)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - S * 0.04);
    ctx.fillStyle = '#6b7280';
    ctx.font      = `${Math.round(S * 0.075)}px system-ui`;
    ctx.fillText('SKUs', cx, cy + S * 0.08);
  }, [summary]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Horizontal Bar (top products) — light theme ─────────────────────

function HBarChart({ data }: { data: TopProduct[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const N    = Math.min(data.length, 8);
    const rowH = H / (N + 0.5);
    const labelW = Math.min(W * 0.36, 140);
    const barMaxW = W - labelW - 70;
    const maxVal = data[0]?.stockValue || 1;

    const GRADIENT_COLORS = ['#16a34a','#15803d','#166534','#14532d','#065f46','#047857','#059669','#10b981'];

    for (let i = 0; i < N; i++) {
      const d   = data[i];
      const y   = i * rowH + rowH * 0.15;
      const bH  = rowH * 0.58;
      const barW = (d.stockValue / maxVal) * barMaxW;

      // Label
      ctx.fillStyle = '#4b5563';
      ctx.font      = '10px system-ui';
      ctx.textAlign = 'right';
      const label = d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name;
      ctx.fillText(label, labelW - 8, y + bH / 2 + 3.5);

      // Bar background
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.roundRect(labelW, y, barMaxW, bH, [0, 3, 3, 0]);
      ctx.fill();

      // Bar
      ctx.fillStyle = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
      ctx.beginPath();
      ctx.roundRect(labelW, y, Math.max(barW, 3), bH, [0, 3, 3, 0]);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#374151';
      ctx.font      = '9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(fmtK(d.stockValue), labelW + barW + 6, y + bH / 2 + 3.5);
    }
  }, [data]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Gauge (semi-circle) — light theme ───────────────────────────────

function GaugeChart({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const cy = H * 0.72;
    const r  = Math.min(W * 0.42, H * 0.75);
    const startA = Math.PI;
    const endA   = 2 * Math.PI;
    const clamp  = Math.min(value / max, 1);
    const fillA  = startA + clamp * Math.PI;

    // Track (light gray)
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, endA);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth   = r * 0.22;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Fill
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, fillA);
    ctx.strokeStyle = color;
    ctx.lineWidth   = r * 0.22;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Value
    ctx.fillStyle    = '#111827';
    ctx.font         = `bold ${Math.round(r * 0.42)}px system-ui`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value >= 100 ? '∞' : fmt(value, value < 10 ? 2 : 1), cx, cy - r * 0.1);

    // Label
    ctx.fillStyle = '#6b7280';
    ctx.font      = `${Math.round(r * 0.22)}px system-ui`;
    ctx.fillText(label, cx, cy + r * 0.28);
  }, [value, max, label, color]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Sparkline (barras CSS, historial mensual de unidades vendidas) ──────────

function Sparkline({ history }: { history: number[] }) {
  const max = Math.max(...history, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height: 24, width: history.length * 7 }}>
      {history.map((v, i) => (
        <div key={i}
          title={`${v}`}
          className={`w-1.5 rounded-sm ${v > 0 ? 'bg-brand-400' : 'bg-gray-200'}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const TREND_BADGE: Record<DemandTrend, { label: string; color: string }> = {
  CRECIENTE:   { label: '📈 Creciente',  color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  ESTABLE:     { label: '➖ Estable',     color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  DECRECIENTE: { label: '📉 Decreciente', color: 'bg-red-50 text-red-700 border border-red-200' },
};

const ROTATION_BADGE: Record<RotationLevel, { label: string; color: string }> = {
  ALTA:  { label: 'Alta',  color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  MEDIA: { label: 'Media', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  BAJA:  { label: 'Baja',  color: 'bg-red-50 text-red-700 border border-red-200' },
};

// ─── C2: Panel de operaciones (tarjeta por bodega × tipo de operación) ────────

function OperationsPanel() {
  const [warehouses, setWarehouses] = useState<OperationsWarehouse[] | null>(null);

  useEffect(() => {
    inventoryApi.getOperationsPanel().then((r) => setWarehouses(r.data)).catch(() => setWarehouses([]));
  }, []);

  if (warehouses === null) {
    return <div className="h-28 bg-white border border-gray-200 rounded-2xl animate-pulse" />;
  }
  // Solo bodegas con alguna operación activa hoy — una bodega ociosa no aporta al panel.
  const active = warehouses.filter((w) =>
    w.recepcionesPendientes > 0 || w.expediciones.enEspera > 0 || w.expediciones.porEntregar > 0 ||
    w.traslados.entrantesHoy > 0 || w.traslados.salientesHoy > 0);

  if (active.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-sm text-gray-400">
        ✓ Sin operaciones pendientes hoy en ninguna bodega
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {active.map((w) => (
        <div key={w.warehouseId} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">🏭 {w.warehouseName}</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">📥 Recepciones</span>
              <span className="font-semibold text-gray-800">{w.recepcionesPendientes} por recibir</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">📤 Expediciones</span>
              <span className="font-semibold text-gray-800">{w.expediciones.porEntregar} por entregar</span>
            </div>
            <div className="pl-5 text-gray-400 flex flex-wrap gap-x-3">
              <span>En espera {w.expediciones.enEspera}</span>
              {w.expediciones.conDemora > 0 && <span className="text-red-500 font-semibold">Con demora {w.expediciones.conDemora}</span>}
              {w.expediciones.parciales > 0 && <span className="text-amber-600">Parciales {w.expediciones.parciales}</span>}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-500">⇄ Traslados hoy</span>
              <span className="font-semibold text-gray-800">
                <span className="text-emerald-600">↓{w.traslados.entrantesHoy}</span>{' '}
                <span className="text-orange-500">↑{w.traslados.salientesHoy}</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
  { label: '180d', days: 180 },
];

const ABC_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 border border-emerald-300',
  B: 'bg-blue-50 text-blue-700 border border-blue-300',
  C: 'bg-gray-100 text-gray-600 border border-gray-300',
};

export default function InventoryAnalyticsPage() {
  const navigate   = useNavigate();
  const [period, setPeriod] = useState(90);
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'abc' | 'dead' | 'slow' | 'expiry' | 'forecast'>('abc');
  const [forecastMonths, setForecastMonths] = useState(6);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [rotationTrend, setRotationTrend] = useState<RotationResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  const load = useCallback((days: number) => {
    setLoading(true);
    inventoryApi.getAnalytics(days)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  useEffect(() => {
    setForecastLoading(true);
    Promise.all([
      inventoryApi.getDemandForecast(forecastMonths, 10),
      inventoryApi.getRotationTrend(forecastMonths),
    ])
      .then(([f, r]) => { setForecast(f.data); setRotationTrend(r.data); })
      .catch(console.error)
      .finally(() => setForecastLoading(false));
  }, [forecastMonths]);

  // ── Skeleton (light) ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 h-64 bg-white border border-gray-200 rounded-2xl" />
          <div className="h-64 bg-white border border-gray-200 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-72 bg-white border border-gray-200 rounded-2xl" />
          <div className="h-72 bg-white border border-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, rotation, velocity, holding, abc, weeklyTrend, topByValue, categoryBreakdown, deadStock, slowMoving, expiryRisk } = data;

  // Rotation quality
  const rotQuality = rotation.rotationIndex >= 8 ? { label: 'Excelente', color: 'text-emerald-600' }
    : rotation.rotationIndex >= 4              ? { label: 'Buena',     color: 'text-green-600' }
    : rotation.rotationIndex >= 2              ? { label: 'Regular',   color: 'text-amber-600' }
    :                                            { label: 'Baja',      color: 'text-red-600' };

  const dohQuality = rotation.doh <= 30  ? { label: 'Ágil',     color: 'text-emerald-600' }
    : rotation.doh <= 60                 ? { label: 'Normal',   color: 'text-green-600' }
    : rotation.doh <= 90                 ? { label: 'Lento',    color: 'text-amber-600' }
    :                                      { label: 'Excesivo', color: 'text-red-600' };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory')}
              className="text-gray-500 hover:text-gray-800 text-sm transition-colors flex items-center gap-1">
              ← Inventario
            </button>
            <div className="w-px h-4 bg-gray-300" />
            <h1 className="text-lg font-bold text-gray-900">📊 Analytics de Inventario</h1>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              {overview.totalProducts} productos
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Período:</span>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => setPeriod(p.days)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  period === p.days
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-5 space-y-5 max-w-[1600px] mx-auto">

        {/* ── ROW 0: PANEL DE OPERACIONES (C2) ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-gray-800">Operaciones de hoy por bodega</h2>
          </div>
          <OperationsPanel />
        </div>

        {/* ── ROW 1: KPI CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">

          {/* Valor total */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Valor Inventario</p>
            <p className="text-2xl font-bold text-gray-900">{fmtK(overview.totalInventoryValue)}</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(overview.totalUnits, 0)} unidades totales</p>
          </div>

          {/* Rotación */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rotación Anualiz.</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(rotation.rotationIndex, 1)}×</p>
            <p className={`text-xs mt-1 font-semibold ${rotQuality.color}`}>{rotQuality.label}</p>
          </div>

          {/* DOH */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Días de Inventario</p>
            <p className="text-2xl font-bold text-gray-900">
              {rotation.doh >= 999 ? '∞' : fmt(rotation.doh, 0)}
              <span className="text-sm font-normal text-gray-400 ml-1">días</span>
            </p>
            <p className={`text-xs mt-1 font-semibold ${dohQuality.color}`}>{dohQuality.label}</p>
          </div>

          {/* Quiebre de stock */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quiebre de Stock</p>
            <p className={`text-2xl font-bold ${overview.outOfStockRate > 10 ? 'text-red-600' : overview.outOfStockRate > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {fmt(overview.outOfStockRate, 1)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">{overview.outOfStockCount} sin stock · {overview.lowStockCount} bajo mínimo</p>
          </div>

          {/* Velocidad */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Velocidad (30d)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-600">↓{fmt(velocity.avgDailyIn, 1)}</span>
              <span className="text-xl font-bold text-orange-500">↑{fmt(velocity.avgDailyOut, 1)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">uds/día entrada · salida</p>
          </div>

          {/* Costo mantenimiento */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Costo Mantenim.</p>
            <p className="text-2xl font-bold text-amber-600">{fmtK(holding.holdingCostMonthly)}</p>
            <p className="text-xs text-gray-400 mt-1">/mes · {holding.holdingRate}% anual est.</p>
          </div>
        </div>

        {/* ── ROW 2: TREND + GAUGES + ABC DONUT ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* Movement trend */}
          <div className="xl:col-span-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800">Tendencia de Movimientos</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">últimas 12 semanas</span>
            </div>
            <div style={{ height: 200 }}>
              <TrendChart data={weeklyTrend} />
            </div>
          </div>

          {/* Gauges */}
          <div className="xl:col-span-3 grid grid-rows-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
              <p className="text-xs text-gray-500 text-center mb-1">Índice de Rotación</p>
              <div style={{ height: 110 }}>
                <GaugeChart value={rotation.rotationIndex} max={12} label="× año" color="#16a34a" />
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
              <p className="text-xs text-gray-500 text-center mb-1">Días de Inventario</p>
              <div style={{ height: 110 }}>
                <GaugeChart
                  value={Math.min(rotation.doh, 180)}
                  max={180}
                  label="DOH"
                  color={rotation.doh <= 60 ? '#16a34a' : rotation.doh <= 90 ? '#d97706' : '#dc2626'}
                />
              </div>
            </div>
          </div>

          {/* ABC Donut */}
          <div className="xl:col-span-3 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Análisis ABC</h2>
            <div className="flex gap-3 items-center">
              <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                <DonutChart summary={abc.summary} />
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { cat: 'A', count: abc.summary.aCount, pct: abc.summary.aValuePct, color: 'bg-emerald-500' },
                  { cat: 'B', count: abc.summary.bCount, pct: abc.summary.bValuePct, color: 'bg-blue-500' },
                  { cat: 'C', count: abc.summary.cCount, pct: abc.summary.cValuePct, color: 'bg-gray-300' },
                ].map(s => (
                  <div key={s.cat}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-gray-700">Cat. {s.cat} — {s.count} SKUs</span>
                      <span className="text-gray-500">{s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-1">por valor de consumo</p>
              </div>
            </div>
            {/* ABC explanation */}
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              {[
                { label: 'A  80%', desc: 'Críticos',    color: 'border-emerald-200 bg-emerald-50' },
                { label: 'B  15%', desc: 'Importantes', color: 'border-blue-200 bg-blue-50' },
                { label: 'C  5%',  desc: 'Ordinarios',  color: 'border-gray-200 bg-gray-50' },
              ].map(b => (
                <div key={b.label} className={`rounded-xl border p-1.5 ${b.color}`}>
                  <p className="text-xs font-bold text-gray-800">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 3: TOP PRODUCTS + CATEGORY BREAKDOWN ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* Horizontal bar — top products */}
          <div className="xl:col-span-7 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800">Top 10 Productos por Valor</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">% del total</span>
            </div>
            <div style={{ height: 240 }}>
              <HBarChart data={topByValue} />
            </div>
          </div>

          {/* Category breakdown */}
          <div className="xl:col-span-5 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Distribución por Categoría</h2>
            <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 240 }}>
              {categoryBreakdown.map((cat, i) => {
                const pct = overview.totalInventoryValue > 0
                  ? (cat.value / overview.totalInventoryValue) * 100 : 0;
                const COLORS = ['#16a34a','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#0284c7','#ef4444'];
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-gray-700 truncate max-w-[120px]">{cat.name}</span>
                        <span className="text-xs text-gray-400">{cat.count} SKU</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-800 font-medium">{fmtK(cat.value)}</span>
                        <span className="text-xs text-gray-400 ml-1">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── ROW 4: DETAILED TABS ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {[
              { id: 'abc'    as const, label: `ABC (${abc.items.length})`,         icon: '🔢' },
              { id: 'dead'   as const, label: `Stock Muerto (${deadStock.length})`, icon: '💀' },
              { id: 'slow'   as const, label: `Lento Mov. (${slowMoving.length})`,  icon: '🐢' },
              { id: 'expiry' as const, label: `Vencimientos (${expiryRisk.length})`,icon: '⏳' },
              { id: 'forecast' as const, label: 'Demanda y Rotación', icon: '🔮' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-white text-green-700 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── ABC Tab ── */}
          {tab === 'abc' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['#','Cat.','Producto','SKU','Categoría','Consumo ($)','Val. Stock','Qty','% Acum.','Mvtos'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {abc.items.map((item, i) => (
                    <tr key={item.productId}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${ABC_COLORS[item.abcCategory]}`}>
                          {item.abcCategory}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link to={`/inventory/products/${item.productId}`}
                          className="text-gray-800 hover:text-green-700 transition-colors max-w-[180px] truncate block font-medium">
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono">{item.sku || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{item.categoryName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">${fmt(item.consumptionValue)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">${fmt(item.stockValue)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmt(item.totalQty, 0)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              item.abcCategory === 'A' ? 'bg-emerald-500' :
                              item.abcCategory === 'B' ? 'bg-blue-500' : 'bg-gray-300'}`}
                              style={{ width: `${item.cumulativePct}%` }} />
                          </div>
                          <span className="text-gray-500 w-8 text-right">{item.cumulativePct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">{item.movementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Dead Stock Tab ── */}
          {tab === 'dead' && (
            <div>
              {deadStock.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-500">Sin stock muerto detectado en los últimos 180 días</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-gray-200 bg-red-50">
                    <p className="text-xs text-red-700">
                      ⚠️ {deadStock.length} productos con stock sin movimiento en más de 180 días ·
                      Valor inmovilizado: <span className="font-bold">${fmt(deadStock.reduce((s, p) => s + p.stockValue, 0))}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Producto','SKU','Categoría','Stock','Valor','Último Movimiento','Días Inmovilizado'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deadStock.map(item => (
                          <tr key={item.productId} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <Link to={`/inventory/products/${item.productId}`}
                                className="text-gray-800 hover:text-green-700 transition-colors font-medium">
                                {item.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 font-mono">{item.sku || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{item.categoryName}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-700">{fmt(item.totalQty, 0)}</td>
                            <td className="px-3 py-2.5 text-right text-red-600 font-semibold">${fmt(item.stockValue)}</td>
                            <td className="px-3 py-2.5 text-gray-500">
                              {item.daysSinceLastMovement === null ? 'Nunca' : `Hace ${item.daysSinceLastMovement}d`}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                (item.daysSinceLastMovement ?? 9999) > 365
                                  ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {item.daysSinceLastMovement === null ? '∞' : `${item.daysSinceLastMovement}d`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Slow Moving Tab ── */}
          {tab === 'slow' && (
            <div>
              {slowMoving.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-500">Todos los productos con stock tienen movimientos activos</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-gray-200 bg-amber-50">
                    <p className="text-xs text-amber-700">
                      🐢 {slowMoving.length} productos con menos de 3 movimientos en {data.period.days} días ·
                      Valor: <span className="font-bold">${fmt(slowMoving.reduce((s, p) => s + p.stockValue, 0))}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Producto','SKU','Categoría','Stock','Valor Inventario','Movimientos (período)','Actividad'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slowMoving.map(item => (
                          <tr key={item.productId} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <Link to={`/inventory/products/${item.productId}`}
                                className="text-gray-800 hover:text-green-700 transition-colors font-medium">
                                {item.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 font-mono">{item.sku || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{item.categoryName}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.totalQty, 0)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-600 font-semibold">${fmt(item.stockValue)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                {item.movementCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div key={i} className={`w-2 h-3 rounded-sm ${
                                    i < item.movementCount ? 'bg-amber-400' : 'bg-gray-200'
                                  }`} />
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Expiry Risk Tab ── */}
          {tab === 'expiry' && (
            <div>
              {expiryRisk.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-500">Sin lotes próximos a vencer en los próximos 30 días</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-gray-200 bg-orange-50">
                    <p className="text-xs text-orange-700">
                      ⏳ {expiryRisk.length} lotes vencen en los próximos 30 días
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Producto','SKU','Bodega','Lote','Vence','Qty Restante','Estado'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expiryRisk.map((item, i) => (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-800 font-medium">{item.productName}</td>
                            <td className="px-3 py-2.5 text-gray-400 font-mono">{item.sku || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{item.warehouseName}</td>
                            <td className="px-3 py-2.5 text-gray-500 font-mono">{item.lotNumber || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {new Date(item.expiryDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-700">{fmt(item.remainingQty, 0)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                item.daysUntilExpiry <= 0    ? 'bg-red-100 text-red-700' :
                                item.daysUntilExpiry <= 7   ? 'bg-red-50 text-red-600' :
                                item.daysUntilExpiry <= 15  ? 'bg-orange-100 text-orange-700' :
                                                              'bg-amber-50 text-amber-700'
                              }`}>
                                {item.daysUntilExpiry <= 0 ? '¡Vencido!' : `${item.daysUntilExpiry}d`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
          {/* ── Pronóstico de Demanda + Tendencia de Rotación ── */}
          {tab === 'forecast' && (
            <div className="p-5 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-500 max-w-xl min-w-0">
                  Pronóstico por suavizado exponencial sobre unidades REALMENTE despachadas por mes.
                  Incluye servicios en demanda (planeación de capacidad); la rotación solo aplica a productos con stock.
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-400">Historial:</span>
                  {[3, 6, 12].map(m => (
                    <button key={m} onClick={() => setForecastMonths(m)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        forecastMonths === m ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {forecastLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Demanda */}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">🔥 Más vendidos — pronóstico próximo período</h3>
                    <p className="text-xs text-gray-400 mb-3">{forecast?.periods.join(' · ')}</p>
                    {!forecast || forecast.products.length === 0 ? (
                      <p className="text-sm text-gray-400 py-8 text-center">Sin ventas despachadas en el período seleccionado</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              {['#', 'Producto', 'Historial', 'Total', 'Pronóstico', 'Tendencia'].map(h => (
                                <th key={h} className="px-2.5 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {forecast.products.map((p, i) => (
                              <tr key={p.productId} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-2.5 py-2 text-gray-400">{i + 1}</td>
                                <td className="px-2.5 py-2">
                                  <Link to={`/inventory/products/${p.productId}`} className="text-gray-800 hover:text-green-700 font-medium max-w-[140px] truncate block">
                                    {p.name}
                                  </Link>
                                </td>
                                <td className="px-2.5 py-2"><Sparkline history={p.history} /></td>
                                <td className="px-2.5 py-2 text-right font-medium text-gray-700">{fmt(p.totalUnits, 0)}</td>
                                <td className="px-2.5 py-2 text-right font-bold text-brand-700">{fmt(p.forecastNextPeriod, 1)}</td>
                                <td className="px-2.5 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TREND_BADGE[p.trend].color}`}>
                                    {TREND_BADGE[p.trend].label}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Rotación */}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">🔄 Tendencia de rotación por producto</h3>
                    <p className="text-xs text-gray-400 mb-3">Índice anualizado = COGS del último mes × 12 / valor de inventario actual</p>
                    {!rotationTrend || rotationTrend.products.length === 0 ? (
                      <p className="text-sm text-gray-400 py-8 text-center">Sin productos con ventas y stock en el período</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              {['#', 'Producto', 'Historial', 'Rotación', 'Nivel'].map(h => (
                                <th key={h} className="px-2.5 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rotationTrend.products.map((p, i) => (
                              <tr key={p.productId} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-2.5 py-2 text-gray-400">{i + 1}</td>
                                <td className="px-2.5 py-2">
                                  <Link to={`/inventory/products/${p.productId}`} className="text-gray-800 hover:text-green-700 font-medium max-w-[140px] truncate block">
                                    {p.name}
                                  </Link>
                                </td>
                                <td className="px-2.5 py-2"><Sparkline history={p.history} /></td>
                                <td className="px-2.5 py-2 text-right font-bold text-gray-800">{fmt(p.annualizedTurnover, 1)}×</td>
                                <td className="px-2.5 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROTATION_BADGE[p.rotationLevel].color}`}>
                                    {ROTATION_BADGE[p.rotationLevel].label}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ROW 5: METRICS SUMMARY ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">COGS del Período</p>
            <p className="text-lg font-bold text-gray-900">{fmtK(rotation.cogsPeriod)}</p>
            <p className="text-xs text-gray-400">{data.period.days} días de consumo valorado</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Entradas (período)</p>
            <p className="text-lg font-bold text-emerald-600">{fmt(rotation.totalInUnits, 0)} uds</p>
            <p className="text-xs text-gray-400">{fmt(velocity.avgDailyIn, 1)} uds/día promedio</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Salidas (período)</p>
            <p className="text-lg font-bold text-orange-500">{fmt(rotation.totalOutUnits, 0)} uds</p>
            <p className="text-xs text-gray-400">{fmt(velocity.avgDailyOut, 1)} uds/día promedio</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Costo Mantenim. Anual</p>
            <p className="text-lg font-bold text-amber-600">{fmtK(holding.holdingCostAnnual)}</p>
            <p className="text-xs text-gray-400">estimado {holding.holdingRate}% del valor</p>
          </div>
        </div>

      </main>
    </div>
  );
}
