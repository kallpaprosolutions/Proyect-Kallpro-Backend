import { AppError } from '../utils/errors';

// ============================================================
// APROBACIONES POR MONTO (roadmap Asistente Contable CxP/CxC — Fase 4)
// ============================================================
// Cierra una brecha real: hoy pagar/cobrar/ajustar en CxP-CxC solo exige el permiso plano
// `postManual` (ADMIN, CONTADOR, ASISTENTE_CONTABLE) sin importar el monto — el mismo
// asistente contable puede pagar $50 o $50.000. Esto agrega un segundo filtro, por monto,
// server-side (no solo ocultar el botón en el frontend, que es fácil de saltar).

export const APPROVAL_TIERS = ['AUTO', 'RESPONSABLE', 'GERENCIAL'] as const;
export type ApprovalTier = (typeof APPROVAL_TIERS)[number];

export interface PaymentApprovalLimits {
  paymentResponsableLimit: number;
  paymentGerencialLimit: number;
}

/** Motor PURO: qué nivel de aprobación exige un monto, según los límites configurados. */
export function requiredApprovalTier(amount: number, limits: PaymentApprovalLimits): ApprovalTier {
  if (amount >= limits.paymentGerencialLimit) return 'GERENCIAL';
  if (amount >= limits.paymentResponsableLimit) return 'RESPONSABLE';
  return 'AUTO';
}

/** Roles habilitados para cada nivel — ADMIN siempre puede, los demás escalan hacia arriba. */
const TIER_ROLES: Record<ApprovalTier, readonly string[]> = {
  AUTO: ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE'],
  RESPONSABLE: ['ADMIN', 'GERENTE', 'CONTADOR'],
  GERENCIAL: ['ADMIN', 'GERENTE'],
};

const TIER_LABEL: Record<ApprovalTier, string> = {
  AUTO: 'permiso de pagos',
  RESPONSABLE: 'aprobación del responsable de cuentas (Contador o Admin)',
  GERENCIAL: 'aprobación gerencial (Gerente o Admin)',
};

/** Motor PURO: ¿este rol puede ejecutar una acción de este nivel? */
export function roleCanApproveTier(role: string | null | undefined, tier: ApprovalTier): boolean {
  if (!role) return false;
  return TIER_ROLES[tier].includes(role);
}

/**
 * Verifica que quien ejecuta un pago/cobro/ajuste tenga el nivel requerido por el monto.
 * Lanza `AppError.forbidden` con el nivel y los roles habilitados si no — pensado para
 * llamarse desde el servicio justo antes de mover dinero (payPayable, collectReceivable,
 * writeOffPayable, writeOffReceivable), no solo para condicionar un botón en la UI.
 */
export function assertCanExecutePayment(amount: number, role: string | null | undefined, limits: PaymentApprovalLimits): void {
  const tier = requiredApprovalTier(amount, limits);
  if (roleCanApproveTier(role, tier)) return;
  throw AppError.forbidden(
    `Este monto ($${amount.toFixed(2)}) requiere ${TIER_LABEL[tier]}`,
    'PAYMENT_APPROVAL_REQUIRED',
    { tier, requiredRoles: TIER_ROLES[tier] },
  );
}
