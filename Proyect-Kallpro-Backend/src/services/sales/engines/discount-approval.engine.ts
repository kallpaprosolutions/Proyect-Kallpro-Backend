// Motor PURO (regla 6): decide si una cotización/pedido necesita aprobación gerencial
// ANTES de crearse, en vez del bloqueo duro que existía (DISCOUNT_EXCEEDS_ROLE_CAP tiraba
// error 400 y el vendedor no podía ni guardar el borrador). Dos motivos independientes:
//   1. Descuento por encima del tope de su rol (ya existía el tope, faltaba la vía de escape).
//   2. Precio de venta por debajo del costo del producto (protección de margen: KallpaPro
//      detecta esto automáticamente donde Odoo no hace nada — regla de negocio nueva).
export interface DiscountApprovalItem {
  productId: string;
  quantity: number;
  unitPrice: number; // precio ya resuelto de la lista, antes de descuento
  discount: number;  // 0-100
  unitCost?: number; // avgCost del producto; undefined = sin dato, no se evalúa margen
}

export interface ApprovalReason {
  productId: string;
  reason: 'DISCOUNT_EXCEEDS_CAP' | 'BELOW_COST';
  discount?: number;
  cap?: number;
  netUnitPrice?: number;
  unitCost?: number;
}

export interface DiscountApprovalResult {
  needsApproval: boolean;
  reasons: ApprovalReason[];
}

export function evaluateDiscountApproval(items: DiscountApprovalItem[], discountCap: number): DiscountApprovalResult {
  const reasons: ApprovalReason[] = [];
  for (const item of items) {
    const discount = item.discount ?? 0;
    if (discount > discountCap + 1e-9) {
      reasons.push({ productId: item.productId, reason: 'DISCOUNT_EXCEEDS_CAP', discount, cap: discountCap });
    }
    const netUnitPrice = item.unitPrice * (1 - discount / 100);
    if (item.unitCost != null && item.unitCost > 0 && netUnitPrice < item.unitCost - 1e-9) {
      reasons.push({ productId: item.productId, reason: 'BELOW_COST', netUnitPrice, unitCost: item.unitCost });
    }
  }
  return { needsApproval: reasons.length > 0, reasons };
}
