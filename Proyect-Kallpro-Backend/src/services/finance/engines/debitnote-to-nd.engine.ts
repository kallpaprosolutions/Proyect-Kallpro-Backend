/**
 * Traduce una `DebitNote` del ERP (+ la `Invoice` que debita, ya AUTORIZADA por el SRI) al
 * input plano de `nota-debito-xml.engine.ts`. Motor puro: recibe objetos ya cargados.
 */
import { NotaDebitoXmlInput, NotaDebitoMotivo } from './nota-debito-xml.engine';
import { EmisorForSri, InvoiceForSri, resolveComprador, taxRateToIvaCodigo } from './invoice-to-factura.engine';

export interface DebitNoteForSri {
  taxRate: number;
  concepts: Array<{ description: string; amount: number }>;
}

export interface InvoiceSustento {
  estab: string;
  ptoEmi: string;
  sriSecuencial: string;
  issueDate: Date;
}

export function buildNotaDebitoInput(args: {
  debitNote: DebitNoteForSri;
  customer: InvoiceForSri['customer'];
  invoiceSustento: InvoiceSustento;
  emisor: EmisorForSri;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  claveAcceso: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): NotaDebitoXmlInput {
  const { debitNote, customer, invoiceSustento, emisor } = args;
  if (debitNote.concepts.length === 0) throw new Error('La nota de débito no tiene conceptos para emitir');

  const totalNd = debitNote.concepts.reduce((s, c) => s + c.amount, 0) * (1 + debitNote.taxRate / 100);
  const motivos: NotaDebitoMotivo[] = debitNote.concepts.map((c) => ({ razon: c.description.slice(0, 300), valor: c.amount }));

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
    comprador: resolveComprador(customer, totalNd),
    docModificado: {
      tipo: 'FACTURA', estab: invoiceSustento.estab, ptoEmi: invoiceSustento.ptoEmi,
      secuencial: invoiceSustento.sriSecuencial, fechaEmision: invoiceSustento.issueDate,
    },
    ivaCodigo: taxRateToIvaCodigo(debitNote.taxRate),
    motivos,
  };
}
