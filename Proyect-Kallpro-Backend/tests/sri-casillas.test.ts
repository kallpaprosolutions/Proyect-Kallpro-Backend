// Tests del motor puro de declaraciones SRI por casillas (Sprint 11 — patrón Odoo).
import {
  buildForm104Casillas,
  buildForm103Casillas,
  Raw104Data,
  FormPendientes,
} from '../src/services/finance/sri-casillas.service';

const noPend: FormPendientes = { sriDocsPendientes: 0, facturasBorrador: 0 };

const raw = (over: Partial<Raw104Data> = {}): Raw104Data => ({
  ventasNetas15: 0, ivaVentas: 0, ncSubtotal: 0, ncIva: 0,
  comprasNetas15: 0, comprasNetas0: 0, ivaCompras: 0, retencionesIvaRecibidas: 0,
  ...over,
});

const casilla = (f: ReturnType<typeof buildForm104Casillas>, num: string) =>
  f.sections.flatMap((s) => s.rows).find((r) => r.casilla === num)!;

describe('buildForm104Casillas (Formulario 104 IVA)', () => {
  it('IVA a pagar: impuesto generado > crédito', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({
      ventasNetas15: 1000, ivaVentas: 150,   // vendo 1000 + 150 IVA
      comprasNetas15: 400, ivaCompras: 60,   // compro 400 + 60 IVA
    }), noPend);
    expect(casilla(f, '429').value).toBe(150); // impuesto generado
    expect(casilla(f, '520').value).toBe(60);  // crédito por compras
    expect(casilla(f, '601').value).toBe(90);  // impuesto causado
    expect(casilla(f, '902').value).toBe(90);  // a pagar
    expect(f.resultado).toEqual({ label: 'IVA a pagar del período', value: 90, type: 'A_PAGAR' });
  });

  it('crédito tributario: compras con más IVA que ventas', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({
      ventasNetas15: 200, ivaVentas: 30,
      comprasNetas15: 1000, ivaCompras: 150,
    }), noPend);
    expect(casilla(f, '601').value).toBe(0);   // no hay impuesto causado
    expect(casilla(f, '602').value).toBe(120); // crédito del mes (150-30)
    expect(f.resultado.type).toBe('CREDITO');
    expect(f.resultado.value).toBe(120);
  });

  it('resta las notas de crédito emitidas de ventas e IVA', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({
      ventasNetas15: 1000, ivaVentas: 150,
      ncSubtotal: 200, ncIva: 30,   // devolución de 200
    }), noPend);
    expect(casilla(f, '419').value).toBe(800);  // ventas netas 1000-200
    expect(casilla(f, '429').value).toBe(120);  // IVA generado 150-30
  });

  it('las retenciones de IVA recibidas reducen el impuesto a pagar (casilla 609)', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({
      ventasNetas15: 1000, ivaVentas: 150,
      comprasNetas15: 0, ivaCompras: 0,
      retencionesIvaRecibidas: 50,
    }), noPend);
    expect(casilla(f, '601').value).toBe(150); // impuesto causado
    expect(casilla(f, '609').value).toBe(50);  // retenciones recibidas
    expect(casilla(f, '902').value).toBe(100); // a pagar 150-50
  });

  it('las retenciones que exceden el impuesto causado generan crédito', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({
      ventasNetas15: 100, ivaVentas: 15,
      retencionesIvaRecibidas: 40,
    }), noPend);
    expect(casilla(f, '902').value).toBe(0);
    expect(f.resultado.type).toBe('CREDITO');
    expect(f.resultado.value).toBe(25); // 40 retenido - 15 causado
  });

  it('marca las casillas en cero como muted (para atenuar en la UI)', () => {
    const f = buildForm104Casillas('2026-07', 'OPEN', 15, raw({ ventasNetas15: 100, ivaVentas: 15 }), noPend);
    expect(casilla(f, '507').style).toBe('muted'); // compras 0% sin datos
    expect(casilla(f, '411').style).toBeUndefined(); // tiene valor
  });

  it('propaga estado del período y pendientes', () => {
    const f = buildForm104Casillas('2026-07', 'CLOSED', 15, raw(), { sriDocsPendientes: 3, facturasBorrador: 2 });
    expect(f.periodStatus).toBe('CLOSED');
    expect(f.pendientes).toEqual({ sriDocsPendientes: 3, facturasBorrador: 2 });
  });
});

describe('buildForm103Casillas (Formulario 103 retenciones)', () => {
  it('ordena por valor retenido descendente y totaliza', () => {
    const f = buildForm103Casillas('2026-07', 'OPEN', [
      { codigo: '312', descripcion: 'Bienes', porcentaje: 1.75, baseImponible: 1000, valorRetenido: 17.5, numFacturas: 2 },
      { codigo: '322', descripcion: 'Servicios', porcentaje: 2, baseImponible: 5000, valorRetenido: 100, numFacturas: 3 },
    ], noPend);
    expect(f.rows[0].codigo).toBe('322'); // el mayor primero
    expect(f.totalBase).toBe(6000);
    expect(f.totalRetenido).toBe(117.5);
  });

  it('lista vacía => totales en cero', () => {
    const f = buildForm103Casillas('2026-07', 'NONE', [], noPend);
    expect(f.totalRetenido).toBe(0);
    expect(f.rows).toHaveLength(0);
    expect(f.periodStatus).toBe('NONE');
  });
});
