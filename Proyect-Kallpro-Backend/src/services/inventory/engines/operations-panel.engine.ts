/**
 * Clasificación de expediciones para el Panel de Operaciones (C2) — PURA (sin BD). Regla
 * transversal 6. Separada del conteo/agregación (que sí toca BD, en inventory.service.ts)
 * para poder testear la clasificación sin fixtures de Prisma.
 */

export type ShipmentBucket = 'EN_ESPERA' | 'POR_ENTREGAR' | 'ENTREGADO' | 'FALLIDO';

const WAITING_STATUSES = new Set(['PENDING', 'PICKED']);
const IN_TRANSIT_STATUSES = new Set(['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);

/** Bucket de una expedición según su estado (ignora la fecha estimada — eso es "con demora", ortogonal). */
export function classifyShipmentBucket(status: string): ShipmentBucket {
  if (status === 'DELIVERED') return 'ENTREGADO';
  if (status === 'FAILED') return 'FALLIDO';
  if (WAITING_STATUSES.has(status)) return 'EN_ESPERA';
  if (IN_TRANSIT_STATUSES.has(status)) return 'POR_ENTREGAR';
  return 'EN_ESPERA'; // estado desconocido: tratar como pendiente, nunca ocultarlo del panel
}

/** Una expedición está "con demora" si pasó su fecha estimada y todavía no llegó a un estado final. */
export function isShipmentDelayed(status: string, estimatedDelivery: Date | null, now: Date): boolean {
  if (!estimatedDelivery) return false;
  if (status === 'DELIVERED' || status === 'FAILED') return false;
  return estimatedDelivery.getTime() < now.getTime();
}

export interface OperationsPanelWarehouse {
  warehouseId: string;
  warehouseName: string;
  recepcionesPendientes: number;
  expediciones: { enEspera: number; porEntregar: number; conDemora: number; parciales: number };
  traslados: { entrantesHoy: number; salientesHoy: number };
}
