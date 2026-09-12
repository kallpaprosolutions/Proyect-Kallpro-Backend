/**
 * Motor puro (sin BD) para el ingreso manual/semi-automático de documentos SRI — regla
 * transversal 6. Reproduce a mano el mismo cálculo que trae un XML del SRI ya resuelto
 * (`sri-parser.service.ts`): a partir de los ítems que el usuario escribe (o que la IA
 * extrajo y el usuario corrigió), calcula el total y el IVA de cada línea, y agrupa los
 * subtotales por tarifa — exactamente los campos que `SriDocument` espera.
 */

export interface ManualSriItemInput {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  /** Código del catálogo IvaTariff: '0' | '8' | '12' | '15' | 'NO_OBJETO' | 'EXENTO' */
  codigoTarifa: string;
  /** Porcentaje de esa tarifa (0, 8, 12, 15…) — se pide al vuelo del catálogo, no se infiere aquí. */
  tarifaIva: number;
}

export interface ManualSriItemComputed extends ManualSriItemInput {
  linea: number;
  precioTotal: number;
  valorIva: number;
}

export interface ManualSriTotals {
  subtotal0: number;
  subtotal8: number;
  subtotal12: number;
  subtotal15: number;
  subtotalNoObj: number;
  subtotalExento: number;
  iva: number;
  total: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const SUBTOTAL_KEY_BY_TARIFA: Record<string, keyof ManualSriTotals> = {
  '0': 'subtotal0',
  '8': 'subtotal8',
  '12': 'subtotal12',
  '15': 'subtotal15',
  NO_OBJETO: 'subtotalNoObj',
  EXENTO: 'subtotalExento',
};

export function computeManualSriDocument(items: ManualSriItemInput[]): {
  items: ManualSriItemComputed[];
  totals: ManualSriTotals;
} {
  if (!items || items.length === 0) throw new Error('El documento debe tener al menos un ítem');

  const totals: ManualSriTotals = {
    subtotal0: 0, subtotal8: 0, subtotal12: 0, subtotal15: 0,
    subtotalNoObj: 0, subtotalExento: 0, iva: 0, total: 0,
  };

  const computedItems: ManualSriItemComputed[] = items.map((item, i) => {
    if (!(item.cantidad > 0)) throw new Error(`Ítem ${i + 1}: la cantidad debe ser mayor a cero`);
    if (item.precioUnitario < 0) throw new Error(`Ítem ${i + 1}: el precio unitario no puede ser negativo`);
    const subtotalKey = SUBTOTAL_KEY_BY_TARIFA[item.codigoTarifa];
    if (!subtotalKey) throw new Error(`Ítem ${i + 1}: código de tarifa IVA no reconocido (${item.codigoTarifa})`);

    const descuento = round2(item.descuento ?? 0);
    const bruto = round2(item.cantidad * item.precioUnitario);
    const precioTotal = round2(Math.max(0, bruto - descuento));
    const valorIva = round2(precioTotal * (item.tarifaIva / 100));

    totals[subtotalKey] = round2(totals[subtotalKey] + precioTotal);
    totals.iva = round2(totals.iva + valorIva);

    return { ...item, descuento, linea: i + 1, precioTotal, valorIva };
  });

  totals.total = round2(
    totals.subtotal0 + totals.subtotal8 + totals.subtotal12 + totals.subtotal15
    + totals.subtotalNoObj + totals.subtotalExento + totals.iva,
  );

  return { items: computedItems, totals };
}
