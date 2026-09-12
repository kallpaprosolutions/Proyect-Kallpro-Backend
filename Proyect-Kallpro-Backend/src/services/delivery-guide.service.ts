import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';

/**
 * Guías de Remisión de venta (Etapa 4 del plan SRI, resto): documentan el TRASLADO de
 * mercadería de un `Shipment` ya existente. Sin valores monetarios ni asiento contable — es
 * puramente un documento de evidencia de transporte, a diferencia de factura/NC/ND.
 */

const TIPOS_IDENTIFICACION = ['RUC', 'CEDULA', 'PASAPORTE'] as const;
export type TipoIdentificacionTransportista = (typeof TIPOS_IDENTIFICACION)[number];

export interface CreateDeliveryGuideInput {
  motivoTraslado: string;
  dirPartida: string;
  fechaIniTransporte: Date;
  fechaFinTransporte: Date;
  transportista: {
    razonSocial: string;
    tipoIdentificacion: TipoIdentificacionTransportista;
    identificacion: string;
    placa: string;
  };
}

export async function createDeliveryGuide(companyId: string, shipmentId: string, data: CreateDeliveryGuideInput, createdBy?: string) {
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, companyId } });
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');
  if (shipment.orderType !== 'SALES') throw new Error('SHIPMENT_NOT_SALES');
  if (!data.motivoTraslado?.trim()) throw new Error('VALIDATION: el motivo de traslado es obligatorio');
  if (!data.transportista?.razonSocial?.trim()) throw new Error('VALIDATION: la razón social del transportista es obligatoria');
  if (!data.transportista?.identificacion?.trim()) throw new Error('VALIDATION: la identificación del transportista es obligatoria');
  if (!data.transportista?.placa?.trim()) throw new Error('VALIDATION: la placa del vehículo es obligatoria');
  if (!TIPOS_IDENTIFICACION.includes(data.transportista.tipoIdentificacion)) throw new Error('VALIDATION: tipo de identificación del transportista inválido');
  if (new Date(data.fechaFinTransporte) < new Date(data.fechaIniTransporte)) {
    throw new Error('VALIDATION: la fecha de fin de transporte no puede ser anterior a la de inicio');
  }

  const shipmentItems = await prisma.shipmentItem.findMany({
    where: { shipmentId },
    include: { salesOrderItem: { include: { product: true } } },
  });
  if (shipmentItems.length === 0) throw new Error('NO_ITEMS');

  const guide = await prisma.$transaction(async (tx) => {
    const number = await getNextDocumentNumber(tx, companyId, 'DELIVERY_GUIDE', 'GR-');
    return tx.deliveryGuide.create({
      data: {
        companyId, number, shipmentId,
        motivoTraslado: data.motivoTraslado,
        dirPartida: data.dirPartida,
        fechaIniTransporte: data.fechaIniTransporte,
        fechaFinTransporte: data.fechaFinTransporte,
        transportistaRazonSocial: data.transportista.razonSocial,
        transportistaTipoIdentificacion: data.transportista.tipoIdentificacion,
        transportistaIdentificacion: data.transportista.identificacion,
        placa: data.transportista.placa,
        createdBy,
        items: {
          create: shipmentItems.map((si) => ({
            description: si.salesOrderItem?.description || si.salesOrderItem?.product?.name || 'Ítem',
            quantity: new Prisma.Decimal(si.quantity),
          })),
        },
      },
      include: { items: true },
    });
  });

  return getDeliveryGuideById(companyId, guide.id);
}

export async function getDeliveryGuideById(companyId: string, id: string) {
  return prisma.deliveryGuide.findFirst({
    where: { id, companyId },
    include: { items: true, shipment: { select: { trackingNumber: true, orderType: true, orderId: true } } },
  });
}

export async function getDeliveryGuidesForShipment(companyId: string, shipmentId: string) {
  return prisma.deliveryGuide.findMany({
    where: { companyId, shipmentId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}
