import { evaluateDiscountApproval, DiscountApprovalItem } from '../src/services/sales/engines/discount-approval.engine';

describe('discount-approval.engine — evaluateDiscountApproval', () => {
  it('no requiere aprobación si el descuento está dentro del tope y el precio cubre el costo', () => {
    const items: DiscountApprovalItem[] = [{ productId: 'p1', quantity: 1, unitPrice: 100, discount: 5, unitCost: 60 }];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.needsApproval).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('marca DISCOUNT_EXCEEDS_CAP cuando el descuento supera el tope del rol', () => {
    const items: DiscountApprovalItem[] = [{ productId: 'p1', quantity: 1, unitPrice: 100, discount: 15, unitCost: 60 }];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.needsApproval).toBe(true);
    expect(result.reasons).toEqual([{ productId: 'p1', reason: 'DISCOUNT_EXCEEDS_CAP', discount: 15, cap: 10 }]);
  });

  it('marca BELOW_COST cuando el precio neto queda por debajo del costo, aunque el descuento esté dentro del tope', () => {
    const items: DiscountApprovalItem[] = [{ productId: 'p1', quantity: 1, unitPrice: 100, discount: 5, unitCost: 96 }];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.needsApproval).toBe(true);
    expect(result.reasons).toEqual([{ productId: 'p1', reason: 'BELOW_COST', netUnitPrice: 95, unitCost: 96 }]);
  });

  it('acumula ambos motivos en items distintos de la misma cotización', () => {
    const items: DiscountApprovalItem[] = [
      { productId: 'p1', quantity: 1, unitPrice: 100, discount: 20, unitCost: 60 },
      { productId: 'p2', quantity: 1, unitPrice: 50, discount: 0, unitCost: 55 },
    ];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.reasons.map((r) => r.reason).sort()).toEqual(['BELOW_COST', 'DISCOUNT_EXCEEDS_CAP']);
  });

  it('ignora la validación de margen si no hay costo conocido (producto nuevo sin movimientos)', () => {
    const items: DiscountApprovalItem[] = [{ productId: 'p1', quantity: 1, unitPrice: 100, discount: 0 }];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.needsApproval).toBe(false);
  });

  it('no dispara BELOW_COST por errores de punto flotante en el límite exacto', () => {
    const items: DiscountApprovalItem[] = [{ productId: 'p1', quantity: 1, unitPrice: 100, discount: 4, unitCost: 96 }];
    const result = evaluateDiscountApproval(items, 10);
    expect(result.needsApproval).toBe(false);
  });
});
