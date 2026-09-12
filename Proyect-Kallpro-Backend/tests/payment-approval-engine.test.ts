/**
 * Aprobaciones por monto en CxP/CxC (roadmap Asistente Contable, Fase 4). Cálculo puro,
 * sin BD (regla transversal 6).
 */

import { requiredApprovalTier, roleCanApproveTier, assertCanExecutePayment } from '../src/services/payment-approval.service';
import { AppError } from '../src/utils/errors';

const LIMITS = { paymentResponsableLimit: 500, paymentGerencialLimit: 5000 };

describe('requiredApprovalTier', () => {
  it('por debajo del límite responsable → AUTO', () => {
    expect(requiredApprovalTier(100, LIMITS)).toBe('AUTO');
    expect(requiredApprovalTier(499.99, LIMITS)).toBe('AUTO');
  });
  it('en el límite responsable o por encima (hasta antes del gerencial) → RESPONSABLE', () => {
    expect(requiredApprovalTier(500, LIMITS)).toBe('RESPONSABLE');
    expect(requiredApprovalTier(4999.99, LIMITS)).toBe('RESPONSABLE');
  });
  it('en el límite gerencial o por encima → GERENCIAL', () => {
    expect(requiredApprovalTier(5000, LIMITS)).toBe('GERENCIAL');
    expect(requiredApprovalTier(500000, LIMITS)).toBe('GERENCIAL');
  });
});

describe('roleCanApproveTier', () => {
  it('ADMIN puede en cualquier nivel', () => {
    expect(roleCanApproveTier('ADMIN', 'AUTO')).toBe(true);
    expect(roleCanApproveTier('ADMIN', 'RESPONSABLE')).toBe(true);
    expect(roleCanApproveTier('ADMIN', 'GERENCIAL')).toBe(true);
  });
  it('ASISTENTE_CONTABLE solo AUTO', () => {
    expect(roleCanApproveTier('ASISTENTE_CONTABLE', 'AUTO')).toBe(true);
    expect(roleCanApproveTier('ASISTENTE_CONTABLE', 'RESPONSABLE')).toBe(false);
    expect(roleCanApproveTier('ASISTENTE_CONTABLE', 'GERENCIAL')).toBe(false);
  });
  it('CONTADOR llega hasta RESPONSABLE, no GERENCIAL', () => {
    expect(roleCanApproveTier('CONTADOR', 'RESPONSABLE')).toBe(true);
    expect(roleCanApproveTier('CONTADOR', 'GERENCIAL')).toBe(false);
  });
  it('GERENTE cubre todos los niveles', () => {
    expect(roleCanApproveTier('GERENTE', 'GERENCIAL')).toBe(true);
  });
  it('un rol sin permiso de pagos (ej. BODEGUERO) no aprueba ni el nivel AUTO', () => {
    expect(roleCanApproveTier('BODEGUERO', 'AUTO')).toBe(false);
  });
  it('sin rol (null/undefined) nunca aprueba', () => {
    expect(roleCanApproveTier(null, 'AUTO')).toBe(false);
    expect(roleCanApproveTier(undefined, 'AUTO')).toBe(false);
  });
});

describe('assertCanExecutePayment', () => {
  it('no lanza si el rol alcanza para el monto', () => {
    expect(() => assertCanExecutePayment(100, 'ASISTENTE_CONTABLE', LIMITS)).not.toThrow();
    expect(() => assertCanExecutePayment(1000, 'CONTADOR', LIMITS)).not.toThrow();
    expect(() => assertCanExecutePayment(10000, 'GERENTE', LIMITS)).not.toThrow();
  });

  it('lanza AppError.forbidden con el código PAYMENT_APPROVAL_REQUIRED si el rol no alcanza', () => {
    let thrown: unknown;
    try { assertCanExecutePayment(1000, 'ASISTENTE_CONTABLE', LIMITS); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(AppError);
    const err = thrown as AppError;
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('PAYMENT_APPROVAL_REQUIRED');
    expect(err.message).toContain('responsable de cuentas');
  });

  it('un monto gerencial rechaza incluso a Contador', () => {
    let thrown: unknown;
    try { assertCanExecutePayment(10000, 'CONTADOR', LIMITS); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).message).toContain('gerencial');
  });
});
