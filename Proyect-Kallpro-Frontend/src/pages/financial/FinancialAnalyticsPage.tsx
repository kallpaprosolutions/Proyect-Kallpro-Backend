/**
 * FinancialAnalyticsPage — Dashboard KPI Financiero con diseño profesional tipo SaaS claro
 * Incluye: CCE, GMROI, Prueba Ácida, VNR, ABC, Slow Stock,
 *          Carga PDF/Excel de Estados Financieros, Análisis Vertical y Horizontal
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { financialApi } from '../../api/financial';
import {
  RefreshCw, DollarSign, FlaskConical, ClipboardList, Droplets,
  Cog, TrendingUp, Landmark as LandmarkIcon, Building2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryData {
  overview: any;
  rotation: any;
  velocity: any;
  holding: any;
  abc: any;
  deadStock: any[];
  slowMoving: any[];
  weeklyTrend: any[];
  topByValue: any[];
  categoryBreakdown: any[];
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt  = (n: number, d = 2) => n.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtK = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(1)}K`     : `$${fmt(n, 0)}`;
const fmtPct = (n: number) => `${fmt(n, 1)}%`;

// ─── Canvas: Sparkline ────────────────────────────────────────────────────────

function Sparkline({ values, color = '#16a34a', fill = true }: { values: number[]; color?: string; fill?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = c.offsetWidth, H = c.offsetHeight;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: H - ((v - min) / range) * (H - 4) - 2 }));
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    if (fill) {
      ctx.lineTo(pts[pts.length - 1].x, H); ctx.lineTo(pts[0].x, H); ctx.closePath();
      ctx.fillStyle = color + '22'; ctx.fill();
    }
  }, [values, color, fill]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Bar Chart ────────────────────────────────────────────────────────

function BarChart({ labels, series, colors }: {
  labels: string[];
  series: { name: string; data: number[] }[];
  colors: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = c.offsetWidth, H = c.offsetHeight;
    const pad = { top: 24, right: 16, bottom: 44, left: 56 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const allVals = series.flatMap(s => s.data);
    const maxVal = Math.max(...allVals, 1);
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + cH - (i / gridLines) * cH;
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(fmt((i / gridLines) * maxVal, 0), pad.left - 6, y + 3.5);
    }
    const groupW = cW / labels.length;
    const barW = (groupW * 0.7) / series.length;
    labels.forEach((label, gi) => {
      const gx = pad.left + gi * groupW + groupW * 0.15;
      series.forEach((s, si) => {
        const val = s.data[gi] ?? 0;
        const bH = (val / maxVal) * cH;
        const x = gx + si * (barW + 2);
        ctx.fillStyle = colors[si] || '#16a34a';
        ctx.beginPath(); ctx.roundRect(x, pad.top + cH - bH, barW, bH, [3, 3, 0, 0]); ctx.fill();
      });
      ctx.fillStyle = '#6b7280'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      const lbl = label.length > 10 ? label.slice(0, 9) + '…' : label;
      ctx.fillText(lbl, pad.left + gi * groupW + groupW / 2, pad.top + cH + 16);
    });
    series.forEach((s, i) => {
      ctx.fillStyle = colors[i]; ctx.fillRect(pad.left + i * 100, pad.top + cH + 28, 10, 8);
      ctx.fillStyle = '#6b7280'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(s.name, pad.left + i * 100 + 14, pad.top + cH + 36);
    });
  }, [labels, series, colors]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Line Chart ───────────────────────────────────────────────────────

function LineChart({ labels, series, colors, rightAxis }: {
  labels: string[];
  series: { name: string; data: number[]; dashed?: boolean }[];
  colors: string[];
  rightAxis?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = c.offsetWidth, H = c.offsetHeight;
    const pad = { top: 20, right: rightAxis ? 52 : 16, bottom: 44, left: 52 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + cH - (i / 4) * cH;
      ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    }
    series.forEach((s, si) => {
      const vals = s.data;
      const maxV = Math.max(...vals, 1), minV = Math.min(...vals, 0);
      const range = maxV - minV || 1;
      const pts = vals.map((v, i) => ({
        x: pad.left + (i / (vals.length - 1)) * cW,
        y: pad.top + cH - ((v - minV) / range) * cH,
      }));
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = colors[si]; ctx.lineWidth = 2;
      if (s.dashed) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, pad.top + cH); ctx.lineTo(pts[0].x, pad.top + cH); ctx.closePath();
      ctx.fillStyle = colors[si] + '18'; ctx.fill();
      pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = colors[si]; ctx.fill();
      });
    });
    labels.forEach((lbl, i) => {
      ctx.fillStyle = '#9ca3af'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(lbl, pad.left + (i / (labels.length - 1)) * cW, pad.top + cH + 14);
    });
    const maxAll = Math.max(...(series[0]?.data ?? [1]));
    const minAll = Math.min(...(series[0]?.data ?? [0]));
    for (let i = 0; i <= 4; i++) {
      const v = minAll + (i / 4) * (maxAll - minAll);
      const y = pad.top + cH - (i / 4) * cH;
      ctx.fillStyle = '#9ca3af'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(fmt(v, 0), pad.left - 6, y + 3.5);
    }
    series.forEach((s, i) => {
      const lx = pad.left + i * 140;
      ctx.strokeStyle = colors[i]; ctx.lineWidth = 2;
      if (s.dashed) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(lx, pad.top + cH + 32); ctx.lineTo(lx + 20, pad.top + cH + 32); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4b5563'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(s.name, lx + 24, pad.top + cH + 36);
    });
  }, [labels, series, colors, rightAxis]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Canvas: Donut ────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const S = Math.min(c.offsetWidth, c.offsetHeight);
    c.width = S * dpr; c.height = S * dpr; ctx.scale(dpr, dpr);
    const cx = S / 2, cy = S / 2, R = S * 0.42, r = S * 0.26;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let angle = -Math.PI / 2;
    segments.forEach(seg => {
      const sweep = (seg.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, angle, angle + sweep);
      ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
      angle += sweep;
    });
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = '#111827'; ctx.font = `bold ${Math.round(S * 0.14)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(total >= 1000 ? total / 1000 : total, 0) + (total >= 1000 ? 'K' : ''), cx, cy - S * 0.04);
    ctx.fillStyle = '#6b7280'; ctx.font = `${Math.round(S * 0.08)}px system-ui`;
    ctx.fillText('total', cx, cy + S * 0.1);
  }, [segments]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  sub: string;
  sparkValues?: number[];
  sparkColor?: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  icon: ReactNode;
  delta?: string;
  tooltip?: string;
}

function KPICard({ title, value, sub, sparkValues, sparkColor, status, icon, delta, tooltip }: KPICardProps) {
  const statusBg   = status === 'good' ? 'border-green-200' : status === 'warning' ? 'border-amber-200' : status === 'critical' ? 'border-red-200' : 'border-gray-200';
  const statusDot  = status === 'good' ? 'bg-green-500' : status === 'warning' ? 'bg-amber-500' : status === 'critical' ? 'bg-red-500' : 'bg-gray-400';
  const deltaColor = delta?.startsWith('▲') ? 'text-green-600 bg-green-50' : delta?.startsWith('▼') ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-100';
  const valueColor = status === 'critical' ? 'text-red-600' : status === 'warning' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className={`bg-white rounded-2xl border ${statusBg} p-4 shadow-sm hover:shadow-md transition-shadow`} title={tooltip}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusDot}`} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        </div>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
      <div className="flex items-end justify-between mt-2 gap-2">
        <div>
          <p className="text-xs text-gray-400">{sub}</p>
          {delta && <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block ${deltaColor}`}>{delta}</span>}
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <div style={{ width: 70, height: 28, flexShrink: 0 }}>
            <Sparkline values={sparkValues} color={sparkColor ?? (status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#16a34a')} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({ label, accept, file, onFile, icon }: {
  label: string; accept: string; icon: ReactNode;
  file: File | null; onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !file && ref.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-4 transition-colors cursor-pointer ${
        file ? 'border-green-400 bg-green-50 cursor-default' :
        drag ? 'border-green-400 bg-green-50' :
        'border-gray-200 hover:border-green-300 hover:bg-green-50/40'
      }`}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }} />
      {file ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-green-600 text-lg">✓</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-green-700 truncate">{file.name}</p>
              <p className="text-xs text-green-600 opacity-70">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onFile(null); }}
            className="text-green-500 hover:text-red-500 font-bold text-lg leading-none flex-shrink-0 transition-colors">
            ✕
          </button>
        </div>
      ) : (
        <div className="text-center py-1">
          <span className="flex justify-center text-gray-400 mb-1">{icon}</span>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF o Excel · arrastra o click</p>
        </div>
      )}
    </div>
  );
}

// ─── Input Panel ──────────────────────────────────────────────────────────────

interface InputPanelProps {
  inputTab: 'pdf' | 'excel' | 'manual' | 'contab';
  setInputTab: (t: 'pdf' | 'excel' | 'manual' | 'contab') => void;
  bsFile: File | null; setBsFile: (f: File | null) => void;
  pygFile: File | null; setPygFile: (f: File | null) => void;
  bsFile2: File | null; setBsFile2: (f: File | null) => void;
  pygFile2: File | null; setPygFile2: (f: File | null) => void;
  parsing: boolean;
  parseError: string;
  onParse: (period: 1 | 2) => void;
  onManual: () => void;
}

function InputPanel({
  inputTab, setInputTab,
  bsFile, setBsFile, pygFile, setPygFile,
  bsFile2, setBsFile2, pygFile2, setPygFile2,
  parsing, parseError, onParse, onManual,
}: InputPanelProps) {
  const isFileMode = inputTab === 'pdf' || inputTab === 'excel';
  const accept = inputTab === 'excel'
    ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
    : '.pdf,application/pdf';

  const canParse1 = !!(bsFile || pygFile);
  const canParse2 = !!(bsFile2 || pygFile2);

  const TABS = [
    { id: 'pdf',    label: '📄 PDF' },
    { id: 'excel',  label: '📊 Excel' },
    { id: 'manual', label: '✏️ Manual' },
    { id: 'contab', label: '🔗 Contabilidad' },
  ] as const;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-5">
      <div className="max-w-[1600px] mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setInputTab(t.id); if (t.id === 'manual') onManual(); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                inputTab === t.id
                  ? 'bg-white text-green-700 shadow-sm'
                  : t.id === 'contab'
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={t.id === 'contab'}
              title={t.id === 'contab' ? 'Próximamente — conexión directa al módulo de contabilidad' : undefined}
            >
              {t.label}
              {t.id === 'contab' && <span className="ml-1 text-xs bg-gray-200 text-gray-500 px-1 rounded">Próx.</span>}
            </button>
          ))}
        </div>

        {/* Contabilidad placeholder */}
        {inputTab === 'contab' && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm">
            <span className="text-2xl">🔗</span>
            <div>
              <p className="font-medium text-gray-700">Conexión directa al módulo de contabilidad</p>
              <p className="text-xs text-gray-400 mt-0.5">Próximamente podrás importar automáticamente los saldos del mayor contable sin subir archivos.</p>
            </div>
          </div>
        )}

        {/* Manual tab — opens modal immediately, nothing to show here */}
        {inputTab === 'manual' && (
          <div className="text-sm text-gray-500 italic">Abriendo formulario de entrada manual…</div>
        )}

        {/* PDF / Excel upload */}
        {isFileMode && (
          <div className="space-y-5">
            {/* Período 1 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Período 1 — Actual
                <span className="ml-2 text-xs font-normal text-gray-400">Balance General + Estado de Resultados</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDropZone label="Balance General / Situación" accept={accept} icon={<Building2 className="w-5 h-5" />} file={bsFile} onFile={setBsFile} />
                <FileDropZone label="Estado de Resultados / P&G" accept={accept} icon={<TrendingUp className="w-5 h-5" />} file={pygFile} onFile={setPygFile} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => onParse(1)}
                  disabled={!canParse1 || parsing}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    canParse1 && !parsing
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {parsing ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Procesando…</>
                  ) : (
                    '⚡ Analizar P1 →'
                  )}
                </button>
                {!canParse1 && <p className="text-xs text-gray-400">Selecciona al menos un archivo de P1</p>}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-200 pt-5">
              <p className="text-sm font-semibold text-gray-700 mb-1">
                Período 2 — Comparativo
                <span className="ml-2 text-xs font-normal text-gray-400 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">Opcional · para análisis horizontal</span>
              </p>
              <p className="text-xs text-gray-400 mb-3">Carga los estados del período anterior para activar el Análisis Horizontal</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDropZone label="Balance General — P2" accept={accept} icon={<Building2 className="w-5 h-5" />} file={bsFile2} onFile={setBsFile2} />
                <FileDropZone label="Estado de Resultados — P2" accept={accept} icon={<TrendingUp className="w-5 h-5" />} file={pygFile2} onFile={setPygFile2} />
              </div>
              <div className="mt-3">
                <button
                  onClick={() => onParse(2)}
                  disabled={!canParse2 || parsing}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    canParse2 && !parsing
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {parsing ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Procesando…</>
                  ) : (
                    '⚡ Analizar P2 →'
                  )}
                </button>
              </div>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <span className="text-base">⚠️</span>
                <div>
                  <p className="font-medium">Error al procesar</p>
                  <p className="text-xs mt-0.5 text-red-600">{parseError}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────

const BS_FIELDS = [
  { key: 'efectivo',                label: 'Efectivo y equivalentes',    group: 'Activo Corriente', example: 120000 },
  { key: 'cuentas_cobrar',          label: 'Cuentas por cobrar',         group: 'Activo Corriente', example: 85000  },
  { key: 'inventario',              label: 'Inventarios',                group: 'Activo Corriente', example: 210000 },
  { key: 'otros_activos_corrientes',label: 'Otros activos corrientes',   group: 'Activo Corriente', example: 25000  },
  { key: 'activos_no_corrientes',   label: 'Activos no corrientes (neto)',group: 'Activo No Corriente', example: 450000 },
  { key: 'total_activos',           label: 'Total Activos',              group: 'Totales',          example: 890000 },
  { key: 'cuentas_pagar',           label: 'Cuentas por pagar',          group: 'Pasivo Corriente', example: 95000  },
  { key: 'deuda_corto_plazo',       label: 'Deuda a corto plazo',        group: 'Pasivo Corriente', example: 40000  },
  { key: 'otros_pasivos_corrientes',label: 'Otros pasivos corrientes',   group: 'Pasivo Corriente', example: 18000  },
  { key: 'deuda_largo_plazo',       label: 'Deuda a largo plazo',        group: 'Pasivo No Corriente', example: 200000 },
  { key: 'total_pasivos',           label: 'Total Pasivos',              group: 'Totales',          example: 353000 },
  { key: 'patrimonio',              label: 'Patrimonio total',           group: 'Patrimonio',       example: 537000 },
];

const PYG_FIELDS = [
  { key: 'ingresos',          label: 'Ingresos netos (Ventas)', group: 'Ingresos',  example: 980000 },
  { key: 'costo_ventas',      label: 'Costo de ventas (COGS)',  group: 'Costos',    example: 588000 },
  { key: 'gastos_operativos', label: 'Gastos operativos',       group: 'Gastos',    example: 196000 },
  { key: 'depreciacion',      label: 'Depreciación y amortiz.', group: 'Gastos',    example: 36000  },
  { key: 'gastos_financieros',label: 'Gastos financieros',      group: 'Gastos',    example: 24000  },
  { key: 'utilidad_neta',     label: 'Utilidad neta',           group: 'Resultado', example: 102400 },
];

function ManualEntryModal({ onSave, onClose }: {
  onSave: (bs: Record<string, number>, pyg: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [bsVals, setBsVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(BS_FIELDS.map(f => [f.key, String(f.example)])));
  const [pygVals, setPygVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(PYG_FIELDS.map(f => [f.key, String(f.example)])));
  const [tab, setTab] = useState<'bs' | 'pyg'>('bs');

  const handleSave = () => {
    const bs  = Object.fromEntries(Object.entries(bsVals).map(([k, v]) => [k, parseFloat(v) || 0]));
    const pyg = Object.fromEntries(Object.entries(pygVals).map(([k, v]) => [k, parseFloat(v) || 0]));
    onSave(bs, pyg);
  };

  const fields = tab === 'bs' ? BS_FIELDS : PYG_FIELDS;
  const vals   = tab === 'bs' ? bsVals    : pygVals;
  const setV   = tab === 'bs' ? setBsVals : setPygVals;
  const groups = [...new Set(fields.map(f => f.group))];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Ingresar Estados Financieros</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex border-b border-gray-200">
          {[{ id: 'bs', label: 'Balance General' }, { id: 'pyg', label: 'Estado de Resultados' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as 'bs' | 'pyg')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.id ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {groups.map(g => (
            <div key={g} className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{g}</p>
              <div className="grid grid-cols-2 gap-3">
                {fields.filter(f => f.group === g).map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={vals[f.key] ?? ''}
                        onChange={e => setV(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
            Calcular KPIs →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Calculator ───────────────────────────────────────────────────────────

function calcKPIs(bs: Record<string, number>, pyg: Record<string, number>, invAnalytics?: InventoryData | null) {
  const efectivo    = bs.efectivo              ?? 0;
  const cobrar      = bs.cuentas_cobrar        ?? 0;
  const inventario  = bs.inventario            ?? (invAnalytics?.overview?.totalInventoryValue ?? 0);
  const otrosAC     = bs.otros_activos_corrientes ?? 0;
  const activoNC    = bs.activos_no_corrientes ?? 0;
  const pagar       = bs.cuentas_pagar         ?? 0;
  const deudaCP     = bs.deuda_corto_plazo     ?? 0;
  const otrosPC     = bs.otros_pasivos_corrientes ?? 0;
  const deudaLP     = bs.deuda_largo_plazo     ?? 0;
  const patrimonio  = bs.patrimonio            ?? 0;

  const ingresos    = pyg.ingresos             ?? 0;
  const cogs        = pyg.costo_ventas         ?? (invAnalytics?.rotation?.cogsPeriod ?? 0);
  const gastosOp    = pyg.gastos_operativos    ?? 0;
  const depAmort    = pyg.depreciacion         ?? 0;
  const utNeta      = pyg.utilidad_neta        ?? 0;

  const activoCorriente   = efectivo + cobrar + inventario + otrosAC;
  const pasivoCorriente   = pagar + deudaCP + otrosPC;
  const totalActivos      = bs.total_activos ?? (activoCorriente + activoNC);
  const totalPasivos      = bs.total_pasivos ?? (pasivoCorriente + deudaLP);
  const margenBruto       = ingresos > 0 ? (ingresos - cogs) : 0;
  const margenBrutoPct    = ingresos > 0 ? (margenBruto / ingresos) * 100 : 0;
  const ebitda            = margenBruto - gastosOp + depAmort;
  const ebitdaMargin      = ingresos > 0 ? (ebitda / ingresos) * 100 : 0;
  const utNetaPct         = ingresos > 0 ? (utNeta / ingresos) * 100 : 0;

  const dio = cogs > 0 ? (inventario / cogs) * 365 : (invAnalytics?.rotation?.doh ?? 0);
  const dso = ingresos > 0 ? (cobrar / ingresos) * 365 : 0;
  const dpo = cogs > 0 ? (pagar / cogs) * 365 : 0;
  const cce = dio + dso - dpo;

  const gmroi       = inventario > 0 ? margenBruto / inventario : 0;
  const pruebaAcida = pasivoCorriente > 0 ? (activoCorriente - inventario) / pasivoCorriente : 0;
  const liquidezCorriente = pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : 0;
  const capitalTrabajo    = activoCorriente - pasivoCorriente;
  const roe = patrimonio > 0 ? (utNeta / patrimonio) * 100 : 0;
  const roa = totalActivos > 0 ? (utNeta / totalActivos) * 100 : 0;
  const deudaCapital = patrimonio > 0 ? totalPasivos / patrimonio : 0;
  const vnrGap = inventario - (cogs > 0 ? (cogs / 365) * dio : inventario);

  return {
    activoCorriente, pasivoCorriente, totalActivos, totalPasivos,
    margenBruto, margenBrutoPct, ebitda, ebitdaMargin, utNetaPct,
    dio, dso, dpo, cce, gmroi, pruebaAcida, liquidezCorriente,
    capitalTrabajo, roe, roa, deudaCapital, vnrGap,
    inventario, ingresos, cogs, utNeta,
  };
}

// ─── Synthetic monthly history for charts ─────────────────────────────────────

function buildMonthlyHistory(current: ReturnType<typeof calcKPIs>, months = 12) {
  const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].slice(0, months);
  const noise = (base: number, spread = 0.15) =>
    Array.from({ length: months }, (_, i) => {
      const trend = 1 + (i / months) * 0.1;
      return Math.max(0, base * trend * (1 + (Math.random() - 0.45) * spread));
    }).map(v => Math.round(v * 10) / 10);
  return {
    labels,
    dio:    noise(current.dio, 0.2),
    margen: noise(current.margenBrutoPct, 0.12),
    cce:    noise(current.cce, 0.18),
    gmroi:  noise(current.gmroi, 0.15),
  };
}

// ─── Análisis Vertical ────────────────────────────────────────────────────────

interface ParsedAccount {
  code: string;
  name: string;
  value: number;
  depth: number;
}

function VerticalBar({ pct }: { pct: number }) {
  const w = Math.min(Math.max(pct, 0), 100);
  const color = w > 30 ? 'bg-green-500' : w > 15 ? 'bg-blue-400' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 tabular-nums w-12 text-right">{w.toFixed(1)}%</span>
    </div>
  );
}

function VerticalAnalysis({ bsAccounts, pygAccounts, bsData, pygData }: {
  bsAccounts: ParsedAccount[];
  pygAccounts: ParsedAccount[];
  bsData: Record<string, number>;
  pygData: Record<string, number>;
}) {
  const totalActivos = Math.max(bsData.total_activos ?? bsData.efectivo ?? 1, 1);
  const ingresos     = Math.max(pygData.ingresos ?? 1, 1);

  // Build BS rows — prefer structuredAccounts from parser (more detailed)
  // Fallback to static BS_FIELDS
  const bsRows: { code: string; name: string; value: number; depth: number }[] =
    bsAccounts.length > 0
      ? bsAccounts.filter(a => Math.abs(a.value) > 0)
      : BS_FIELDS.filter(f => (bsData[f.key] ?? 0) !== 0).map((f, i) => ({
          code: '',
          name: f.label,
          value: bsData[f.key] ?? 0,
          depth: i < 5 ? 2 : 3,
        }));

  const pygRows: { code: string; name: string; value: number; depth: number }[] =
    pygAccounts.length > 0
      ? pygAccounts.filter(a => Math.abs(a.value) > 0)
      : PYG_FIELDS.filter(f => (pygData[f.key] ?? 0) !== 0).map(f => ({
          code: '',
          name: f.label,
          value: pygData[f.key] ?? 0,
          depth: 2,
        }));

  const TableSection = ({
    title, rows, base, baseLabel,
  }: {
    title: string;
    rows: { code: string; name: string; value: number; depth: number }[];
    base: number;
    baseLabel: string;
  }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Base: {baseLabel} = {fmtK(base)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Código</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Monto</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">% {baseLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => {
              const pct = (Math.abs(row.value) / base) * 100;
              const isHeader = row.depth <= 2;
              return (
                <tr key={i} className={`hover:bg-gray-50 transition-colors ${isHeader ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">{row.code || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`${isHeader ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
                      style={{ paddingLeft: Math.max(0, (row.depth - 2)) * 16 }}>
                      {row.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-700">{fmtK(Math.abs(row.value))}</td>
                  <td className="px-4 py-2"><VerticalBar pct={pct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Análisis Vertical</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Cada cuenta como % del total de su estado</span>
      </div>
      <TableSection
        title="📊 Balance General — Peso relativo de cada cuenta"
        rows={bsRows}
        base={totalActivos}
        baseLabel="Total Activos"
      />
      <TableSection
        title="📈 Estado de Resultados — Composición de ingresos"
        rows={pygRows}
        base={ingresos}
        baseLabel="Ingresos"
      />
    </div>
  );
}

// ─── Análisis Horizontal ──────────────────────────────────────────────────────

function deltaColor(key: string, delta: number): string {
  const goodUp = ['efectivo','cuentas_cobrar','inventario','activos_no_corrientes',
    'activo_corriente','total_activos','ingresos','utilidad_neta','utilidad_bruta',
    'utilidad_operativa','patrimonio'];
  const goodDown = ['cuentas_pagar','deuda_corto_plazo','deuda_largo_plazo',
    'costo_ventas','gastos_financieros','otros_gastos','gastos_operativos',
    'total_pasivos','pasivo_corriente'];
  if (delta === 0) return 'text-gray-400';
  if (delta > 0) return goodUp.includes(key) ? 'text-green-600' : goodDown.includes(key) ? 'text-red-600' : 'text-gray-600';
  return goodDown.includes(key) ? 'text-green-600' : goodUp.includes(key) ? 'text-red-600' : 'text-gray-600';
}

function HorizontalAnalysis({
  bsData, pygData, bs2Data, pyg2Data, period1Label, period2Label,
}: {
  bsData: Record<string, number>;
  pygData: Record<string, number>;
  bs2Data: Record<string, number> | null;
  pyg2Data: Record<string, number> | null;
  period1Label: string;
  period2Label: string;
}) {
  if (!bs2Data && !pyg2Data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-3">↔️</span>
        <h3 className="text-base font-bold text-gray-700 mb-1">Análisis Horizontal</h3>
        <p className="text-sm text-gray-400 max-w-sm">
          Carga los estados financieros del período anterior (P2) en el panel de carga para comparar ambos períodos.
        </p>
      </div>
    );
  }

  const CompareTable = ({
    title, fields, p1, p2,
  }: {
    title: string;
    fields: { key: string; label: string; group: string }[];
    p1: Record<string, number>;
    p2: Record<string, number>;
  }) => {
    const groups = [...new Set(fields.map(f => f.group))];
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <div className="flex gap-2 text-xs">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-medium">{period1Label}</span>
            <span className="text-gray-400">vs</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg font-medium">{period2Label}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-green-600 uppercase tracking-wide w-28">{period1Label}</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-blue-600 uppercase tracking-wide w-28">{period2Label}</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Δ Absoluto</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Δ %</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <>
                  <tr key={g + '_header'} className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{g}</td>
                  </tr>
                  {fields.filter(f => f.group === g).map(f => {
                    const v1 = p1[f.key] ?? 0;
                    const v2 = p2[f.key] ?? 0;
                    const delta = v1 - v2;
                    const deltaPct = v2 !== 0 ? (delta / Math.abs(v2)) * 100 : 0;
                    const dClass = deltaColor(f.key, delta);
                    return (
                      <tr key={f.key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{f.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-green-700">{fmtK(v1)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-blue-600">{fmtK(v2)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${dClass}`}>
                          {delta >= 0 ? '+' : ''}{fmtK(delta)}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs font-bold ${dClass}`}>
                          {v2 !== 0 ? (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                              dClass.includes('green') ? 'bg-green-50' :
                              dClass.includes('red')   ? 'bg-red-50' :
                              'bg-gray-100'
                            }`}>
                              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Análisis Horizontal</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Comparación entre dos períodos — variación absoluta y relativa</span>
      </div>
      <CompareTable
        title="📊 Balance General"
        fields={BS_FIELDS}
        p1={bsData}
        p2={bs2Data ?? {}}
      />
      <CompareTable
        title="📈 Estado de Resultados"
        fields={PYG_FIELDS}
        p1={pygData}
        p2={pyg2Data ?? {}}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialAnalyticsPage() {
  const navigate = useNavigate();

  // ── UI state ───────────────────────────────────────────────
  const [showInputPanel, setShowInputPanel] = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [inputTab, setInputTab]             = useState<'pdf' | 'excel' | 'manual' | 'contab'>('pdf');
  const [analysisTab, setAnalysisTab]       = useState<'kpis' | 'vertical' | 'horizontal'>('kpis');

  // ── Financial data — Período 1 ─────────────────────────────
  const [bsData, setBsData]                 = useState<Record<string, number> | null>(null);
  const [pygData, setPygData]               = useState<Record<string, number> | null>(null);
  const [bsAccounts, setBsAccounts]         = useState<ParsedAccount[]>([]);
  const [pygAccounts, setPygAccounts]       = useState<ParsedAccount[]>([]);
  const [period1Label, setPeriod1Label]     = useState('Período 1');

  // ── Financial data — Período 2 (comparativo) ───────────────
  const [bs2Data, setBs2Data]               = useState<Record<string, number> | null>(null);
  const [pyg2Data, setPyg2Data]             = useState<Record<string, number> | null>(null);
  const [period2Label, setPeriod2Label]     = useState('Período 2');

  // ── File selection ─────────────────────────────────────────
  const [bsFile, setBsFile]   = useState<File | null>(null);
  const [pygFile, setPygFile] = useState<File | null>(null);
  const [bsFile2, setBsFile2]   = useState<File | null>(null);
  const [pygFile2, setPygFile2] = useState<File | null>(null);

  // ── Parsing ────────────────────────────────────────────────
  const [parsing, setParsing]       = useState(false);
  const [parseError, setParseError] = useState('');

  // ── Inventory data ─────────────────────────────────────────
  const [invData, setInvData]       = useState<InventoryData | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);

  useEffect(() => {
    inventoryApi.getAnalytics(90)
      .then(r => setInvData(r.data))
      .catch(() => {})
      .finally(() => setLoadingInv(false));
  }, []);

  // ── Parse handler ──────────────────────────────────────────
  const handleParse = async (period: 1 | 2) => {
    const bs  = period === 1 ? bsFile  : bsFile2;
    const pyg = period === 1 ? pygFile : pygFile2;
    if (!bs && !pyg) return;
    setParsing(true);
    setParseError('');
    try {
      const r = await financialApi.parseStatement(bs, pyg);
      const { bsFields, pygFields, balanceSheet, incomeStatement } = r.data;
      if (period === 1) {
        setBsData(bsFields && Object.keys(bsFields).length > 0 ? bsFields : null);
        setPygData(pygFields && Object.keys(pygFields).length > 0 ? pygFields : null);
        setBsAccounts(balanceSheet?.structuredAccounts ?? []);
        setPygAccounts(incomeStatement?.structuredAccounts ?? []);
        if (balanceSheet?.period)    setPeriod1Label(balanceSheet.period);
        else if (incomeStatement?.period) setPeriod1Label(incomeStatement.period);
      } else {
        setBs2Data(bsFields && Object.keys(bsFields).length > 0 ? bsFields : null);
        setPyg2Data(pygFields && Object.keys(pygFields).length > 0 ? pygFields : null);
        if (balanceSheet?.period)    setPeriod2Label(balanceSheet.period);
        else if (incomeStatement?.period) setPeriod2Label(incomeStatement.period);
      }
      setShowInputPanel(false);
    } catch (e: any) {
      setParseError(e.response?.data?.error ?? 'Error al procesar los archivos. Verifica el formato.');
    } finally {
      setParsing(false);
    }
  };

  const handleManualSave = (bs: Record<string, number>, pyg: Record<string, number>) => {
    setBsData(bs); setPygData(pyg); setShowModal(false);
    setBsAccounts([]); setPygAccounts([]);
  };

  const handleInputTabChange = (t: 'pdf' | 'excel' | 'manual' | 'contab') => {
    setInputTab(t);
    if (t === 'manual') {
      setShowModal(true);
      setShowInputPanel(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────
  const hasFinancial  = !!(bsData && pygData);
  const hasComparison = !!(bs2Data || pyg2Data);

  const kpis = hasFinancial
    ? calcKPIs(bsData!, pygData!, invData)
    : invData
      ? calcKPIs(
          { inventario: invData.overview.totalInventoryValue },
          { costo_ventas: invData.rotation.cogsPeriod ?? 0 },
          invData,
        )
      : null;

  const history      = kpis ? buildMonthlyHistory(kpis) : null;
  const abcSegments  = invData ? [
    { label: 'Clase A', value: invData.abc.summary.aCount, color: '#16a34a' },
    { label: 'Clase B', value: invData.abc.summary.bCount, color: '#3b82f6' },
    { label: 'Clase C', value: invData.abc.summary.cCount, color: '#f59e0b' },
  ] : [];
  const catLabels  = invData?.categoryBreakdown.slice(0, 6).map((c: any) => c.name) ?? [];
  const catCost    = invData?.categoryBreakdown.slice(0, 6).map((c: any) => c.value * 0.6) ?? [];
  const catProfit  = invData?.categoryBreakdown.slice(0, 6).map((c: any) => c.value * 0.4) ?? [];
  const slowStock  = (invData?.slowMoving ?? []).map((p: any) => ({
    ...p,
    opportunityCost:  p.stockValue * 0.25 / 12,
    daysImmobilized:  p.movementCount === 0 ? 180 : Math.round(90 / (p.movementCount + 0.5)),
  }));

  // Status badge label
  const statusLabel = hasFinancial && hasComparison
    ? '✓ P1 + P2 cargados'
    : hasFinancial
      ? '✓ P1 cargado'
      : '⚠ Solo datos de inventario';
  const statusClass = hasFinancial
    ? 'bg-green-100 text-green-700'
    : 'bg-amber-100 text-amber-700';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/financial')}
              className="text-gray-400 hover:text-gray-700 text-sm transition-colors">
              ← Finanzas
            </button>
            <div className="w-px h-4 bg-gray-300" />
            <h1 className="text-base font-bold text-gray-900">📊 Análisis Financiero KPI</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInputPanel(v => !v)}
              className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
                showInputPanel
                  ? 'bg-green-600 text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'
              }`}
            >
              📂 {showInputPanel ? 'Ocultar panel' : 'Cargar Estados Financieros'}
            </button>
          </div>
        </div>
      </header>

      {/* ── INPUT PANEL ───────────────────────────────────────────── */}
      {showInputPanel && (
        <InputPanel
          inputTab={inputTab}
          setInputTab={handleInputTabChange}
          bsFile={bsFile}     setBsFile={setBsFile}
          pygFile={pygFile}   setPygFile={setPygFile}
          bsFile2={bsFile2}   setBsFile2={setBsFile2}
          pygFile2={pygFile2} setPygFile2={setPygFile2}
          parsing={parsing}
          parseError={parseError}
          onParse={handleParse}
          onManual={() => setShowModal(true)}
        />
      )}

      {showModal && <ManualEntryModal onSave={handleManualSave} onClose={() => setShowModal(false)} />}

      <main className="p-5 max-w-[1600px] mx-auto space-y-6">

        {/* ── LOADING ── */}
        {loadingInv && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Cargando datos de inventario…</p>
            </div>
          </div>
        )}

        {!loadingInv && kpis && (
          <>
            {/* ── ANALYSIS TAB BAR ─────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  { id: 'kpis',       label: '📊 KPIs' },
                  { id: 'vertical',   label: '📐 Análisis Vertical' },
                  { id: 'horizontal', label: '↔️ Análisis Horizontal' },
                ] as const).map(t => {
                  const disabled = (t.id === 'vertical' || t.id === 'horizontal') && !hasFinancial;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { if (!disabled) setAnalysisTab(t.id); }}
                      disabled={disabled}
                      title={disabled ? 'Carga estados financieros (P1) para activar este análisis' : undefined}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        analysisTab === t.id
                          ? 'bg-white text-green-700 shadow-sm'
                          : disabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {!hasFinancial && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                  💡 Carga Balance + P&G para activar: DSO, DPO, Prueba Ácida, VNR, ROE, ROA y análisis vertical/horizontal
                </p>
              )}
            </div>

            {/* ── TAB: ANÁLISIS VERTICAL ─────────────────────────────── */}
            {analysisTab === 'vertical' && hasFinancial && (
              <VerticalAnalysis
                bsAccounts={bsAccounts}
                pygAccounts={pygAccounts}
                bsData={bsData!}
                pygData={pygData!}
              />
            )}

            {/* ── TAB: ANÁLISIS HORIZONTAL ───────────────────────────── */}
            {analysisTab === 'horizontal' && hasFinancial && (
              <HorizontalAnalysis
                bsData={bsData!}
                pygData={pygData!}
                bs2Data={bs2Data}
                pyg2Data={pyg2Data}
                period1Label={period1Label}
                period2Label={period2Label}
              />
            )}

            {/* ── TAB: KPIs ─────────────────────────────────────────── */}
            {analysisTab === 'kpis' && (
              <>
                {/* SECCIÓN 1: KPIs CRÍTICOS */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Indicadores Críticos</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPICard
                      title="CCE (Ciclo Conversión)"
                      value={`${kpis.cce.toFixed(0)} días`}
                      sub={`DIO ${kpis.dio.toFixed(0)}d + DSO ${kpis.dso.toFixed(0)}d − DPO ${kpis.dpo.toFixed(0)}d`}
                      sparkValues={history?.cce}
                      sparkColor={kpis.cce > 90 ? '#ef4444' : kpis.cce > 60 ? '#f59e0b' : '#16a34a'}
                      status={kpis.cce > 90 ? 'critical' : kpis.cce > 60 ? 'warning' : 'good'}
                      icon={<RefreshCw className="w-4 h-4" />}
                      delta={kpis.cce > 90 ? '▼ >90d riesgo' : '▲ Óptimo'}
                      tooltip="CCE = DIO + DSO - DPO. Cuanto menor, mejor eficiencia del capital circulante."
                    />
                    <KPICard
                      title="GMROI"
                      value={`${kpis.gmroi.toFixed(2)}×`}
                      sub="Margen Bruto / Inventario Promedio"
                      sparkValues={history?.gmroi}
                      sparkColor={kpis.gmroi >= 2 ? '#16a34a' : kpis.gmroi >= 1 ? '#f59e0b' : '#ef4444'}
                      status={kpis.gmroi >= 2 ? 'good' : kpis.gmroi >= 1 ? 'warning' : 'critical'}
                      icon={<DollarSign className="w-4 h-4" />}
                      delta={kpis.gmroi >= 2 ? '▲ Excelente (≥2×)' : kpis.gmroi >= 1 ? '→ Aceptable (≥1×)' : '▼ Por debajo del mínimo'}
                      tooltip="GMROI ≥ 2× = excelente retorno de inversión en inventario."
                    />
                    <KPICard
                      title="Prueba Ácida"
                      value={hasFinancial ? kpis.pruebaAcida.toFixed(2) : '—'}
                      sub={hasFinancial ? `(AC $${(kpis.activoCorriente/1000).toFixed(0)}K − Inv) / PC` : 'Requiere Balance General'}
                      status={!hasFinancial ? 'neutral' : kpis.pruebaAcida >= 1 ? 'good' : kpis.pruebaAcida >= 0.7 ? 'warning' : 'critical'}
                      icon={<FlaskConical className="w-4 h-4" />}
                      delta={hasFinancial ? (kpis.pruebaAcida >= 1 ? '▲ Solvente (≥1.0)' : '▼ Riesgo liquidez') : undefined}
                      tooltip="Prueba ácida ≥ 1 indica liquidez sin depender del inventario."
                    />
                    <KPICard
                      title="VNR (Brecha NIIF)"
                      value={hasFinancial ? fmtK(Math.abs(kpis.vnrGap)) : '—'}
                      sub={hasFinancial ? (kpis.vnrGap < 0 ? '⚠ Posible deterioro de inventario' : 'Sin brecha significativa') : 'Requiere P&G'}
                      status={!hasFinancial ? 'neutral' : kpis.vnrGap < -10000 ? 'critical' : kpis.vnrGap < 0 ? 'warning' : 'good'}
                      icon={<ClipboardList className="w-4 h-4" />}
                      delta={hasFinancial ? (kpis.vnrGap < 0 ? '▼ Ajuste NIIF recomendado' : '▲ Sin ajuste requerido') : undefined}
                      tooltip="VNR: si costo > valor neto realizable, NIIF exige ajuste (impairment)."
                    />
                  </div>

                  {/* Secondary KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <KPICard
                      title="Liquidez Corriente"
                      value={hasFinancial ? kpis.liquidezCorriente.toFixed(2) : '—'}
                      sub="Activo Corriente / Pasivo Corriente"
                      status={!hasFinancial ? 'neutral' : kpis.liquidezCorriente >= 2 ? 'good' : kpis.liquidezCorriente >= 1.2 ? 'warning' : 'critical'}
                      icon={<Droplets className="w-4 h-4" />}
                      delta={hasFinancial ? (kpis.liquidezCorriente >= 1.5 ? '▲ Buena cobertura' : '▼ Revisar pasivos') : undefined}
                    />
                    <KPICard
                      title="Capital de Trabajo"
                      value={hasFinancial ? fmtK(kpis.capitalTrabajo) : '—'}
                      sub="Activo Corriente − Pasivo Corriente"
                      status={!hasFinancial ? 'neutral' : kpis.capitalTrabajo > 0 ? 'good' : 'critical'}
                      icon={<Cog className="w-4 h-4" />}
                    />
                    <KPICard
                      title="Margen Bruto"
                      value={hasFinancial ? fmtPct(kpis.margenBrutoPct) : `${(invData?.rotation?.cogsPeriod != null && invData.rotation.cogsPeriod > 0 ? ((1 - invData.rotation.cogsPeriod / (invData.rotation.cogsPeriod * 1.67)) * 100) : 0).toFixed(1)}%`}
                      sub={hasFinancial ? fmtK(kpis.margenBruto) + ' margen $' : 'Estimado desde inventario'}
                      sparkValues={history?.margen}
                      sparkColor="#3b82f6"
                      status={kpis.margenBrutoPct >= 40 ? 'good' : kpis.margenBrutoPct >= 25 ? 'warning' : 'critical'}
                      icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <KPICard
                      title="EBITDA Margen"
                      value={hasFinancial ? fmtPct(kpis.ebitdaMargin) : '—'}
                      sub={hasFinancial ? fmtK(kpis.ebitda) + ' EBITDA $' : 'Requiere P&G completo'}
                      status={!hasFinancial ? 'neutral' : kpis.ebitdaMargin >= 15 ? 'good' : kpis.ebitdaMargin >= 8 ? 'warning' : 'critical'}
                      icon={<LandmarkIcon className="w-4 h-4" />}
                      delta={hasFinancial ? (kpis.ebitdaMargin >= 15 ? '▲ Saludable (≥15%)' : kpis.ebitdaMargin >= 8 ? '→ Aceptable' : '▼ Por debajo del mínimo') : undefined}
                    />
                  </div>
                </section>

                {/* SECCIÓN 2: GRÁFICOS */}
                <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className="xl:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-gray-800">Días de Inventario (DIO) vs Margen Bruto</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Últimos 12 meses · estimado</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Relación inversa esperada: mayor DIO reduce presión de margen</p>
                    <div style={{ height: 230 }}>
                      {history && (
                        <LineChart
                          labels={history.labels}
                          series={[
                            { name: 'DIO (días)', data: history.dio },
                            { name: 'Margen Bruto (%)', data: history.margen, dashed: true },
                          ]}
                          colors={['#16a34a', '#3b82f6']}
                          rightAxis
                        />
                      )}
                    </div>
                  </div>

                  <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Análisis ABC — Composición del Inventario</h3>
                    <div className="flex items-center gap-4">
                      <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                        <DonutChart segments={abcSegments.length ? abcSegments : [{ label: '—', value: 1, color: '#e5e7eb' }]} />
                      </div>
                      <div className="flex-1 space-y-2.5">
                        {[
                          { label: 'Clase A', desc: '20% SKUs · 80% del valor', color: '#16a34a', count: invData?.abc.summary.aCount ?? 0, pct: invData?.abc.summary.aValuePct ?? 0 },
                          { label: 'Clase B', desc: '30% SKUs · 15% del valor', color: '#3b82f6', count: invData?.abc.summary.bCount ?? 0, pct: invData?.abc.summary.bValuePct ?? 0 },
                          { label: 'Clase C', desc: '50% SKUs · 5% del valor',  color: '#f59e0b', count: invData?.abc.summary.cCount ?? 0, pct: invData?.abc.summary.cValuePct ?? 0 },
                        ].map(s => (
                          <div key={s.label}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="font-medium text-gray-700">{s.label}</span>
                                <span className="text-gray-400">({s.count} SKU)</span>
                              </div>
                              <span className="font-semibold" style={{ color: s.color }}>{s.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Resumen de Inversión</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[
                          { label: 'A — Críticos',    value: fmtK(invData?.topByValue?.slice(0, invData.abc.summary.aCount).reduce((s: number, p: any) => s + p.stockValue, 0) ?? 0), color: 'text-green-700 bg-green-50' },
                          { label: 'B — Importantes', value: '—', color: 'text-blue-700 bg-blue-50' },
                          { label: 'C — Ordinarios',  value: '—', color: 'text-amber-700 bg-amber-50' },
                        ].map(x => (
                          <div key={x.label} className={`rounded-lg p-2 ${x.color}`}>
                            <p className="font-bold text-sm">{x.value}</p>
                            <p className="text-xs opacity-70">{x.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Costo Mantenimiento vs Utilidad */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-800">Costo de Mantenimiento vs Utilidad Generada por Categoría</h3>
                    <span className="text-xs text-gray-400">Holding cost 25% anual / {catLabels.length} categorías</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Barras verdes = utilidad estimada · Barras grises = costo anual de mantenimiento</p>
                  <div style={{ height: 220 }}>
                    {catLabels.length > 0 ? (
                      <BarChart
                        labels={catLabels}
                        series={[
                          { name: 'Utilidad generada ($)', data: catProfit },
                          { name: 'Costo mantenimiento ($)', data: catCost.map((v: number) => v * 0.25) },
                        ]}
                        colors={['#16a34a', '#9ca3af']}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sin datos de categorías disponibles
                      </div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN 3: SLOW STOCK */}
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">📋 Auditoría — Stock de Lento Movimiento (&gt;90 días)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Capital inmovilizado · Costo de oportunidad estimado al 25% anual</p>
                    </div>
                    {slowStock.length > 0 && (
                      <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg font-medium">
                        ⚠ {slowStock.length} productos · {fmtK(slowStock.reduce((s: number, p: any) => s + p.stockValue, 0))} inmovilizados
                      </span>
                    )}
                  </div>
                  {slowStock.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-gray-500 text-sm">Sin productos de lento movimiento detectados</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            {['Producto', 'SKU', 'Categoría', 'Stock Qty', 'Valor Inventario', 'Movimientos', 'Días Est.', 'Costo Oport./mes', 'Impacto Anual', 'Estado'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {slowStock.map((item: any, i: number) => {
                            const annual = item.opportunityCost * 12;
                            const urgency = item.movementCount === 0 ? 'critical' : 'warning';
                            return (
                              <tr key={item.productId} className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-4 py-3">
                                  <button onClick={() => navigate(`/inventory/products/${item.productId}`)}
                                    className="font-medium text-gray-800 hover:text-green-700 transition-colors text-left">
                                    {item.name}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.sku || '—'}</td>
                                <td className="px-4 py-3">
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{item.categoryName}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-gray-700">{fmt(item.totalQty, 0)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">${fmt(item.stockValue)}</td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex justify-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, j) => (
                                      <div key={j} className={`w-2 h-3 rounded-sm ${j < item.movementCount ? 'bg-green-400' : 'bg-gray-200'}`} />
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.daysImmobilized > 180 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                                    ~{item.daysImmobilized}d
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-amber-600">${fmt(item.opportunityCost)}</td>
                                <td className="px-4 py-3 text-right font-bold text-red-600">${fmt(annual)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${urgency === 'critical' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                    {urgency === 'critical' ? '🔴 Sin mov.' : '🟡 Lento'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">TOTALES</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">
                              ${fmt(slowStock.reduce((s: number, p: any) => s + p.stockValue, 0))}
                            </td>
                            <td colSpan={2} />
                            <td className="px-4 py-3 text-right font-bold text-amber-600">
                              ${fmt(slowStock.reduce((s: number, p: any) => s + p.opportunityCost, 0))}/mes
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">
                              ${fmt(slowStock.reduce((s: number, p: any) => s + p.opportunityCost * 12, 0))}/año
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>

                {/* Resumen financiero adicional (cuando tiene datos completos) */}
                {hasFinancial && (
                  <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'ROE (Retorno Patrimonio)', value: fmtPct(kpis.roe), good: kpis.roe >= 15, warn: kpis.roe >= 8, icon: '📊' },
                      { label: 'ROA (Retorno Activos)',    value: fmtPct(kpis.roa), good: kpis.roa >= 5,  warn: kpis.roa >= 2, icon: '🏛️' },
                      { label: 'Deuda / Patrimonio',       value: kpis.deudaCapital.toFixed(2) + '×', good: kpis.deudaCapital <= 1, warn: kpis.deudaCapital <= 2, icon: '⚖️' },
                      { label: 'Utilidad Neta',            value: fmtK(kpis.utNeta), good: kpis.utNetaPct >= 10, warn: kpis.utNetaPct >= 5, icon: '💵' },
                    ].map(item => (
                      <div key={item.label} className={`bg-white rounded-2xl border p-4 shadow-sm ${item.good ? 'border-green-200' : item.warn ? 'border-amber-200' : 'border-red-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <span className="text-lg">{item.icon}</span>
                        </div>
                        <p className={`text-2xl font-bold ${item.good ? 'text-green-700' : item.warn ? 'text-amber-700' : 'text-red-600'}`}>
                          {item.value}
                        </p>
                        <div className={`mt-1.5 text-xs px-2 py-0.5 rounded-full inline-block font-medium ${item.good ? 'bg-green-50 text-green-700' : item.warn ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                          {item.good ? '▲ Óptimo' : item.warn ? '→ Aceptable' : '▼ Requiere atención'}
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {!loadingInv && !kpis && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-5xl mb-4">📊</p>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Sin datos disponibles</h2>
            <p className="text-gray-400 text-sm max-w-sm mb-6">
              Registra movimientos de inventario o carga tus estados financieros para activar el dashboard KPI.
            </p>
            <button onClick={() => setShowInputPanel(true)}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm">
              📂 Cargar estados financieros
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
