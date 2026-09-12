/**
 * Traduce una `CreditNote` del ERP (+ la `Invoice` que modifica, ya AUTORIZADA por el SRI) al
 * input plano de `nota-credito-xml.engine.ts`. Motor puro: recibe objetos ya cargados.
 */
import { NotaCreditoXmlInput, NotaCreditoXmlItem } from './nota-credito-xml.engine';
import { EmisorForSri, InvoiceForSri, resolveComprador, taxRateToIvaCodigo } from './invoice-to-factura.engine';

export interface CreditNoteForSri {
  reason: string;
  lines: Array<{ sku?: string | null; description: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number }>;
}

export interface InvoiceSustento {
  estab: string;
  ptoEmi: string;
  sriSecuencial: string;
  issueDate: Date;
}

export function buildNotaCreditoInput(args: {
  creditNote: CreditNoteForSri;
  customer: InvoiceForSri['customer'];
  invoiceSustento: InvoiceSustento;
  emisor: EmisorForSri;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  claveAcceso: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): NotaCreditoXmlInput {
  const { creditNote, customer, invoiceSustento, emisor } = args;
  if (creditNote.lines.length === 0) throw new Error('La nota de crédito no tiene líneas para emitir');

  const totalNc = creditNote.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - l.discountPct / 100), 0);
  const items: NotaCreditoXmlItem[] = creditNote.lines.map((l, idx) => {
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

  return {
    ambiente: args.ambiente,
    claveAcceso: args.claveAcceso,
    emisor: {
      ruc: emisor.ruc, razonSocial: emisor.razonSocial, nombreComercial: emisor.nombreComercial ?? undefined,
      dirMatriz: emisor.dirMatriz, dirEstablecimiento: emisor.dirEstablecimiento ?? undefined,
      obligadoContabilidad: emisor.obligadoContabilidad, contribuyenteEspecial: emisor.contribuyenteEspecial ?? undefined,
    },
    estab: args.estab, ptoEmi: args.ptoEmi, secuencial: args.secuencial,
    fechaEmision: new Date(),
    comprador: resolveComprador(customer, totalNc),
    docModificado: {
      tipo: 'FACTURA', estab: invoiceSustento.estab, ptoEmi: invoiceSustento.ptoEmi,
      secuencial: invoiceSustento.sriSecuencial, fechaEmision: invoiceSustento.issueDate,
    },
    motivo: creditNote.reason,
    items,
  };
}
