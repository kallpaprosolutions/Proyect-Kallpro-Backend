import {
  classifyIdentificacion, tipoComprobanteAts, approximateNetFromTotal, computeVentaBreakdownFromLines,
  buildAtsSummary, AtsComprasRow, AtsVentasRow,
} from '../src/services/finance/engines/ats.engine';

describe('ats.engine', () => {
  describe('classifyIdentificacion', () => {
    it('RUC: 13 dígitos terminados en 001', () => {
      expect(classifyIdentificacion('1790012345001')).toBe('04');
    });

    it('cédula: 10 dígitos', () => {
      expect(classifyIdentificacion('1202582580')).toBe('05');
    });

    it('vacío o nulo → consumidor final', () => {
      expect(classifyIdentificacion(null)).toBe('07');
      expect(classifyIdentificacion('')).toBe('07');
    });

    it('cualquier otro formato → pasaporte', () => {
      expect(classifyIdentificacion('AB1234567')).toBe('06');
    });

    it('13 dígitos que NO terminan en 001 no es RUC válido → pasaporte (dato corrupto)', () => {
      expect(classifyIdentificacion('1790012345999')).toBe('06');
    });
  });

  describe('tipoComprobanteAts', () => {
    it('mapea los tipos conocidos a los códigos oficiales del catálogo SRI', () => {
      expect(tipoComprobanteAts('FACTURA')).toBe('01');
      expect(tipoComprobanteAts('LIQUIDACION_COMPRA')).toBe('03');
      expect(tipoComprobanteAts('NOTA_CREDITO')).toBe('04');
      expect(tipoComprobanteAts('NOTA_DEBITO')).toBe('05');
    });

    it('desconocido cae a factura (01) por defecto', () => {
      expect(tipoComprobanteAts('ALGO_RARO')).toBe('01');
    });
  });

  describe('approximateNetFromTotal', () => {
    it('descompone un total con IVA incluido en neto + IVA', () => {
      const r = approximateNetFromTotal(115, 15);
      expect(r.net).toBe(100);
      expect(r.iva).toBe(15);
    });

    it('tarifa 0% → todo es neto, sin IVA', () => {
      const r = approximateNetFromTotal(50, 0);
      expect(r.net).toBe(50);
      expect(r.iva).toBe(0);
    });
  });

  describe('computeVentaBreakdownFromLines', () => {
    it('desglosa exacto por línea: tarifa 0% va a baseImpGrav0, tarifa >0% a baseImponible+montoIva', () => {
      const r = computeVentaBreakdownFromLines([
        { quantity: 2, unitPrice: 50, discountPct: 0, taxRate: 15 }, // neto 100, iva 15
        { quantity: 1, unitPrice: 30, discountPct: 0, taxRate: 0 }, // neto 30, sin iva
      ]);
      expect(r.baseImponible).toBe(100);
      expect(r.montoIva).toBe(15);
      expect(r.baseImpGrav0).toBe(30);
    });

    it('aplica el descuento por línea antes de calcular el IVA', () => {
      const r = computeVentaBreakdownFromLines([
        { quantity: 10, unitPrice: 10, discountPct: 10, taxRate: 15 }, // bruto 100, desc 10, neto 90, iva 13.5
      ]);
      expect(r.baseImponible).toBe(90);
      expect(r.montoIva).toBe(13.5);
      expect(r.baseImpGrav0).toBe(0);
    });

    it('factura con tarifas mixtas suma cada base en su balde correcto (a diferencia de la aproximación uniforme)', () => {
      const r = computeVentaBreakdownFromLines([
        { quantity: 1, unitPrice: 200, discountPct: 0, taxRate: 15 },
        { quantity: 1, unitPrice: 50, discountPct: 0, taxRate: 0 },
      ]);
      expect(r.baseImponible).toBe(200);
      expect(r.baseImpGrav0).toBe(50);
      expect(r.montoIva).toBe(30);
    });

    it('sin líneas no revienta y devuelve todo en 0', () => {
      const r = computeVentaBreakdownFromLines([]);
      expect(r).toEqual({ baseImpGrav0: 0, baseImponible: 0, montoIva: 0 });
    });
  });

  describe('buildAtsSummary', () => {
    it('suma correctamente los totales de compras y ventas', () => {
      const compras: AtsComprasRow[] = [
        { tipoIdProveedor: '04', identificacionProveedor: '1790012345001', razonSocialProveedor: 'Prov A', tipoComprobante: '01', fechaEmision: '2026-09-01', establecimiento: '001', puntoEmision: '001', secuencial: '000000001', autorizacion: 'X', baseImpGrav0: 0, baseImponible: 100, montoIva: 15, valorRetIva: 1.5, valorRetRenta: 1 },
        { tipoIdProveedor: '05', identificacionProveedor: '1202582580', razonSocialProveedor: 'Prov B', tipoComprobante: '01', fechaEmision: '2026-09-02', establecimiento: '001', puntoEmision: '001', secuencial: '000000002', autorizacion: 'Y', baseImpGrav0: 20, baseImponible: 50, montoIva: 7.5, valorRetIva: 0, valorRetRenta: 0.5 },
      ];
      const ventas: AtsVentasRow[] = [
        { tipoIdComprador: '07', identificacionComprador: '', razonSocialComprador: 'Consumidor Final', tipoComprobante: '01', fechaEmision: '2026-09-03', numeroComprobante: 'FAC-V-0001', baseImpGrav0: 0, baseImponible: 200, montoIva: 30, valorRetIva: 0, valorRetRenta: 0 },
      ];
      const summary = buildAtsSummary('2026-09', compras, ventas);
      expect(summary.compras.totalBaseImponible).toBe(150);
      expect(summary.compras.totalIva).toBe(22.5);
      expect(summary.compras.totalRetIva).toBe(1.5);
      expect(summary.compras.totalRetRenta).toBe(1.5);
      expect(summary.ventas.totalBaseImponible).toBe(200);
      expect(summary.ventas.totalIva).toBe(30);
      expect(summary.compras.rows).toHaveLength(2);
      expect(summary.ventas.rows).toHaveLength(1);
    });

    it('reporte vacío no revienta y devuelve totales en 0', () => {
      const summary = buildAtsSummary('2026-09', [], []);
      expect(summary.compras.totalBaseImponible).toBe(0);
      expect(summary.ventas.totalIva).toBe(0);
    });
  });
});
