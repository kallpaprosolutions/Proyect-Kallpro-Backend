/**
 * Ingreso manual/semi-automático de documentos SRI — test del motor puro que calcula
 * totales de factura/NC/ND a partir de los ítems que escribe el usuario. Sin BD
 * (regla transversal 6).
 */

import { computeManualSriDocument, ManualSriItemInput } from '../src/services/sri-manual-entry.engine';

describe('computeManualSriDocument', () => {
  it('calcula precioTotal y valorIva por ítem con tarifa 15%', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'Tornillos', cantidad: 10, precioUnitario: 2, codigoTarifa: '15', tarifaIva: 15 },
    ];
    const { items: out, totals } = computeManualSriDocument(items);
    expect(out[0]).toMatchObject({ linea: 1, precioTotal: 20, valorIva: 3 });
    expect(totals).toMatchObject({ subtotal15: 20, iva: 3, total: 23 });
  });

  it('agrupa varios ítems por tarifa distinta en sus propios subtotales', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'Producto gravado', cantidad: 1, precioUnitario: 100, codigoTarifa: '15', tarifaIva: 15 },
      { descripcion: 'Producto exento', cantidad: 1, precioUnitario: 50, codigoTarifa: 'EXENTO', tarifaIva: 0 },
      { descripcion: 'Producto tarifa 0', cantidad: 1, precioUnitario: 30, codigoTarifa: '0', tarifaIva: 0 },
    ];
    const { totals } = computeManualSriDocument(items);
    expect(totals.subtotal15).toBe(100);
    expect(totals.subtotalExento).toBe(50);
    expect(totals.subtotal0).toBe(30);
    expect(totals.iva).toBe(15);
    expect(totals.total).toBe(195);
  });

  it('resta el descuento antes de calcular el IVA', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'Con descuento', cantidad: 2, precioUnitario: 50, descuento: 10, codigoTarifa: '15', tarifaIva: 15 },
    ];
    const { items: out, totals } = computeManualSriDocument(items);
    // bruto 100 - descuento 10 = 90; IVA 15% de 90 = 13.5
    expect(out[0].precioTotal).toBe(90);
    expect(out[0].valorIva).toBe(13.5);
    expect(totals.total).toBe(103.5);
  });

  it('rechaza un documento sin ítems', () => {
    expect(() => computeManualSriDocument([])).toThrow('al menos un ítem');
  });

  it('rechaza una cantidad cero o negativa', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'X', cantidad: 0, precioUnitario: 10, codigoTarifa: '0', tarifaIva: 0 },
    ];
    expect(() => computeManualSriDocument(items)).toThrow('cantidad debe ser mayor a cero');
  });

  it('rechaza un precio unitario negativo', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'X', cantidad: 1, precioUnitario: -5, codigoTarifa: '0', tarifaIva: 0 },
    ];
    expect(() => computeManualSriDocument(items)).toThrow('precio unitario no puede ser negativo');
  });

  it('rechaza un código de tarifa no reconocido', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'X', cantidad: 1, precioUnitario: 10, codigoTarifa: '99', tarifaIva: 12 },
    ];
    expect(() => computeManualSriDocument(items)).toThrow('código de tarifa IVA no reconocido');
  });

  it('numera las líneas en el orden en que llegan los ítems, empezando en 1', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'A', cantidad: 1, precioUnitario: 1, codigoTarifa: '0', tarifaIva: 0 },
      { descripcion: 'B', cantidad: 1, precioUnitario: 1, codigoTarifa: '0', tarifaIva: 0 },
      { descripcion: 'C', cantidad: 1, precioUnitario: 1, codigoTarifa: '0', tarifaIva: 0 },
    ];
    const { items: out } = computeManualSriDocument(items);
    expect(out.map((i) => i.linea)).toEqual([1, 2, 3]);
  });

  it('el total del documento siempre es la suma de todos los subtotales más el IVA', () => {
    const items: ManualSriItemInput[] = [
      { descripcion: 'A', cantidad: 3, precioUnitario: 7.33, codigoTarifa: '15', tarifaIva: 15 },
      { descripcion: 'B', cantidad: 2, precioUnitario: 4.99, codigoTarifa: '8', tarifaIva: 8 },
    ];
    const { totals } = computeManualSriDocument(items);
    const sumaSubtotales = totals.subtotal0 + totals.subtotal8 + totals.subtotal12 + totals.subtotal15
      + totals.subtotalNoObj + totals.subtotalExento;
    expect(Math.round((sumaSubtotales + totals.iva) * 100) / 100).toBe(totals.total);
  });
});
