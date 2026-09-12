import { splitBases } from '../src/services/withholding.service';
import { mergeConfig, validateConfig, ERP_CONFIG_DEFAULTS } from '../src/services/erp-config.service';

// Línea de prueba mínima para splitBases
type L = { type: string; sub: number; tax: number };
const lines: L[] = [
  { type: 'PRODUCT', sub: 100, tax: 15 },
  { type: 'SERVICE', sub: 200, tax: 30 },
  { type: 'PRODUCT', sub: 50, tax: 7.5 },
];
const bases = () => splitBases(lines, (l) => l.type, (l) => l.sub, (l) => l.tax);

describe('withholding.splitBases — separación bienes vs. servicios (DeepSeek #1)', () => {
  it('suma los bienes (PRODUCT) por separado de los servicios (SERVICE)', () => {
    const b = bases();
    expect(b.goodsBase).toBe(150);     // 100 + 50
    expect(b.servicesBase).toBe(200);  // 200
    expect(b.ivaAmount).toBe(52.5);    // 15 + 30 + 7.5
  });

  it('trata un tipo desconocido/undefined como bien', () => {
    const b = splitBases([{ type: 'OTRO', sub: 80, tax: 0 }], (l) => l.type, (l) => l.sub, (l) => l.tax);
    expect(b.goodsBase).toBe(80);
    expect(b.servicesBase).toBe(0);
  });
});

describe('erp-config.mergeConfig — backfill de defaults', () => {
  it('rellena secciones faltantes con los defaults', () => {
    const cfg = mergeConfig({ sales: { enforceCreditLimit: false } });
    expect(cfg.sales.enforceCreditLimit).toBe(false);            // respeta lo guardado
    expect(cfg.sales.allowPartialDispatch).toBe(ERP_CONFIG_DEFAULTS.sales.allowPartialDispatch); // backfill
    expect(cfg.security.sessionTimeoutMinutes).toBe(30);         // sección nueva por default
  });

  it('devuelve la config completa ante settings nulos', () => {
    const cfg = mergeConfig(null);
    expect(cfg.sales.maxDiscountByRole.ADMIN).toBe(100);
  });

  it('los defaults de tope de descuento cubren los roles reales de venta', () => {
    // Regresión Sprint 2.2: antes solo existían ADMIN/SALES_MANAGER/SUPERVISOR/USER y la
    // fuerza de ventas real (FUERZA_VENTAS, etc.) quedaba con tope 0% sin poder descontar.
    const caps = ERP_CONFIG_DEFAULTS.sales.maxDiscountByRole;
    expect(caps.GERENTE).toBe(100);
    expect(caps.GERENTE_VENTAS).toBeGreaterThan(0);
    expect(caps.SUPERVISOR_VENTAS).toBeGreaterThan(0);
    expect(caps.FUERZA_VENTAS).toBeGreaterThan(0);
  });

  it('respeta sales.maxDiscountByRole y security guardados (no los pisa con defaults)', () => {
    const cfg = mergeConfig({
      sales: { maxDiscountByRole: { FUERZA_VENTAS: 12 } },
      security: { sessionTimeoutMinutes: 60, require2FAForRoles: ['CONTADOR'] },
    });
    expect(cfg.sales.maxDiscountByRole.FUERZA_VENTAS).toBe(12);
    expect(cfg.security.sessionTimeoutMinutes).toBe(60);
    expect(cfg.security.require2FAForRoles).toEqual(['CONTADOR']);
    // el merge por sección backfillea las claves hermanas que no se guardaron
    expect(cfg.sales.enforceCreditLimit).toBe(true);
  });
});

describe('erp-config.validateConfig — falla explícito ante claves faltantes (DeepSeek #4)', () => {
  it('pasa con una config completa', () => {
    expect(() => validateConfig(mergeConfig(null))).not.toThrow();
  });

  it('lanza ERP_CONFIG_INVALID si falta una clave', () => {
    const broken: any = mergeConfig(null);
    delete broken.security.sessionTimeoutMinutes;
    expect(() => validateConfig(broken)).toThrow(/ERP_CONFIG_INVALID/);
  });

  it('lanza si falta una sección completa', () => {
    const broken: any = mergeConfig(null);
    delete broken.sales;
    expect(() => validateConfig(broken)).toThrow(/ERP_CONFIG_INVALID/);
  });
});
