/**
 * Traduce un `Shipment` (+ transportista capturado al emitir + destinatario del pedido de
 * venta) al input plano de `guia-remision-xml.engine.ts`. Motor puro: recibe objetos ya
 * cargados.
 */
import { GuiaRemisionXmlInput, GuiaRemisionXmlItem } from './guia-remision-xml.engine';
import { EmisorForSri, InvoiceForSri, resolveComprador } from './invoice-to-factura.engine';

export interface TransportistaInput {
  razonSocial: string;
  tipoIdentificacion: 'RUC' | 'CEDULA' | 'PASAPORTE';
  identificacion: string;
  placa: string;
}

export interface ShipmentForSri {
  motivoTraslado: string;
  dirPartida: string;
  fechaIniTransporte: Date;
  fechaFinTransporte: Date;
  transportista: TransportistaInput;
  items: Array<{ sku?: string | null; description: string; quantity: number }>;
}

export interface InvoiceSustentoOpcional {
  estab: string;
  ptoEmi: string;
  sriSecuencial: string;
  numeroAutorizacion: string;
  issueDate: Date;
}

export function buildGuiaRemisionInput(args: {
  shipment: ShipmentForSri;
  customer: InvoiceForSri['customer'];
  invoiceSustento?: InvoiceSustentoOpcional | null;
  emisor: EmisorForSri;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  claveAcceso: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): GuiaRemisionXmlInput {
  const { shipment, customer, invoiceSustento, emisor } = args;
  if (shipment.items.length === 0) throw new Error('El envío no tiene ítems para trasladar');

  const items: GuiaRemisionXmlItem[] = shipment.items.map((it, idx) => ({
    codigoInterno: (it.sku && it.sku.trim()) || `ITEM-${String(idx + 1).padStart(3, '0')}`,
    descripcion: it.description.slice(0, 300),
    cantidad: it.quantity,
  }));

  const comprador = resolveComprador(customer, 0); // sin monto: nunca bloquea por tope de consumidor final

  return {
    ambiente: args.ambiente,
    claveAcceso: args.claveAcceso,
    emisor: {
      ruc: emisor.ruc, razonSocial: emisor.razonSocial, nombreComercial: emisor.nombreComercial ?? undefined,
      dirMatriz: emisor.dirMatriz, dirEstablecimiento: emisor.dirEstablecimiento ?? undefined,
      obligadoContabilidad: emisor.obligadoContabilidad, contribuyenteEspecial: emisor.contribuyenteEspecial ?? undefined,
    },
    estab: args.estab, ptoEmi: args.ptoEmi, secuencial: args.secuencial,
    dirPartida: shipment.dirPartida,
    transportista: shipment.transportista,
    fechaIniTransporte: shipment.fechaIniTransporte,
    fechaFinTransporte: shipment.fechaFinTransporte,
    destinatario: {
      tipoIdentificacion: comprador.tipoIdentificacion,
      identificacion: comprador.identificacion,
      razonSocial: comprador.razonSocial,
      direccion: comprador.direccion,
      motivoTraslado: shipment.motivoTraslado,
      docSustento: invoiceSustento ? {
        estab: invoiceSustento.estab, ptoEmi: invoiceSustento.ptoEmi, secuencial: invoiceSustento.sriSecuencial,
        numeroAutorizacion: invoiceSustento.numeroAutorizacion, fechaEmision: invoiceSustento.issueDate,
      } : undefined,
    },
    items,
  };
}
