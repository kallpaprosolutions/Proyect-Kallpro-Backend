/**
 * C1 — motor puro de reabastecimiento entre bodegas. Sin BD (regla transversal 6).
 */

import { computeReplenishmentPlan, WarehouseStockRow } from '../src/services/inventory/engines/replenishment.engine';

function row(overrides: Partial<WarehouseStockRow>): WarehouseStockRow {
  return {
    warehouseId: 'w1',
    warehouseName: 'Bodega 1',
    available: 100,
    min: 10,
    max: 200,
    avgDailyConsumption: 1,
    ...overrides,
  };
}

describe('replenishment.engine', () => {
  it('una bodega sobre su mínimo no genera sugerencia', () => {
    const rows = [row({ available: 50, min: 10 })];
    expect(computeReplenishmentPlan(rows)).toEqual([]);
  });

  it('bodega bajo el mínimo, sin ninguna otra bodega con excedente → sugiere PURCHASE por el faltante hasta el máximo', () => {
    const rows = [
      row({ warehouseId: 'a', warehouseName: 'A', available: 5, min: 10, max: 50 }),
      row({ warehouseId: 'b', warehouseName: 'B', available: 20, min: 10, max: 50 }), // no tiene excedente sobre su máximo
    ];
    const plan = computeReplenishmentPlan(rows);
    expect(plan).toHaveLength(1);
    expect(plan[0].warehouseId).toBe('a');
    expect(plan[0].route).toBe('PURCHASE');
    expect(plan[0].transferFromWarehouseId).toBeNull();
    expect(plan[0].needed).toBe(45); // target (max=50) - available (5)
  });

  it('bodega bajo el mínimo, otra bodega con excedente suficiente → sugiere TRANSFER desde esa bodega', () => {
    const rows = [
      row({ warehouseId: 'a', warehouseName: 'A', available: 5, min: 10, max: 50 }),
      row({ warehouseId: 'b', warehouseName: 'B', available: 300, min: 10, max: 100 }), // excedente de 200 sobre su máximo
    ];
    const plan = computeReplenishmentPlan(rows);
    expect(plan).toHaveLength(1);
    expect(plan[0].route).toBe('TRANSFER');
    expect(plan[0].transferFromWarehouseId).toBe('b');
    expect(plan[0].needed).toBe(45);
  });

  it('si ninguna bodega sola cubre el faltante (aunque haya varias con algo de excedente), prefiere PURCHASE', () => {
    const rows = [
      row({ warehouseId: 'a', warehouseName: 'A', available: 5, min: 10, max: 50 }), // faltan 45
      row({ warehouseId: 'b', warehouseName: 'B', available: 60, min: 10, max: 50 }), // excedente de solo 10
      row({ warehouseId: 'c', warehouseName: 'C', available: 55, min: 10, max: 50 }), // excedente de solo 5
    ];
    const plan = computeReplenishmentPlan(rows);
    const a = plan.find((p) => p.warehouseId === 'a')!;
    expect(a.route).toBe('PURCHASE');
  });

  it('elige la bodega donante con MAYOR excedente cuando varias cubren el faltante', () => {
    const rows = [
      row({ warehouseId: 'a', warehouseName: 'A', available: 5, min: 10, max: 50 }), // faltan 45
      row({ warehouseId: 'b', warehouseName: 'B', available: 150, min: 10, max: 100 }), // excedente 50
      row({ warehouseId: 'c', warehouseName: 'C', available: 400, min: 10, max: 100 }), // excedente 300
    ];
    const plan = computeReplenishmentPlan(rows);
    const a = plan.find((p) => p.warehouseId === 'a')!;
    expect(a.route).toBe('TRANSFER');
    expect(a.transferFromWarehouseId).toBe('c');
  });

  it('sin máximo definido, el objetivo de reposición es el propio mínimo y esa bodega nunca es donante', () => {
    const rows = [
      row({ warehouseId: 'a', warehouseName: 'A', available: 2, min: 10, max: null }),
      row({ warehouseId: 'b', warehouseName: 'B', available: 1000, min: 10, max: null }), // sin máximo → no se puede afirmar excedente
    ];
    const plan = computeReplenishmentPlan(rows);
    expect(plan).toHaveLength(1);
    expect(plan[0].warehouseId).toBe('a');
    expect(plan[0].target).toBe(10); // = min, no hay max
    expect(plan[0].needed).toBe(8);
    expect(plan[0].route).toBe('PURCHASE'); // B no puede ser donante sin max definido
  });

  it('urgencia CRITICAL cuando el disponible es 0 o quedan <= 3 días de stock', () => {
    const rows = [row({ warehouseId: 'a', available: 0, min: 10, max: 50, avgDailyConsumption: 1 })];
    expect(computeReplenishmentPlan(rows)[0].urgency).toBe('CRITICAL');

    const rows2 = [row({ warehouseId: 'a', available: 3, min: 10, max: 50, avgDailyConsumption: 1 })];
    expect(computeReplenishmentPlan(rows2)[0].urgency).toBe('CRITICAL');
  });

  it('urgencia HIGH entre 4 y 7 días de stock, o si el disponible es menos de la mitad del mínimo sin consumo', () => {
    const rows = [row({ warehouseId: 'a', available: 5, min: 10, max: 50, avgDailyConsumption: 1 })];
    expect(computeReplenishmentPlan(rows)[0].urgency).toBe('HIGH');

    const rows2 = [row({ warehouseId: 'a', available: 4, min: 10, max: 50, avgDailyConsumption: 0 })];
    expect(computeReplenishmentPlan(rows2)[0].urgency).toBe('HIGH');
  });

  it('urgencia MEDIUM cuando hay más de 7 días de stock', () => {
    const rows = [row({ warehouseId: 'a', available: 9, min: 10, max: 50, avgDailyConsumption: 1 })];
    expect(computeReplenishmentPlan(rows)[0].urgency).toBe('MEDIUM');
  });

  it('ordena las sugerencias por urgencia: CRITICAL antes que HIGH antes que MEDIUM', () => {
    const rows = [
      row({ warehouseId: 'medium', available: 9, min: 10, max: 50, avgDailyConsumption: 1 }),
      row({ warehouseId: 'critical', available: 0, min: 10, max: 50, avgDailyConsumption: 1 }),
      row({ warehouseId: 'high', available: 5, min: 10, max: 50, avgDailyConsumption: 1 }),
    ];
    const plan = computeReplenishmentPlan(rows);
    expect(plan.map((p) => p.warehouseId)).toEqual(['critical', 'high', 'medium']);
  });
});
