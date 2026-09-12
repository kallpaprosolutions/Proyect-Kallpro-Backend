import { pickCustomerMatch, buildCustomerDraft, buildQuotationItems } from '../src/services/crm/engines/deal-conversion.engine';
import { planDunning, renderDunningMessage, DEFAULT_DUNNING_STEPS } from '../src/services/finance/engines/dunning.engine';
import { normalizeCarrierEvent, mapCarrierStatus, isDuplicateEvent } from '../src/services/engines/carrier-webhook.engine';
import { computeUtilidades, daysWorkedInYear } from '../src/services/payroll/engines/utilidades.engine';
import { buildPermissionMatrix } from '../src/auth/permissions-matrix';

describe('deal-conversion.engine', () => {
  const candidates = [
    { id: 'c1', ruc: '1791234567001', email: 'pagos@acme.ec', name: 'ACME', razonSocial: 'ACME S.A.' },
    { id: 'c2', ruc: null, email: 'juan@mail.com', name: 'Juan Pérez' },
  ];
  it('empareja por RUC antes que por email', () => {
    expect(pickCustomerMatch(candidates, { ruc: '1791234567001', legalName: 'OTRO' }, { firstName: 'X', email: 'juan@mail.com' })).toBe('c1');
  });
  it('empareja por email del contacto si no hay RUC', () => {
    expect(pickCustomerMatch(candidates, null, { firstName: 'Juan', email: 'JUAN@mail.com' })).toBe('c2');
  });
  it('empareja por razón social exacta (case-insensitive)', () => {
    expect(pickCustomerMatch(candidates, { legalName: 'acme s.a.' }, null)).toBe('c1');
  });
  it('no empareja por nombre parecido → null (se creará cliente nuevo)', () => {
    expect(pickCustomerMatch(candidates, { legalName: 'ACME Comercial' }, null)).toBeNull();
  });
  it('arma el borrador del cliente desde la empresa CRM (RUC → documentType RUC, JURIDICA)', () => {
    const d = buildCustomerDraft({ ruc: '1791234567001', legalName: 'ACME S.A.', tradeName: 'Acme', city: 'Quito' }, { firstName: 'Ana', email: 'ana@acme.ec' });
    expect(d).toMatchObject({ name: 'Acme', razonSocial: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC', personType: 'JURIDICA', email: 'ana@acme.ec', city: 'Quito' });
  });
  it('sin empresa usa el nombre del contacto como persona natural', () => {
    expect(buildCustomerDraft(null, { firstName: 'Juan', lastName: 'Pérez' })).toMatchObject({ name: 'Juan Pérez', personType: 'NATURAL', ruc: null });
  });
  it('sin productos bloquea con mensaje claro', () => {
    expect(() => buildQuotationItems([])).toThrow(/no tiene productos/);
  });
  it('valida cantidad > 0 y precio >= 0', () => {
    expect(() => buildQuotationItems([{ productId: 'p', quantity: 0, unitPrice: 1 }])).toThrow(/cantidad/);
    expect(() => buildQuotationItems([{ productId: 'p', quantity: 1, unitPrice: -1 }])).toThrow(/negativo/);
    expect(buildQuotationItems([{ productId: 'p', quantity: 2, unitPrice: 10 }])[0]).toMatchObject({ productId: 'p', quantity: 2, unitPrice: 10, discount: 0 });
  });
});

describe('dunning.engine', () => {
  const steps = DEFAULT_DUNNING_STEPS; // 3 / 15 / 30 días
  const inv = (over: Partial<Parameters<typeof planDunning>[0][number]>) => ({
    invoiceId: 'i1', customerId: 'c1', number: 'FAC-V-0001', daysOverdue: 5, balance: 100, firedSteps: [], hasActivePromise: false, ...over,
  });
  it('dispara el escalón 0 a los 5 días de mora', () => {
    expect(planDunning([inv({})], steps, { pauseWhenPromise: true })).toEqual([expect.objectContaining({ stepIndex: 0 })]);
  });
  it('no repite un escalón ya disparado', () => {
    expect(planDunning([inv({ firedSteps: [0] })], steps, { pauseWhenPromise: true })).toEqual([]);
  });
  it('factura que entra con 40 días de mora dispara SOLO el escalón más alto (no los tres)', () => {
    const plan = planDunning([inv({ daysOverdue: 40 })], steps, { pauseWhenPromise: true });
    expect(plan).toHaveLength(1);
    expect(plan[0].stepIndex).toBe(2);
  });
  it('una promesa de pago vigente pausa los recordatorios', () => {
    expect(planDunning([inv({ hasActivePromise: true })], steps, { pauseWhenPromise: true })).toEqual([]);
    expect(planDunning([inv({ hasActivePromise: true })], steps, { pauseWhenPromise: false })).toHaveLength(1);
  });
  it('sin mora o sin saldo no hay acción', () => {
    expect(planDunning([inv({ daysOverdue: 0 }), inv({ balance: 0 })], steps, { pauseWhenPromise: true })).toEqual([]);
  });
  it('renderiza la plantilla con las variables', () => {
    expect(renderDunningMessage('Hola {{cliente}}, factura {{factura}} por ${{saldo}}', { cliente: 'ACME', factura: 'F-1', saldo: '10.00' })).toBe('Hola ACME, factura F-1 por $10.00');
  });
});

describe('carrier-webhook.engine', () => {
  it('normaliza un payload estilo Servientrega (guia/estado/ciudad)', () => {
    const r = normalizeCarrierEvent({ guia: 'SRV123', estado: 'EN TRANSITO', ciudad: 'Guayaquil', fecha: '2026-09-11T10:00:00Z' });
    expect(r).toMatchObject({ reference: 'SRV123', status: 'IN_TRANSIT', location: 'Guayaquil' });
    expect((r as any).eventTime.toISOString()).toBe('2026-09-11T10:00:00.000Z');
  });
  it('normaliza un payload envuelto en data (estilo DHL/Urbano en inglés)', () => {
    const r = normalizeCarrierEvent({ data: { awb: 'DHL999', status: 'Delivered', description: 'Signed by client' } });
    expect(r).toMatchObject({ reference: 'DHL999', status: 'DELIVERED', notes: 'Signed by client' });
  });
  it('"NO ENTREGADO" es FAILED, no DELIVERED (orden de reglas)', () => {
    expect(mapCarrierStatus('NO ENTREGADO - destinatario ausente')).toBe('FAILED');
    expect(mapCarrierStatus('Entregado')).toBe('DELIVERED');
    expect(mapCarrierStatus('En reparto')).toBe('OUT_FOR_DELIVERY');
    expect(mapCarrierStatus('OUT_FOR_DELIVERY')).toBe('OUT_FOR_DELIVERY');
  });
  it('rechaza payloads sin guía o con estado desconocido', () => {
    expect(normalizeCarrierEvent({ estado: 'X' })).toEqual({ error: expect.stringMatching(/guía/) });
    expect(normalizeCarrierEvent({ guia: 'A', estado: 'zzz' })).toEqual({ error: expect.stringMatching(/no reconocido/) });
    expect(normalizeCarrierEvent('nope')).toEqual({ error: expect.stringMatching(/objeto/) });
  });
  it('un evento repetido no se registra, salvo checkpoints de tránsito', () => {
    expect(isDuplicateEvent('DELIVERED', 'DELIVERED')).toBe(true);
    expect(isDuplicateEvent('IN_TRANSIT', 'IN_TRANSIT')).toBe(false);
  });
});

describe('utilidades.engine (15% — art. 97 Código del Trabajo)', () => {
  const y = 2025;
  it('días trabajados: año completo = 365, ingreso a mitad de año se prorratea', () => {
    expect(daysWorkedInYear(new Date('2020-01-01'), null, y)).toBe(365);
    expect(daysWorkedInYear(new Date('2025-07-01'), null, y)).toBe(184);
    expect(daysWorkedInYear(new Date('2026-01-01'), null, y)).toBe(0);
  });
  it('10% por tiempo se reparte por igual entre trabajadores de año completo', () => {
    const r = computeUtilidades({ year: y, utilidadLiquida: 100_000, sbu: 482, workers: [
      { employeeId: 'a', name: 'A', hireDate: new Date('2020-01-01'), familyBurdens: 0 },
      { employeeId: 'b', name: 'B', hireDate: new Date('2020-01-01'), familyBurdens: 0 },
    ] });
    expect(r.participacionTotal).toBe(15_000);
    expect(r.lines.map((l) => l.porTiempo)).toEqual([5_000, 5_000]);
    expect(r.lines.every((l) => l.porCargas === 0)).toBe(true); // nadie tiene cargas → el 5% no se reparte
  });
  it('5% por cargas va solo a quien tiene cargas, ponderado por tiempo', () => {
    const r = computeUtilidades({ year: y, utilidadLiquida: 100_000, sbu: 482, workers: [
      { employeeId: 'a', name: 'A', hireDate: new Date('2020-01-01'), familyBurdens: 2 },
      { employeeId: 'b', name: 'B', hireDate: new Date('2020-01-01'), familyBurdens: 0 },
    ] });
    expect(r.lines[0].porCargas).toBe(5_000);
    expect(r.lines[1].porCargas).toBe(0);
    expect(r.lines[0].bruto).toBe(10_000);
  });
  it('aplica el tope de 24 SBU y reporta el excedente para el IESS', () => {
    const r = computeUtilidades({ year: y, utilidadLiquida: 1_000_000, sbu: 482, workers: [
      { employeeId: 'a', name: 'A', hireDate: new Date('2020-01-01'), familyBurdens: 0 },
    ] });
    expect(r.topeIndividual).toBe(11_568);
    expect(r.lines[0].neto).toBe(11_568);
    expect(r.lines[0].excedenteIess).toBe(100_000 - 11_568);
    expect(r.totalExcedenteIess).toBe(88_432);
  });
  it('un trabajador salido antes del año no participa', () => {
    const r = computeUtilidades({ year: y, utilidadLiquida: 1000, sbu: 482, workers: [
      { employeeId: 'a', name: 'A', hireDate: new Date('2020-01-01'), terminationDate: new Date('2024-06-30'), familyBurdens: 0 },
    ] });
    expect(r.lines).toEqual([]);
  });
});

describe('permissions-matrix', () => {
  it('ADMIN tiene control total', () => {
    const m = buildPermissionMatrix('ADMIN');
    expect(m.fullAccess).toBe(true);
    expect(m.rows.length).toBeGreaterThan(10);
  });
  it('AUDITOR solo ve (read) y nunca contabiliza ni paga', () => {
    const m = buildPermissionMatrix('AUDITOR');
    expect(m.fullAccess).toBe(false);
    const actions = new Set(m.rows.flatMap((r) => r.actions.map((a) => a.action)));
    expect(actions.has('read')).toBe(true);
    expect(actions.has('post')).toBe(false);
    expect(actions.has('pay')).toBe(false);
  });
  it('etiquetas en español y rol desconocido cae a USER', () => {
    const m = buildPermissionMatrix('NO_EXISTE');
    expect(m.role).toBe('USER');
    expect(m.rows.every((r) => /[a-záéíóú]/i.test(r.label))).toBe(true);
  });
});
