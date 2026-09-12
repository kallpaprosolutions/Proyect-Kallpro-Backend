/**
 * Listas de Precios — el precio de venta sale de la lista vigente, no se escribe a mano.
 * Soporta escalones por volumen (minQuantity) y un fallback al precio base del producto.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recordAudit, diffRecords } from '../utils/audit';

export type PriceSource = 'PRICE_LIST' | 'PRODUCT_BASE';
export interface ResolvedPrice {
  unitPrice: number;
  source: PriceSource;
  priceListId: string | null;
  priceListName: string | null;
}

// ── CRUD de listas ──────────────────────────────────────────────────────────
export async function getPriceLists(companyId: string) {
  return prisma.priceList.findMany({
    where: { companyId },
    include: { _count: { select: { items: true } } },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
  });
}

export async function getPriceListById(id: string, companyId: string) {
  return prisma.priceList.findFirst({
    where: { id, companyId },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true, salePrice: true } } }, orderBy: { minQuantity: 'asc' } } },
  });
}

export async function createPriceList(companyId: string, data: {
  name: string; startDate: Date; endDate?: Date | null; isActive?: boolean;
}, actorId?: string) {
  const created = await prisma.priceList.create({
    data: {
      companyId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      isActive: data.isActive ?? true,
    },
  });
  await recordAudit({ companyId, userId: actorId, action: 'CREATE', entityType: 'PriceList', entityId: created.id, changes: diffRecords(null, created) });
  return created;
}

export async function updatePriceList(id: string, companyId: string, data: {
  name?: string; startDate?: Date; endDate?: Date | null; isActive?: boolean;
}, actorId?: string) {
  const before = await prisma.priceList.findFirst({ where: { id, companyId } });
  if (!before) throw new Error('PRICE_LIST_NOT_FOUND');
  const updated = await prisma.priceList.update({ where: { id }, data });
  await recordAudit({ companyId, userId: actorId, action: 'UPDATE', entityType: 'PriceList', entityId: id, changes: diffRecords(before, updated) });
  return updated;
}

export async function deletePriceList(id: string, companyId: string, actorId?: string) {
  const before = await prisma.priceList.findFirst({ where: { id, companyId } });
  if (!before) throw new Error('PRICE_LIST_NOT_FOUND');
  await prisma.priceList.delete({ where: { id } });
  await recordAudit({ companyId, userId: actorId, action: 'DELETE', entityType: 'PriceList', entityId: id, changes: diffRecords(before, null) });
  return { ok: true };
}

// ── Ítems de la lista ───────────────────────────────────────────────────────
export async function upsertPriceListItem(companyId: string, priceListId: string, data: {
  productId: string; unitPrice: number; minQuantity?: number;
}) {
  // Verificar pertenencia de la lista a la empresa
  const list = await prisma.priceList.findFirst({ where: { id: priceListId, companyId }, select: { id: true } });
  if (!list) throw new Error('PRICE_LIST_NOT_FOUND');
  const minQuantity = data.minQuantity ?? 1;
  return prisma.priceListItem.upsert({
    where: { priceListId_productId_minQuantity: { priceListId, productId: data.productId, minQuantity: new Prisma.Decimal(minQuantity) } },
    create: { priceListId, productId: data.productId, unitPrice: new Prisma.Decimal(data.unitPrice), minQuantity: new Prisma.Decimal(minQuantity) },
    update: { unitPrice: new Prisma.Decimal(data.unitPrice) },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });
}

export async function deletePriceListItem(companyId: string, itemId: string) {
  const item = await prisma.priceListItem.findFirst({ where: { id: itemId, priceList: { companyId } }, select: { id: true } });
  if (!item) throw new Error('ITEM_NOT_FOUND');
  await prisma.priceListItem.delete({ where: { id: itemId } });
  return { ok: true };
}

// ── Resolución de precio ────────────────────────────────────────────────────
/** Lista vigente: activa, ya iniciada y no caducada. Si hay varias, la de inicio más reciente. */
export async function getActivePriceList(companyId: string) {
  const now = new Date();
  return prisma.priceList.findFirst({
    where: {
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    // Ante misma startDate, desempata por la creada más recientemente (determinista).
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    include: { items: true },
  });
}

/**
 * Precio unitario para un producto/cantidad. Toma el de la lista vigente (escalón por
 * volumen más alto cuyo minQuantity ≤ cantidad). Fallback: precio base del producto.
 * Lanza NO_PRICE_AVAILABLE si no hay ni lista ni precio base.
 */
export async function resolveUnitPrice(companyId: string, productId: string, quantity: number): Promise<ResolvedPrice> {
  const list = await getActivePriceList(companyId);
  if (list) {
    const candidates = list.items
      .filter((it) => it.productId === productId && Number(it.minQuantity) <= quantity + 1e-9)
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));
    if (candidates.length > 0) {
      return { unitPrice: Number(candidates[0].unitPrice), source: 'PRICE_LIST', priceListId: list.id, priceListName: list.name };
    }
  }
  // Fallback: precio base del producto
  const product = await prisma.product.findFirst({ where: { id: productId, companyId }, select: { salePrice: true } });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  const base = Number(product.salePrice);
  if (base > 0) {
    return { unitPrice: base, source: 'PRODUCT_BASE', priceListId: null, priceListName: null };
  }
  throw new Error('NO_PRICE_AVAILABLE');
}
