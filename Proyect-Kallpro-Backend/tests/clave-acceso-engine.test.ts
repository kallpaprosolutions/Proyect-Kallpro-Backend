import { computeVerificationDigit, buildClaveAcceso } from '../src/services/finance/engines/clave-acceso.engine';

describe('clave-acceso.engine — computeVerificationDigit (módulo 11)', () => {
  it('48 ceros → suma 0 → verificador 0 (11-0=11 → 0)', () => {
    expect(computeVerificationDigit('0'.repeat(48))).toBe(0);
  });

  it('un solo 1 en la posición más a la derecha (peso 2) → suma 2 → verificador 9', () => {
    expect(computeVerificationDigit('0'.repeat(47) + '1')).toBe(9);
  });

  it('un solo 5 en la posición más a la derecha (peso 2) → suma 10 → verificador 1 (11-10)', () => {
    expect(computeVerificationDigit('0'.repeat(47) + '5')).toBe(1);
  });

  it('dos dígitos: 1 en peso 2 y 1 en peso 3 → suma 5 → verificador 6', () => {
    expect(computeVerificationDigit('0'.repeat(46) + '11')).toBe(6);
  });

  it('rechaza una cadena que no tenga exactamente 48 dígitos', () => {
    expect(() => computeVerificationDigit('123')).toThrow(/48 dígitos/);
  });
});

describe('clave-acceso.engine — buildClaveAcceso', () => {
  const base = {
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    tipoComprobante: 'FACTURA' as const,
    ruc: '1790012345001',
    ambiente: 'PRUEBAS' as const,
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000125',
    codigoNumerico: '12345678',
  };

  it('genera una clave de 49 dígitos numéricos', () => {
    const clave = buildClaveAcceso(base);
    expect(clave).toHaveLength(49);
    expect(/^\d{49}$/.test(clave)).toBe(true);
  });

  it('codifica fecha/tipo/ruc/ambiente/serie/secuencial en las posiciones correctas', () => {
    const clave = buildClaveAcceso(base);
    expect(clave.slice(0, 8)).toBe('15092026'); // ddmmaaaa
    expect(clave.slice(8, 10)).toBe('01'); // factura
    expect(clave.slice(10, 23)).toBe('1790012345001'); // RUC
    expect(clave.slice(23, 24)).toBe('1'); // ambiente PRUEBAS
    expect(clave.slice(24, 27)).toBe('001'); // estab
    expect(clave.slice(27, 30)).toBe('001'); // ptoEmi
    expect(clave.slice(30, 39)).toBe('000000125'); // secuencial
    expect(clave.slice(39, 47)).toBe('12345678'); // código numérico
    expect(clave.slice(47, 48)).toBe('1'); // tipoEmision NORMAL
  });

  it('el dígito 24 refleja el ambiente de PRODUCCION', () => {
    const clave = buildClaveAcceso({ ...base, ambiente: 'PRODUCCION' });
    expect(clave.slice(23, 24)).toBe('2');
  });

  it('el último dígito es el verificador módulo 11 recalculable', () => {
    const clave = buildClaveAcceso(base);
    const verificador = computeVerificationDigit(clave.slice(0, 48));
    expect(Number(clave[48])).toBe(verificador);
  });

  it('cambia por completo si cambia el secuencial (no hay colisión entre documentos distintos)', () => {
    const a = buildClaveAcceso(base);
    const b = buildClaveAcceso({ ...base, secuencial: '000000126' });
    expect(a).not.toBe(b);
  });

  it('rechaza un RUC que no tenga 13 dígitos', () => {
    expect(() => buildClaveAcceso({ ...base, ruc: '123' })).toThrow(/RUC/);
  });

  it('rechaza un secuencial que no tenga 9 dígitos', () => {
    expect(() => buildClaveAcceso({ ...base, secuencial: '1' })).toThrow(/secuencial/);
  });
});
