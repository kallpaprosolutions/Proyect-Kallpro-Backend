type BadgeVariant = { bg: string; text: string; border?: string; dot?: string };

const badge = (bg: string, text: string, border?: string, dot?: string): BadgeVariant =>
  ({ bg, text, border, dot });

// ─── Colores semánticos reutilizables ──────────────────────────────────────────

const SEMANTIC: Record<string, BadgeVariant> = {
  draft:     badge('bg-surface-100 dark:bg-surface-700', 'text-surface-500 dark:text-surface-400', 'border-surface-300 dark:border-surface-600'),
  info:      badge('bg-blue-100 dark:bg-blue-500/20', 'text-blue-700 dark:text-blue-400', 'border-blue-300 dark:border-blue-800'),
  warning:   badge('bg-amber-100 dark:bg-amber-500/20', 'text-amber-700 dark:text-amber-400', 'border-amber-300 dark:border-amber-800'),
  success:   badge('bg-green-100 dark:bg-green-900/40', 'text-green-700 dark:text-green-400', 'border-green-300 dark:border-green-800', 'bg-green-500'),
  danger:    badge('bg-red-100 dark:bg-red-900/40', 'text-red-700 dark:text-red-400', 'border-red-300 dark:border-red-800'),
  purple:    badge('bg-purple-100 dark:bg-purple-500/20', 'text-purple-700 dark:text-purple-400', 'border-purple-300 dark:border-purple-800'),
  indigo:    badge('bg-indigo-100 dark:bg-indigo-500/20', 'text-indigo-700 dark:text-indigo-400', 'border-indigo-300 dark:border-indigo-800'),
  cyan:      badge('bg-cyan-100 dark:bg-cyan-500/20', 'text-cyan-700 dark:text-cyan-400', 'border-cyan-300 dark:border-cyan-800'),
  pink:      badge('bg-pink-100 dark:bg-pink-500/20', 'text-pink-700 dark:text-pink-400', 'border-pink-300 dark:border-pink-800'),
  orange:    badge('bg-orange-100 dark:bg-orange-500/20', 'text-orange-700 dark:text-orange-400', 'border-orange-300 dark:border-orange-800'),
};

// ─── Órdenes de Compra ─────────────────────────────────────────────────────────

export const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', SENT: 'Enviada',
  PARTIAL: 'Parcial', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
};
export const PO_STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: SEMANTIC.draft, APPROVED: SEMANTIC.info, SENT: SEMANTIC.cyan,
  PARTIAL: SEMANTIC.warning, RECEIVED: SEMANTIC.success, CANCELLED: SEMANTIC.danger,
};

// ─── Requisiciones ─────────────────────────────────────────────────────────────

export const REQ_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_L1: 'Pendiente L1', PENDING_L2: 'Pendiente L2',
  PENDING_L3: 'Pendiente Gerencia', APPROVED: 'Aprobada', QUOTED: 'En Cotización',
  PO_CREATED: 'OC Generada', REJECTED: 'Rechazada',
};
export const REQ_STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: SEMANTIC.draft, PENDING_L1: SEMANTIC.info, PENDING_L2: SEMANTIC.indigo,
  PENDING_L3: SEMANTIC.purple, APPROVED: SEMANTIC.success, QUOTED: SEMANTIC.cyan,
  PO_CREATED: SEMANTIC.success, REJECTED: SEMANTIC.danger,
};

// ─── Ventas ────────────────────────────────────────────────────────────────────

export const SALES_STATUS_LABELS: Record<string, string> = {
  QUOTATION: 'Cotización', CONFIRMED: 'Confirmado', DISPATCHED: 'Despachado',
  INVOICED: 'Facturado', CANCELLED: 'Cancelado',
};
export const SALES_STATUS_BADGE: Record<string, BadgeVariant> = {
  QUOTATION: SEMANTIC.draft, CONFIRMED: SEMANTIC.info, DISPATCHED: SEMANTIC.cyan,
  INVOICED: SEMANTIC.success, CANCELLED: SEMANTIC.danger,
};

// ─── Facturas ──────────────────────────────────────────────────────────────────

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', POSTED: 'Contabilizada', PAID: 'Pagada',
  PARTIAL: 'Pago parcial', CANCELLED: 'Anulada',
};
export const INVOICE_STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: SEMANTIC.draft, POSTED: SEMANTIC.info, PAID: SEMANTIC.success,
  PARTIAL: SEMANTIC.warning, CANCELLED: SEMANTIC.danger,
};

// ─── Asientos contables ────────────────────────────────────────────────────────

export const JOURNAL_STATUS_LABELS: Record<string, string> = {
  POSTED: 'Contabilizado', DRAFT: 'Borrador', REVERSED: 'Reversado',
};
export const JOURNAL_STATUS_BADGE: Record<string, BadgeVariant> = {
  POSTED: SEMANTIC.success, DRAFT: SEMANTIC.draft, REVERSED: SEMANTIC.danger,
};

// ─── Producción ────────────────────────────────────────────────────────────────

export const PROD_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planificada', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};
export const PROD_STATUS_BADGE: Record<string, BadgeVariant> = {
  PLANNED: SEMANTIC.draft, IN_PROGRESS: SEMANTIC.info,
  COMPLETED: SEMANTIC.success, CANCELLED: SEMANTIC.danger,
};

// ─── Helper: genera className completo para un badge ───────────────────────────

export function statusBadgeClass(v: BadgeVariant | undefined): string {
  if (!v) return `${SEMANTIC.draft.bg} ${SEMANTIC.draft.text}`;
  const parts = [v.bg, v.text];
  if (v.border) parts.push('border', v.border);
  return parts.join(' ');
}

export { SEMANTIC as SEMANTIC_BADGES };
