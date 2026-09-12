/**
 * Motor de reabastecimiento entre bodegas (C1) — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Push/pull simplificado: para cada producto-bodega bajo su mínimo, primero busca si OTRA
 * bodega de la misma empresa tiene excedente suficiente sobre su propio máximo (push interno
 * — mover stock ocioso en vez de comprar de más); si ninguna bodega sola cubre el faltante,
 * sugiere una requisición de compra por la cantidad exacta que falta para llegar al objetivo.
 *
 * Deliberadamente NO reparte el faltante entre varios donantes a la vez (eso complicaría la
 * UI a "N traslados + 1 compra" por fila) — si el excedente está repartido en varias bodegas
 * pequeñas, se prefiere comprar. Esto es el mismo criterio de "ruta preferida" única que usa
 * Odoo (Comprar | Trasladar), no una optimización de reparto.
 */

export interface WarehouseStockRow {
  warehouseId: string;
  warehouseName: string;
  available: number; // quantity - reserved
  min: number;
  max: number | null;
  avgDailyConsumption: number; // consumo diario promedio en ESA bodega (para pronóstico/urgencia)
}

export type ReplenishmentUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type ReplenishmentRoute = 'TRANSFER' | 'PURCHASE';

export interface ReplenishmentSuggestion {
  warehouseId: string;
  warehouseName: string;
  available: number;
  min: number;
  max: number | null;
  target: number; // nivel objetivo al que se repone (max si existe, si no min)
  needed: number; // target - available, siempre > 0
  route: ReplenishmentRoute;
  transferFromWarehouseId: string | null;
  transferFromWarehouseName: string | null;
  daysOfStock: number; // available / avgDailyConsumption; 9999 si no hay consumo
  urgency: ReplenishmentUrgency;
}

/** Nivel objetivo de reposición: el máximo si está definido, si no el propio mínimo. */
function targetLevel(row: WarehouseStockRow): number {
  return row.max ?? row.min;
}

/** Excedente de una bodega sobre su propio máximo (0 si no tiene máximo definido — no se puede afirmar que sobra). */
function surplus(row: WarehouseStockRow): number {
  if (row.max == null) return 0;
  return Math.max(0, row.available - row.max);
}

function computeUrgency(available: number, min: number, daysOfStock: number): ReplenishmentUrgency {
  if (available <= 0 || daysOfStock <= 3) return 'CRITICAL';
  if (daysOfStock <= 7) return 'HIGH';
  if (available < min * 0.5) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Calcula las sugerencias de reabastecimiento para UN producto a partir del estado de todas
 * sus bodegas. Solo devuelve filas que están por debajo de su mínimo.
 */
export function computeReplenishmentPlan(rows: WarehouseStockRow[]): ReplenishmentSuggestion[] {
  const suggestions: ReplenishmentSuggestion[] = [];

  for (const row of rows) {
    if (row.available >= row.min) continue; // esta bodega no necesita reponer

    const target = targetLevel(row);
    const needed = Math.round((target - row.available) * 100) / 100;
    if (needed <= 0) continue;

    // Buscar la bodega donante con MAYOR excedente que sola cubra todo el faltante.
    const donors = rows
      .filter((r) => r.warehouseId !== row.warehouseId)
      .map((r) => ({ row: r, surplus: surplus(r) }))
      .filter((d) => d.surplus >= needed)
      .sort((a, b) => b.surplus - a.surplus);

    const donor = donors[0];

    const daysOfStock = row.avgDailyConsumption > 0
      ? Math.round((row.available / row.avgDailyConsumption) * 10) / 10
      : 9999;

    suggestions.push({
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      available: row.available,
      min: row.min,
      max: row.max,
      target,
      needed,
      route: donor ? 'TRANSFER' : 'PURCHASE',
      transferFromWarehouseId: donor ? donor.row.warehouseId : null,
      transferFromWarehouseName: donor ? donor.row.warehouseName : null,
      daysOfStock,
      urgency: computeUrgency(row.available, row.min, daysOfStock),
    });
  }

  const order: Record<ReplenishmentUrgency, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  return suggestions.sort((a, b) => order[a.urgency] - order[b.urgency]);
}
