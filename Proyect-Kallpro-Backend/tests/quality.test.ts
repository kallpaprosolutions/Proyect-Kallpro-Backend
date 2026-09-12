// Tests de los motores puros de calidad (Sprint 12 — ISO 9001 · ISO 22000 · ARCSA).
import {
  evaluateParameter,
  evaluateInspection,
  buildLotNumber,
  computeExpiryDate,
  checkSanitaryRegistry,
  QualitySpec,
} from '../src/services/quality.service';
import { checkTransition, NcStatus } from '../src/services/nonconformity.service';

const spec = (over: Partial<QualitySpec> = {}): QualitySpec => ({
  id: 'p1', name: 'pH', type: 'NUMERIC', unit: null,
  minValue: null, maxValue: null, expectedText: null, isCritical: false, ...over,
});

describe('evaluateParameter (una medición vs su especificación)', () => {
  it('NUMÉRICO: dentro del rango aprueba', () => {
    const r = evaluateParameter(spec({ minValue: 3, maxValue: 4, unit: 'pH' }), { parameterId: 'p1', valueNumeric: 3.5 });
    expect(r.passed).toBe(true);
    expect(r.reason).toContain('dentro de especificación');
  });

  it('NUMÉRICO: por debajo del mínimo reprueba con el motivo exacto', () => {
    const r = evaluateParameter(spec({ minValue: 3, maxValue: 4 }), { parameterId: 'p1', valueNumeric: 2.1 });
    expect(r.passed).toBe(false);
    expect(r.reason).toContain('por debajo del mínimo');
  });

  it('NUMÉRICO: por encima del máximo reprueba', () => {
    const r = evaluateParameter(spec({ minValue: 3, maxValue: 4 }), { parameterId: 'p1', valueNumeric: 9 });
    expect(r.passed).toBe(false);
    expect(r.reason).toContain('supera el máximo');
  });

  it('NUMÉRICO: los límites son inclusivos', () => {
    const s = spec({ minValue: 3, maxValue: 4 });
    expect(evaluateParameter(s, { parameterId: 'p1', valueNumeric: 3 }).passed).toBe(true);
    expect(evaluateParameter(s, { parameterId: 'p1', valueNumeric: 4 }).passed).toBe(true);
  });

  it('sin medición SIEMPRE reprueba (no verificado ≠ conforme, ISO 9001 §8.6)', () => {
    expect(evaluateParameter(spec({ minValue: 3 }), undefined).passed).toBe(false);
    expect(evaluateParameter(spec({ minValue: 3 }), { parameterId: 'p1', valueNumeric: null }).reason).toBe('Sin medición registrada');
  });

  it('BOOLEANO: espera cumplimiento por defecto', () => {
    const s = spec({ type: 'BOOLEAN', name: 'Envase íntegro' });
    expect(evaluateParameter(s, { parameterId: 'p1', valueBoolean: true }).passed).toBe(true);
    expect(evaluateParameter(s, { parameterId: 'p1', valueBoolean: false }).passed).toBe(false);
  });

  it('BOOLEANO: expectedText "false" invierte el criterio (ej. ausencia de patógeno)', () => {
    const s = spec({ type: 'BOOLEAN', name: 'Presencia de E. coli', expectedText: 'false' });
    expect(evaluateParameter(s, { parameterId: 'p1', valueBoolean: false }).passed).toBe(true);
    const fail = evaluateParameter(s, { parameterId: 'p1', valueBoolean: true });
    expect(fail.passed).toBe(false);
    expect(fail.reason).toContain('Presente cuando debía estar ausente');
  });

  it('TEXTO: compara sin distinguir mayúsculas ni espacios', () => {
    const s = spec({ type: 'TEXT', name: 'Color', expectedText: 'Ámbar' });
    expect(evaluateParameter(s, { parameterId: 'p1', valueText: '  ámbar ' }).passed).toBe(true);
    expect(evaluateParameter(s, { parameterId: 'p1', valueText: 'verde' }).passed).toBe(false);
  });

  it('TEXTO sin valor esperado: basta con dejar constancia', () => {
    const s = spec({ type: 'TEXT', name: 'Observación' });
    expect(evaluateParameter(s, { parameterId: 'p1', valueText: 'lote uniforme' }).passed).toBe(true);
    expect(evaluateParameter(s, { parameterId: 'p1', valueText: '   ' }).passed).toBe(false);
  });
});

describe('evaluateInspection (lote completo)', () => {
  const specs: QualitySpec[] = [
    spec({ id: 'a', name: 'pH', minValue: 3, maxValue: 4 }),
    spec({ id: 'b', name: 'Humedad', minValue: 0, maxValue: 12, unit: '%' }),
    spec({ id: 'c', name: 'Ausencia de Salmonella', type: 'BOOLEAN', expectedText: 'false', isCritical: true }),
  ];

  it('todo conforme => PASSED', () => {
    const r = evaluateInspection(specs, [
      { parameterId: 'a', valueNumeric: 3.5 },
      { parameterId: 'b', valueNumeric: 10 },
      { parameterId: 'c', valueBoolean: false },
    ]);
    expect(r.status).toBe('PASSED');
    expect(r.failedCount).toBe(0);
    expect(r.totalCount).toBe(3);
    expect(r.criticalFailures).toHaveLength(0);
  });

  it('un parámetro no crítico fuera de rango también reprueba el lote', () => {
    const r = evaluateInspection(specs, [
      { parameterId: 'a', valueNumeric: 9 },
      { parameterId: 'b', valueNumeric: 10 },
      { parameterId: 'c', valueBoolean: false },
    ]);
    expect(r.status).toBe('FAILED');
    expect(r.failedCount).toBe(1);
    expect(r.criticalFailures).toHaveLength(0);
  });

  it('reporta aparte los PCC fallidos (HACCP / ISO 22000)', () => {
    const r = evaluateInspection(specs, [
      { parameterId: 'a', valueNumeric: 3.5 },
      { parameterId: 'b', valueNumeric: 10 },
      { parameterId: 'c', valueBoolean: true },
    ]);
    expect(r.status).toBe('FAILED');
    expect(r.criticalFailures).toEqual(['Ausencia de Salmonella']);
  });

  it('faltan mediciones => reprueba y las cuenta', () => {
    const r = evaluateInspection(specs, [{ parameterId: 'a', valueNumeric: 3.5 }]);
    expect(r.status).toBe('FAILED');
    expect(r.failedCount).toBe(2);
  });
});

describe('lote y vigencia sanitaria (ARCSA)', () => {
  it('el número de lote incluye la fecha y el correlativo de la orden', () => {
    expect(buildLotNumber('PROD-0007', new Date(2026, 6, 23))).toBe('LOTE-20260723-0007');
  });

  it('el vencimiento se calcula con la vida útil del producto', () => {
    const exp = computeExpiryDate(new Date(2026, 0, 1), 30);
    expect(exp?.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('sin vida útil no hay fecha de vencimiento', () => {
    expect(computeExpiryDate(new Date(), null)).toBeNull();
    expect(computeExpiryDate(new Date(), 0)).toBeNull();
  });

  it('registro sanitario vencido se marca como no conforme', () => {
    const r = checkSanitaryRegistry('ARCSA-123', new Date(2026, 0, 1), new Date(2026, 5, 1));
    expect(r.ok).toBe(false);
    expect(r.level).toBe('EXPIRED');
    expect(r.message).toContain('VENCIDO');
  });

  it('avisa cuando el registro está por vencer (≤60 días)', () => {
    const r = checkSanitaryRegistry('ARCSA-123', new Date(2026, 6, 31), new Date(2026, 6, 1));
    expect(r.level).toBe('EXPIRING');
    expect(r.ok).toBe(true);
  });

  it('producto sin registro declarado: avisa pero no bloquea', () => {
    const r = checkSanitaryRegistry(null, null);
    expect(r.level).toBe('MISSING');
    expect(r.ok).toBe(true);
  });
});

describe('checkTransition (ciclo CAPA — ISO 9001 §8.7 y §10.2)', () => {
  const step = (current: NcStatus, next: Parameters<typeof checkTransition>[1]) => checkTransition(current, next);

  it('exige disposición del producto para empezar el tratamiento (§8.7)', () => {
    expect(step('OPEN', { status: 'IN_PROGRESS' })).toContain('disposición');
    expect(step('OPEN', { status: 'IN_PROGRESS', disposition: 'REWORK' })).toBeNull();
  });

  it('exige causa raíz y acción correctiva antes de verificar (§10.2)', () => {
    expect(step('IN_PROGRESS', { status: 'VERIFICATION' })).toContain('causa raíz');
    expect(step('IN_PROGRESS', { status: 'VERIFICATION', rootCause: 'Calibración vencida' })).toContain('acción correctiva');
    expect(step('IN_PROGRESS', {
      status: 'VERIFICATION', rootCause: 'Calibración vencida', correctiveAction: 'Recalibrar balanza',
    })).toBeNull();
  });

  it('no permite cerrar sin verificación de eficacia (§10.2)', () => {
    expect(step('VERIFICATION', { status: 'CLOSED' })).toContain('eficacia');
    expect(step('VERIFICATION', { status: 'CLOSED', effectivenessCheck: '3 lotes conformes' })).toBeNull();
  });

  it('no permite saltarse etapas', () => {
    expect(step('OPEN', { status: 'CLOSED', effectivenessCheck: 'ok' })).toContain('saltar etapas');
  });

  it('una no conformidad cerrada no se reabre', () => {
    expect(step('CLOSED', { status: 'OPEN' })).toContain('no se reabre');
  });
});
