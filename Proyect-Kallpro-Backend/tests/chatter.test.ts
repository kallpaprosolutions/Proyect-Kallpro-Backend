// Tests del motor puro del chatter (A2 — plan Odoo 18).
import {
  normalizeMessageBody,
  normalizeMessageKind,
  displayName,
  assertChatterEntityType,
  CHATTER_ENTITY_TYPES,
} from '../src/services/chatter.service';

describe('chatter (motor puro)', () => {
  describe('normalizeMessageBody', () => {
    it('recorta espacios y devuelve el cuerpo', () => {
      expect(normalizeMessageBody('  Hola equipo  ')).toBe('Hola equipo');
    });

    it('rechaza mensajes vacíos o no-string', () => {
      expect(() => normalizeMessageBody('')).toThrow('vacío');
      expect(() => normalizeMessageBody('   ')).toThrow('vacío');
      expect(() => normalizeMessageBody(undefined)).toThrow('vacío');
      expect(() => normalizeMessageBody(42)).toThrow('vacío');
    });

    it('rechaza mensajes de más de 2000 caracteres', () => {
      expect(() => normalizeMessageBody('x'.repeat(2001))).toThrow('2000');
      expect(normalizeMessageBody('x'.repeat(2000))).toHaveLength(2000);
    });
  });

  describe('displayName', () => {
    it('arma nombre y apellido', () => {
      expect(displayName({ firstName: 'Ana', lastName: 'Torres', email: 'a@x.com' })).toBe('Ana Torres');
    });
    it('usa solo el nombre disponible', () => {
      expect(displayName({ firstName: 'Ana', lastName: null, email: 'a@x.com' })).toBe('Ana');
    });
    it('cae al email si no hay nombre', () => {
      expect(displayName({ firstName: null, lastName: null, email: 'a@x.com' })).toBe('a@x.com');
    });
  });

  describe('normalizeMessageKind (A2.2 — nota interna vs mensaje)', () => {
    it('sin kind, default a MESSAGE', () => {
      expect(normalizeMessageKind(undefined)).toBe('MESSAGE');
      expect(normalizeMessageKind(null)).toBe('MESSAGE');
    });
    it('acepta MESSAGE y NOTE explícitos', () => {
      expect(normalizeMessageKind('MESSAGE')).toBe('MESSAGE');
      expect(normalizeMessageKind('NOTE')).toBe('NOTE');
    });
    it('rechaza un kind inválido (LOG no se publica a mano, solo el sistema)', () => {
      expect(() => normalizeMessageKind('LOG')).toThrow('inválido');
      expect(() => normalizeMessageKind('BORRAR_TODO')).toThrow('inválido');
    });
  });

  describe('assertChatterEntityType', () => {
    it('acepta los 8 tipos de documento con chatter', () => {
      expect(CHATTER_ENTITY_TYPES).toEqual(['PURCHASE_ORDER', 'SALES_ORDER', 'INVOICE', 'REQUISITION', 'SALES_QUOTATION', 'CREDIT_NOTE', 'DEBIT_NOTE', 'DELIVERY_GUIDE']);
      for (const t of CHATTER_ENTITY_TYPES) expect(() => assertChatterEntityType(t)).not.toThrow();
    });
    it('rechaza tipos no soportados (evita hilos sobre entidades arbitrarias)', () => {
      expect(() => assertChatterEntityType('EMPLOYEE')).toThrow('no soportado');
      expect(() => assertChatterEntityType('')).toThrow('no soportado');
    });
  });
});
