/**
 * Etiquetas del CRM Pro (Sprint 13), centralizadas.
 *
 * Regla transversal 7: la interfaz va en español y NUNCA muestra enums crudos.
 * Todo lo que el backend devuelve como código (NEW, COMMIT, FIT…) se traduce aquí,
 * en un solo sitio, para que no haya dos pantallas llamando distinto a lo mismo.
 */

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  WORKING: 'En gestión',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  DISQUALIFIED: 'Descartado',
};

export const LEAD_STATUS_VARIANTS: Record<string, 'info' | 'warning' | 'brand' | 'success' | 'neutral'> = {
  NEW: 'info',
  WORKING: 'warning',
  QUALIFIED: 'brand',
  CONVERTED: 'success',
  DISQUALIFIED: 'neutral',
};

export const TEMPERATURE_LABELS: Record<string, string> = {
  hot: 'Caliente',
  warm: 'Tibio',
  cold: 'Frío',
};

export const TEMPERATURE_ICONS: Record<string, string> = {
  hot: '🔥',
  warm: '🌤️',
  cold: '❄️',
};

export const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  B: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  C: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  D: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300',
};

export const SOURCE_LABELS: Record<string, string> = {
  web_form: 'Formulario web',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  gmail: 'Correo',
  import: 'Importación',
  manual: 'Manual',
  api: 'API',
};

export const SCORING_CATEGORY_LABELS: Record<string, string> = {
  FIT: 'Perfil',
  ENGAGEMENT: 'Interacción',
  NEGATIVE: 'Penalización',
};

export const FORECAST_CATEGORY_LABELS: Record<string, string> = {
  PIPELINE: 'Pipeline',
  BEST_CASE: 'Mejor caso',
  COMMIT: 'Comprometido',
  CLOSED: 'Cerrado',
  OMITTED: 'Omitido',
};

export const FORECAST_CATEGORY_COLORS: Record<string, string> = {
  PIPELINE: '#94a3b8',
  BEST_CASE: '#8b5cf6',
  COMMIT: '#10b981',
  CLOSED: '#0ea5e9',
  OMITTED: '#cbd5e1',
};

export const AUTONOMY_LABELS: Record<string, string> = {
  autopilot: 'Piloto automático',
  setter_closer: 'Agente califica, humano cierra',
  semi_assisted: 'Redacta y espera aprobación',
  manual: 'Solo sugiere',
};

export const AGENT_NAMES: Record<string, { name: string; icon: string; role: string }> = {
  router: { name: 'Ruteador', icon: '🔀', role: 'Clasifica cada mensaje entrante y lo delega' },
  sdr: { name: 'Sofía · SDR', icon: '🎯', role: 'Califica por BANT, agenda reuniones y registra compromisos' },
  researcher: { name: 'Iván · Investigador', icon: '🔎', role: 'Valida el RUC, enriquece la empresa y detecta señales de compra' },
  copywriter: { name: 'Redactor', icon: '✍️', role: 'Redacta el mensaje personalizado por canal' },
  closer: { name: 'Cierre', icon: '🤝', role: 'Maneja objeciones, pide aprobación de descuentos y cierra' },
  success: { name: 'Éxito del cliente', icon: '💚', role: 'Vigila la salud de la cuenta y detecta riesgo de fuga' },
};

export const ACCURACY_VERDICT_LABELS: Record<string, string> = {
  preciso: 'Preciso',
  sub_pronostico: 'Sub-pronóstico',
  sobre_pronostico: 'Sobre-pronóstico',
  sin_datos: 'Sin datos',
};

/** Formato compacto de dinero para tarjetas y ejes de gráficos. */
export function fmtUsd(value: number): string {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Formato completo, para tablas y detalles. */
export function fmtUsdFull(value: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

export function fmtDate(value?: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "hace 3 días" — más legible que una fecha en una bandeja de trabajo. */
export function fmtRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  return fmtDate(value);
}
