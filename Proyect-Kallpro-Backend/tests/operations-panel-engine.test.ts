/**
 * C2 — clasificación pura de expediciones para el panel de operaciones. Sin BD (regla 6).
 */

import { classifyShipmentBucket, isShipmentDelayed } from '../src/services/inventory/engines/operations-panel.engine';

describe('operations-panel.engine — classifyShipmentBucket', () => {
  it('PENDING y PICKED son EN_ESPERA', () => {
    expect(classifyShipmentBucket('PENDING')).toBe('EN_ESPERA');
    expect(classifyShipmentBucket('PICKED')).toBe('EN_ESPERA');
  });

  it('DISPATCHED, IN_TRANSIT y OUT_FOR_DELIVERY son POR_ENTREGAR', () => {
    expect(classifyShipmentBucket('DISPATCHED')).toBe('POR_ENTREGAR');
    expect(classifyShipmentBucket('IN_TRANSIT')).toBe('POR_ENTREGAR');
    expect(classifyShipmentBucket('OUT_FOR_DELIVERY')).toBe('POR_ENTREGAR');
  });

  it('DELIVERED y FAILED tienen su propio bucket', () => {
    expect(classifyShipmentBucket('DELIVERED')).toBe('ENTREGADO');
    expect(classifyShipmentBucket('FAILED')).toBe('FALLIDO');
  });

  it('un estado desconocido cae en EN_ESPERA para no desaparecer del panel', () => {
    expect(classifyShipmentBucket('ALGO_NUEVO')).toBe('EN_ESPERA');
  });
});

describe('operations-panel.engine — isShipmentDelayed', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('sin fecha estimada nunca está con demora', () => {
    expect(isShipmentDelayed('IN_TRANSIT', null, now)).toBe(false);
  });

  it('fecha estimada pasada y estado no final → con demora', () => {
    expect(isShipmentDelayed('IN_TRANSIT', new Date('2026-09-04T12:00:00Z'), now)).toBe(true);
  });

  it('fecha estimada futura → no está con demora', () => {
    expect(isShipmentDelayed('IN_TRANSIT', new Date('2026-09-06T12:00:00Z'), now)).toBe(false);
  });

  it('ya entregado o fallido nunca cuenta como demora aunque pasó la fecha', () => {
    expect(isShipmentDelayed('DELIVERED', new Date('2026-09-01T12:00:00Z'), now)).toBe(false);
    expect(isShipmentDelayed('FAILED', new Date('2026-09-01T12:00:00Z'), now)).toBe(false);
  });
});
