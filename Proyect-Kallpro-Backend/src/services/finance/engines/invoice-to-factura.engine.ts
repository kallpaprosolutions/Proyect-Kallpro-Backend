/**
 * Traduce una factura de venta del ERP (Invoice + pedido + cliente + líneas con IVA) al
 * input plano que arma el XML del SRI (`factura-xml.engine.ts`). Motor puro: recibe objetos
 * planos ya cargados, no toca Prisma — el servicio se encarga de las consultas.
 *
 * Reglas tributarias que aplica (todas con mensaje en español para el usuario):
 * - Identificación del comprador según `Customer.documentType`; sin identificación se emite a
 *   CONSUMIDOR FINAL (13 nueves) solo hasta el tope legal de monto.
 * - La tarifa de IVA de cada línea viene de `SalesOrderItem.taxRate` y se traduce al código
 *   interno que ya usa `tax.service.ts`; una tarifa que no exista en el catálogo bloquea la
 *   emisión (mejor que enviar un comprobante que el SRI va a rechazar).
 */
import { FacturaXmlInput, FacturaXmlItem, IvaCodigoInterno, TipoIdentificacionComprador } from './factura-xml.engine';

/** Tope para emitir a "CONSUMIDOR FINAL" sin identificar al comprador (Reglamento de Comprobantes de Venta). */
export const CONSUMIDOR_FINAL_MAX_TOTAL = 50;
export const CONSUMIDOR_FINAL_ID = '9999999999999';

export interface InvoiceForSri {
  number: string;
  issueDate: Date;
  totalAmount: number;
  customer: {
    name: string;
    razonSocial?: string | null;
    ruc?: string | null;
    documentType?: string | null; // RUC | CEDULA | PASAPORTE
    address?: string | null;
    email?: string | null;
  };
  lines: Array<{
    sku?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPct: number; // % sobre la línea (SalesOrderItem.discount)
    taxRate: number; // % IVA (SalesOrderItem.taxRate)
  }>;
}

export interface EmisorForSri {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  dirMatriz: string;
  dirEstablecimiento?: string | null;
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string | null;
}

const TAX_RATE_TO_CODIGO: Record<string, IvaCodigoInterno> = {
  '0': '0', '8': '8', '12': '12', '15': '15',
};

export function taxRateToIvaCodigo(taxRate: number): IvaCodigoInterno {
  const key = String(Math.round(taxRate * 100) / 100);
  const codigo = TAX_RATE_TO_CODIGO[key];
  if (!codigo) {
    throw new Error(`Tarifa de IVA ${taxRate}% no está en el catálogo del SRI (válidas: 0, 8, 12, 15)`);
  }
  return codigo;
}

export function resolveComprador(customer: InvoiceForSri['customer'], total: number): FacturaXmlInput['comprador'] {
  const id = (customer.ruc ?? '').trim();
  const razonSocial = (customer.razonSocial || customer.name || '').trim();
  if (!id) {
    if (total > CONSUMIDOR_FINAL_MAX_TOTAL) {
      throw new Error(
        `El cliente "${customer.name}" no tiene RUC/cédula y la factura ($${total.toFixed(2)}) supera el tope de $${CONSUMIDOR_FINAL_MAX_TOTAL} para consumidor final`,
      );
    }
    return { tipoIdentificacion: 'CONSUMIDOR_FINAL', identificacion: CONSUMIDOR_FINAL_ID, razonSocial: 'CONSUMIDOR FINAL' };
  }
  let tipo: TipoIdentificacionComprador;
  const declared = (customer.documentType ?? '').toUpperCase();
  if (declared === 'RUC' || declared === 'CEDULA' || declared === 'PASAPORTE') tipo = declared;
  else if (/^\d{13}$/.test(id)) tipo = 'RUC';
  else if (/^\d{10}$/.test(id)) tipo = 'CEDULA';
  else tipo = 'PASAPORTE';
  if (tipo === 'RUC' && !/^\d{13}$/.test(id)) throw new Error(`El RUC del cliente "${customer.name}" debe tener 13 dígitos`);
  if (tipo === 'CEDULA' && !/^\d{10}$/.test(id)) throw new Error(`La cédula del cliente "${customer.name}" debe tener 10 dígitos`);
  return { tipoIdentificacion: tipo, identificacion: id, razonSocial, direccion: customer.address ?? undefined };
}

export function buildFacturaInput(args: {
  invoice: InvoiceForSri;
  emisor: EmisorForSri;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  claveAcceso: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): FacturaXmlInput {
  const { invoice, emisor } = args;
  if (invoice.lines.length === 0) throw new Error(`La factura ${invoice.number} no tiene líneas para emitir`);

  const items: FacturaXmlItem[] = invoice.lines.map((l, idx) => {
    const bruto = l.quantity * l.unitPrice;
    const descuento = Math.round(bruto * (l.discountPct / 100) * 100) / 100;
    return {
      codigoPrincipal: (l.sku && l.sku.trim()) || `ITEM-${String(idx + 1).padStart(3, '0')}`,
      descripcion: l.description.slice(0, 300),
      cantidad: l.quantity,
      precioUnitario: l.unitPrice,
      descuento,
      ivaCodigo: taxRateToIvaCodigo(l.taxRate),
    };
  });

  const infoAdicional: Record<string, string> = { 'Factura interna': invoice.number };
  if (invoice.customer.email) infoAdicional['Email'] = invoice.customer.email;

  return {
    ambiente: args.ambiente,
    claveAcceso: args.claveAcceso,
    emisor: {
      ruc: emisor.ruc,
      razonSocial: emisor.razonSocial,
      nombreComercial: emisor.nombreComercial ?? undefined,
      dirMatriz: emisor.dirMatriz,
      dirEstablecimiento: emisor.dirEstablecimiento ?? undefined,
      obligadoContabilidad: emisor.obligadoContabilidad,
      contribuyenteEspecial: emisor.contribuyenteEspecial ?? undefined,
    },
    estab: args.estab,
    ptoEmi: args.ptoEmi,
    secuencial: args.secuencial,
    fechaEmision: invoice.issueDate,
    comprador: resolveComprador(invoice.customer, invoice.totalAmount),
    items,
    infoAdicional,
  };
}
