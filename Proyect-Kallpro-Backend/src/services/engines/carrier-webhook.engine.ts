/**
 * Normaliza el webhook de un courier (Servientrega, Tramaco, DHL, Urbano o cualquier otro) al
 * evento de tracking interno. Motor puro. Cada courier nombra distinto los mismos campos y
 * ninguno publica un contrato estable para integradores pequeños, así que en vez de un
 * adaptador rígido por courier se reconoce el campo por una lista amplia de alias (mismo
 * criterio que el parser de extractos bancarios, B2) y el estado por palabras clave.
 */
import type { ShipmentStatus } from '../logistics.service';

export interface NormalizedCarrierEvent {
  reference: string; // guía del courier o tracking interno KP-XXXXXXXX
  status: ShipmentStatus;
  rawStatus: string;
  location?: string;
  notes?: string;
  eventTime?: Date;
}

const REFERENCE_KEYS = ['carrierGuide', 'trackingNumber', 'tracking', 'guia', 'guide', 'numeroGuia', 'numero_guia', 'waybill', 'awb', 'shipmentId', 'reference', 'referencia'];
const STATUS_KEYS = ['status', 'estado', 'event', 'evento', 'eventCode', 'statusCode', 'estadoEnvio', 'description_status'];
const LOCATION_KEYS = ['location', 'ubicacion', 'ciudad', 'city', 'office', 'oficina', 'agencia'];
const NOTES_KEYS = ['notes', 'description', 'descripcion', 'detail', 'detalle', 'message', 'mensaje', 'observacion'];
const TIME_KEYS = ['eventTime', 'timestamp', 'fecha', 'date', 'datetime', 'fechaEvento', 'occurredAt'];

// Orden importa: "NO ENTREGADO" debe evaluarse antes que "ENTREGADO".
const STATUS_RULES: Array<{ status: ShipmentStatus; patterns: RegExp[] }> = [
  { status: 'FAILED', patterns: [/no\s*entreg/i, /fallid/i, /failed/i, /devuelt/i, /return/i, /exception/i, /incidenc/i, /rechaz/i, /ausente/i] },
  { status: 'DELIVERED', patterns: [/entregad/i, /delivered/i, /recibido\s*por/i] },
  { status: 'OUT_FOR_DELIVERY', patterns: [/reparto/i, /out\s*for\s*delivery/i, /en\s*ruta/i, /en\s*distribuci/i, /ultima\s*milla/i, /última\s*milla/i] },
  { status: 'IN_TRANSIT', patterns: [/tr[aá]nsito/i, /transit/i, /en\s*camino/i, /hub/i, /centro\s*de\s*distribuci/i] },
  { status: 'DISPATCHED', patterns: [/despachad/i, /dispatched/i, /shipped/i, /enviad/i, /salida/i] },
  { status: 'PICKED', patterns: [/recolect/i, /picked/i, /retirad/i, /recibido\s*en/i, /admitid/i, /ingresad/i] },
];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const found = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && obj[found] != null && obj[found] !== '') return obj[found];
  }
  return undefined;
}

/** Aplana un nivel: muchos couriers envuelven el evento en { data: {...} } o { shipment: {...} }. */
function flatten(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  for (const wrapper of ['data', 'shipment', 'envio', 'event', 'evento', 'tracking', 'payload']) {
    const inner = payload[wrapper];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      for (const [k, v] of Object.entries(inner as Record<string, unknown>)) if (out[k] == null) out[k] = v;
    }
  }
  return out;
}

export function mapCarrierStatus(raw: string): ShipmentStatus | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const direct = text.toUpperCase().replace(/[\s-]+/g, '_');
  const known: ShipmentStatus[] = ['PENDING', 'PICKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
  if (known.includes(direct as ShipmentStatus)) return direct as ShipmentStatus;
  for (const rule of STATUS_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.status;
  }
  return null;
}

export function normalizeCarrierEvent(payload: unknown): NormalizedCarrierEvent | { error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'El cuerpo del webhook debe ser un objeto JSON' };
  const flat = flatten(payload as Record<string, unknown>);

  const reference = pick(flat, REFERENCE_KEYS);
  if (!reference) return { error: 'El webhook no trae número de guía (guia/trackingNumber/carrierGuide/awb)' };

  const rawStatus = pick(flat, STATUS_KEYS);
  if (!rawStatus) return { error: 'El webhook no trae estado del envío (status/estado/event)' };
  const status = mapCarrierStatus(String(rawStatus));
  if (!status) return { error: `Estado del courier no reconocido: "${String(rawStatus)}"` };

  const time = pick(flat, TIME_KEYS);
  const eventTime = time ? new Date(String(time)) : undefined;

  return {
    reference: String(reference).trim(),
    status,
    rawStatus: String(rawStatus),
    location: pick(flat, LOCATION_KEYS) != null ? String(pick(flat, LOCATION_KEYS)) : undefined,
    notes: pick(flat, NOTES_KEYS) != null ? String(pick(flat, NOTES_KEYS)) : undefined,
    eventTime: eventTime && !Number.isNaN(eventTime.getTime()) ? eventTime : undefined,
  };
}

/** Los couriers reenvían el mismo evento varias veces: si el estado no cambia, no se registra (salvo checkpoints de tránsito). */
export function isDuplicateEvent(currentStatus: string, incoming: ShipmentStatus): boolean {
  return currentStatus === incoming && incoming !== 'IN_TRANSIT';
}
