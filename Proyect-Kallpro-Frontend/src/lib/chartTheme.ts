/**
 * Sistema unificado de tema para gráficos — centraliza colores, tooltips
 * y estilos de Recharts para consistencia y soporte dark mode.
 *
 * Principios del manual UI/UX aplicados:
 * - Paleta limitada (3-5 colores principales) con propósito semántico
 * - Contraste suficiente en ambos temas
 * - Consistencia: mismos tokens en toda la app
 */

// ── Paleta categórica principal (máx 8 series) ─────────────────────
export const CHART_COLORS = {
  categorical: [
    '#06b6d4', // cyan-500   — serie primaria / brand
    '#8b5cf6', // violet-500 — serie secundaria
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
  ],
  // Semánticos (significado fijo en dashboards)
  positive: '#10b981',
  negative: '#ef4444',
  warning:  '#f59e0b',
  neutral:  '#6b7280',
  brand:    '#06b6d4',
  // ABC / prioridad
  abc: ['#34d399', '#facc15', '#fb923c', '#f87171'],
  // Presupuesto
  budget:    '#e5e7eb',
  budgetDark:'#374151',
  actual:    '#06b6d4',
} as const;

// ── Colores de grilla y ejes según tema ────────────────────────────
export function getAxisColor(isDark: boolean) {
  return isDark ? '#6b7280' : '#9ca3af';
}

export function getGridColor(isDark: boolean) {
  return isDark ? '#374151' : '#e5e7eb';
}

// ── Tooltip estilizado con soporte dark mode ───────────────────────
export function getTooltipStyle(isDark: boolean) {
  return {
    contentStyle: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      color: isDark ? '#f3f4f6' : '#111827',
      boxShadow: isDark
        ? '0 4px 6px -1px rgba(0,0,0,0.3)'
        : '0 4px 6px -1px rgba(0,0,0,0.07)',
      padding: '8px 12px',
      fontSize: '13px',
    },
    cursor: { stroke: isDark ? '#4b5563' : '#d1d5db', strokeDasharray: '4 4' },
    itemStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: '12px' },
    labelStyle: { color: isDark ? '#9ca3af' : '#6b7280', fontSize: '11px', marginBottom: '4px' },
  };
}

// ── Legend estilizada ──────────────────────────────────────────────
export function getLegendStyle(isDark: boolean) {
  return {
    wrapperStyle: {
      fontSize: '11px',
      color: isDark ? '#9ca3af' : '#6b7280',
      paddingTop: '8px',
    },
  };
}

// ── Formateadores comunes ──────────────────────────────────────────
export const fmt = {
  currency: (v: number) =>
    '$' + v.toLocaleString('es', { minimumFractionDigits: 2 }),
  currencyK: (v: number) =>
    `$${(v / 1000).toFixed(0)}k`,
  integer: (n: number) => n.toLocaleString('es'),
  percent: (n: number) => `${n.toFixed(1)}%`,
  compact: (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
  },
};

// ── Props comunes de CartesianGrid ─────────────────────────────────
export function getGridProps(isDark: boolean) {
  return {
    strokeDasharray: '3 3',
    stroke: getGridColor(isDark),
    strokeOpacity: isDark ? 0.5 : 1,
  };
}

// ── Props comunes de ejes ──────────────────────────────────────────
export function getAxisProps(isDark: boolean) {
  return {
    stroke: getAxisColor(isDark),
    tick: { fontSize: 11, fill: getAxisColor(isDark) },
    tickLine: false,
    axisLine: { stroke: getGridColor(isDark) },
  };
}

// ── Animación estandar de barras ───────────────────────────────────
export const barAnimation = {
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
};
