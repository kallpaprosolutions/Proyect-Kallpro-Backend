import { setup, type StateValue } from 'xstate';

/**
 * Statechart canónico del flujo Purchase-to-Pay de una Orden de Compra.
 *
 * Es la ÚNICA fuente de verdad (en el frontend) de qué acciones son válidas en
 * cada estado. El backend sigue siendo el enforcer autoritativo de las
 * transiciones (ver purchases.service.ts); esta máquina modela el mismo flujo
 * para: (a) gatear botones de acción en la UI de forma consistente, y
 * (b) visualizar el avance. Mantenerla sincronizada con el backend.
 *
 * Modelado con 4 regiones paralelas porque son aspectos concurrentes de la OC:
 *  - lifecycle: borrador → aprobación multinivel → recepción (parcial/total)
 *  - advance:   pago de anticipo (none | pending | paid)
 *  - balance:   pago de saldo (pending | paid) — bloqueado hasta conformidad
 */

export interface PoContext {
  requiredLevels: number;
  currentLevel: number;
  qualityConformity: boolean;
}

export type PoEventType =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'RECEIVE_PARTIAL'
  | 'RECEIVE_ALL'
  | 'PAY_ADVANCE'
  | 'PAY_BALANCE'
  | 'CANCEL';

export type PoEvent = { type: PoEventType };

export const PO_EVENTS: PoEventType[] = [
  'SUBMIT', 'APPROVE', 'REJECT', 'RECEIVE_PARTIAL', 'RECEIVE_ALL', 'PAY_ADVANCE', 'PAY_BALANCE', 'CANCEL',
];

export const purchaseOrderMachine = setup({
  types: {
    context: {} as PoContext,
    events: {} as PoEvent,
    input: {} as Partial<PoContext>,
  },
  guards: {
    // Es el último nivel de aprobación requerido (al aprobar pasa a APPROVED)
    isLastLevel: ({ context }) => context.currentLevel + 1 >= context.requiredLevels,
    notLastLevel: ({ context }) => context.currentLevel + 1 < context.requiredLevels,
    // El saldo solo se puede pagar tras recepción conforme (buen estado)
    isConform: ({ context }) => context.qualityConformity === true,
  },
}).createMachine({
  id: 'purchaseOrder',
  type: 'parallel',
  context: ({ input }) => ({
    requiredLevels: input?.requiredLevels ?? 1,
    currentLevel: input?.currentLevel ?? 0,
    qualityConformity: input?.qualityConformity ?? false,
  }),
  states: {
    lifecycle: {
      initial: 'draft',
      states: {
        draft: { on: { SUBMIT: 'pendingApproval', CANCEL: 'cancelled' } },
        pendingApproval: {
          on: {
            APPROVE: [
              { target: 'approved', guard: 'isLastLevel' },
              { target: 'pendingApproval', guard: 'notLastLevel', reenter: true },
            ],
            REJECT: 'rejected',
            CANCEL: 'cancelled',
          },
        },
        approved: { on: { RECEIVE_PARTIAL: 'partial', RECEIVE_ALL: 'received', CANCEL: 'cancelled' } },
        partial: { on: { RECEIVE_PARTIAL: 'partial', RECEIVE_ALL: 'received' } },
        received: { type: 'final' },
        rejected: { type: 'final' },
        cancelled: { type: 'final' },
      },
    },
    advance: {
      initial: 'none',
      states: {
        none: {},
        pending: { on: { PAY_ADVANCE: 'paid' } },
        paid: { type: 'final' },
      },
    },
    balance: {
      initial: 'pending',
      states: {
        pending: { on: { PAY_BALANCE: { target: 'paid', guard: 'isConform' } } },
        paid: { type: 'final' },
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Resolución desde un registro de OC del backend → estado/contexto de la máquina
// ─────────────────────────────────────────────────────────────────────────────

const LIFECYCLE_FROM_STATUS: Record<string, string> = {
  DRAFT: 'draft',
  SUBMITTED: 'pendingApproval',
  PENDING_L1: 'pendingApproval',
  PENDING_L2: 'pendingApproval',
  PENDING_L3: 'pendingApproval',
  PENDING_L4: 'pendingApproval',
  PENDING_L5: 'pendingApproval',
  APPROVED: 'approved',
  PARTIAL: 'partial',
  RECEIVED: 'received',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

/** Cualquier objeto OC con los campos relevantes del flujo */
export interface PoLike {
  status?: string;
  requiredLevels?: number | null;
  currentLevel?: number | null;
  qualityConformity?: boolean | null;
  advanceStatus?: string | null;
  balanceStatus?: string | null;
}

export function poToValue(o: PoLike): StateValue {
  return {
    lifecycle: LIFECYCLE_FROM_STATUS[o.status ?? 'DRAFT'] ?? 'draft',
    advance: o.advanceStatus === 'PAID' ? 'paid' : o.advanceStatus === 'PENDING' ? 'pending' : 'none',
    balance: o.balanceStatus === 'PAID' ? 'paid' : 'pending',
  };
}

export function poToContext(o: PoLike): PoContext {
  return {
    requiredLevels: Number(o.requiredLevels ?? 1),
    currentLevel: Number(o.currentLevel ?? 0),
    qualityConformity: !!o.qualityConformity,
  };
}

/** Snapshot restaurado (sin actor vivo) para consultar `.can(event)` */
export function snapshotForPo(o: PoLike) {
  return purchaseOrderMachine.resolveState({
    value: poToValue(o),
    context: poToContext(o),
  });
}

/** Conjunto de acciones válidas en el estado actual de la OC, según el statechart */
export function availableActions(o: PoLike): Set<PoEventType> {
  const snap = snapshotForPo(o);
  const set = new Set<PoEventType>();
  for (const type of PO_EVENTS) {
    if (snap.can({ type })) set.add(type);
  }
  return set;
}

export function canDo(o: PoLike, action: PoEventType): boolean {
  return snapshotForPo(o).can({ type: action });
}
