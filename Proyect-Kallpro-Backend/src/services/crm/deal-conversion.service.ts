/**
 * Puente CRM → Ventas. Al ganar una oportunidad (agente IA o humano) se crea la cotización
 * de venta con los productos conversados, reutilizando `sales.service.createQuotation` (misma
 * numeración COT-, mismos topes de descuento, misma aprobación) — cero lógica de ventas
 * duplicada. El Customer del ERP se reutiliza si ya existe (RUC/email/razón social) o se crea
 * desde la empresa/contacto del CRM.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { AppError } from '../../utils/errors';
import { createQuotation, createCustomer } from '../sales.service';
import { pickCustomerMatch, buildCustomerDraft, buildQuotationItems, DealItemInput } from './engines/deal-conversion.engine';

export async function getDealItems(companyId: string, dealId: string) {
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, companyId }, select: { id: true } });
  if (!deal) throw AppError.notFound('Oportunidad no encontrada', 'DEAL_NOT_FOUND');
  return prisma.crmDealItem.findMany({
    where: { dealId },
    include: { product: { select: { id: true, name: true, sku: true, unit: true, salePrice: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

/** Reemplaza la lista completa de productos del deal (edición tipo formulario). */
export async function setDealItems(companyId: string, dealId: string, items: DealItemInput[]) {
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, companyId }, select: { id: true, salesQuotationId: true } });
  if (!deal) throw AppError.notFound('Oportunidad no encontrada', 'DEAL_NOT_FOUND');
  if (deal.salesQuotationId) throw AppError.badRequest('La oportunidad ya generó una cotización; edítala en Ventas', 'DEAL_ALREADY_CONVERTED');

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { companyId, id: { in: productIds } }, select: { id: true } });
  if (products.length !== productIds.length) throw AppError.badRequest('Uno o más productos no existen en esta empresa', 'PRODUCT_NOT_FOUND');
  for (const it of items) {
    if (!(it.quantity > 0)) throw AppError.badRequest('Cada línea debe tener cantidad mayor a cero', 'VALIDATION_ERROR');
    if (it.unitPrice < 0) throw AppError.badRequest('El precio no puede ser negativo', 'VALIDATION_ERROR');
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  await prisma.$transaction([
    prisma.crmDealItem.deleteMany({ where: { dealId } }),
    ...(items.length ? [prisma.crmDealItem.createMany({
      data: items.map((i) => ({ dealId, productId: i.productId, description: i.description ?? null, quantity: new Prisma.Decimal(i.quantity), unitPrice: new Prisma.Decimal(i.unitPrice) })),
    })] : []),
    // El valor del deal sigue a los productos: es lo que el pronóstico y el funnel usan.
    ...(items.length ? [prisma.crmDeal.update({ where: { id: dealId }, data: { amountUsd: new Prisma.Decimal(Math.round(total * 100) / 100), lastActivityAt: new Date() } })] : []),
  ]);
  return getDealItems(companyId, dealId);
}

async function resolveCustomer(companyId: string, deal: { crmCompany: any; contact: any }) {
  const candidates = await prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: { id: true, ruc: true, email: true, name: true, razonSocial: true },
  });
  const matchId = pickCustomerMatch(candidates, deal.crmCompany, deal.contact);
  if (matchId) return { customerId: matchId, created: false };
  const draft = buildCustomerDraft(deal.crmCompany, deal.contact);
  const customer = await createCustomer(companyId, draft);
  return { customerId: customer.id, created: true };
}

export interface ConvertResult {
  quotationId: string;
  quoteNumber: string;
  customerId: string;
  customerCreated: boolean;
  status: string;
}

export async function convertDealToQuotation(companyId: string, dealId: string, userId?: string, role?: string): Promise<ConvertResult> {
  const deal = await prisma.crmDeal.findFirst({
    where: { id: dealId, companyId },
    include: { items: true, crmCompany: true, contact: true, salesQuotation: { select: { id: true, quoteNumber: true, customerId: true, status: true } } },
  });
  if (!deal) throw AppError.notFound('Oportunidad no encontrada', 'DEAL_NOT_FOUND');
  if (deal.salesQuotation) {
    return { quotationId: deal.salesQuotation.id, quoteNumber: deal.salesQuotation.quoteNumber, customerId: deal.salesQuotation.customerId, customerCreated: false, status: deal.salesQuotation.status };
  }

  let items;
  try {
    items = buildQuotationItems(deal.items.map((i) => ({ productId: i.productId, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })));
  } catch (e: any) {
    throw AppError.badRequest(e.message, 'DEAL_WITHOUT_ITEMS');
  }

  const { customerId, created } = deal.customerId
    ? { customerId: deal.customerId, created: false }
    : await resolveCustomer(companyId, deal);

  const quotation = await createQuotation(companyId, {
    customerId,
    notes: `Generada desde la oportunidad CRM "${deal.name}"`,
    createdBy: userId,
    role: role ?? 'ADMIN', // el precio ya fue negociado en el CRM; no se topa como descuento de vendedor
    reprice: false,
    items,
  });

  await prisma.crmDeal.update({ where: { id: dealId }, data: { customerId, salesQuotationId: quotation.id } });
  logger.info('[crm→ventas] cotización generada desde oportunidad', { dealId, quotationId: quotation.id, customerCreated: created });
  return { quotationId: quotation.id, quoteNumber: quotation.quoteNumber, customerId, customerCreated: created, status: quotation.status };
}

/** Hook no bloqueante para `updateDealStage`: al ganar, intenta convertir; si el deal no tiene productos solo lo registra. */
export async function tryAutoConvertOnWon(companyId: string, dealId: string, userId?: string): Promise<ConvertResult | null> {
  try {
    return await convertDealToQuotation(companyId, dealId, userId);
  } catch (e: any) {
    logger.info('[crm→ventas] deal ganado sin conversión automática', { dealId, reason: e?.message });
    return null;
  }
}
