import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
// ─── Auth ────────────────────────────────────────────────────────────────────

export interface PortalPayload {
  supplierId: string;
  companyId: string;
  email: string;
  type: 'PORTAL';
}

export async function portalLogin(email: string, password: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { email, portalEnabled: true },
  });
  if (!supplier) throw new Error('INVALID_CREDENTIALS');
  if (!supplier.portalPassword) throw new Error('PORTAL_NOT_CONFIGURED');

  const valid = await bcrypt.compare(password, supplier.portalPassword);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  if (!supplier.isActive) throw new Error('ACCOUNT_DISABLED');

  const payload: PortalPayload = {
    supplierId: supplier.id,
    companyId: supplier.companyId,
    email: supplier.email!,
    type: 'PORTAL',
  };

  const token = jwt.sign(payload, process.env.PORTAL_JWT_SECRET as string, { expiresIn: '8h' });

  await prisma.supplier.update({
    where: { id: supplier.id },
    data: { lastPortalLogin: new Date() },
  });

  return {
    token,
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      companyId: supplier.companyId,
    },
  };
}

export function verifyPortalToken(token: string): PortalPayload {
  return jwt.verify(token, process.env.PORTAL_JWT_SECRET as string) as PortalPayload;
}

// ─── Invite supplier to portal ───────────────────────────────────────────────

export async function inviteSupplierToPortal(supplierId: string, companyId: string, password: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');
  if (!supplier.email) throw new Error('SUPPLIER_NO_EMAIL');

  const passwordHash = await bcrypt.hash(password, 12);
  const token = crypto.randomUUID();

  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      portalEnabled: true,
      portalPassword: passwordHash,
      portalToken: token,
    },
    select: { id: true, name: true, email: true, portalEnabled: true, portalToken: true },
  });
}

// ─── RFQs (Requisitions assigned to this supplier) ───────────────────────────

export async function getRFQsForSupplier(supplierId: string, companyId: string) {
  return prisma.requisition.findMany({
    where: {
      companyId,
      status: { in: ['APPROVED', 'QUOTED'] },
    },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
      portalResponses: {
        where: { supplierId },
        select: { id: true, status: true, submittedAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Submit quotation from portal ────────────────────────────────────────────

export async function submitPortalQuotation(
  supplierId: string,
  companyId: string,
  requisitionId: string,
  data: {
    notes?: string;
    validUntil?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; deliveryDays?: number; notes?: string }>;
  },
) {
  const requisition = await prisma.requisition.findFirst({
    where: { id: requisitionId, companyId },
  });
  if (!requisition) throw new Error('REQUISITION_NOT_FOUND');

  // Upsert portal response
  const existing = await prisma.portalQuotationResponse.findFirst({
    where: { supplierId, requisitionId },
  });

  if (existing) {
    // Update existing
    await prisma.portalQuotationItem.deleteMany({ where: { responseId: existing.id } });
    return prisma.portalQuotationResponse.update({
      where: { id: existing.id },
      data: {
        notes: data.notes,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            deliveryDays: i.deliveryDays,
            notes: i.notes,
          })),
        },
      },
      include: { items: true },
    });
  }

  return prisma.portalQuotationResponse.create({
    data: {
      supplierId,
      requisitionId,
      notes: data.notes,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          deliveryDays: i.deliveryDays,
          notes: i.notes,
        })),
      },
    },
    include: { items: true },
  });
}

// ─── My quotations ────────────────────────────────────────────────────────────

export async function getMyQuotations(supplierId: string) {
  return prisma.portalQuotationResponse.findMany({
    where: { supplierId },
    include: {
      requisition: { select: { id: true, reqNumber: true, title: true, status: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── My purchase orders (won quotations) ─────────────────────────────────────

export async function getMyPurchaseOrders(supplierId: string) {
  return prisma.purchaseOrder.findMany({
    where: { supplierId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Portal responses list (for ERP users) ────────────────────────────────────

export async function getPortalResponsesForRequisition(requisitionId: string, companyId: string) {
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, companyId } });
  if (!req) throw new Error('REQUISITION_NOT_FOUND');

  return prisma.portalQuotationResponse.findMany({
    where: { requisitionId },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  });
}
