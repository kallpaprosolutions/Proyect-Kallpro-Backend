import { prisma } from '../../lib/prisma';
// CrmCompany schema fields:
//   legalName (NOT name), tradeName, ruc, industry (NOT sector)
//   size, employeesEst (NOT employeeCount), revenueEstUsd (NOT annualRevenue)
//   ownerUserId (NOT assignedTo), country, city, website, linkedinUrl

export interface CreateCrmCompanyInput {
  name: string;          // maps to legalName
  ruc?: string;
  sector?: string;       // maps to industry
  size?: string;
  website?: string;
  country?: string;
  city?: string;
  annualRevenue?: number; // maps to revenueEstUsd
  employeeCount?: number; // maps to employeesEst
  assignedTo?: string;   // maps to ownerUserId
}

export async function createCrmCompany(companyId: string, data: CreateCrmCompanyInput) {
  return prisma.crmCompany.create({
    data: {
      companyId,
      legalName: data.name,
      ruc: data.ruc,
      industry: data.sector,
      size: data.size,
      website: data.website,
      country: data.country ?? 'EC',
      city: data.city,
      revenueEstUsd: data.annualRevenue,
      employeesEst: data.employeeCount,
      ownerUserId: data.assignedTo,
    },
  });
}

export async function getCrmCompany(companyId: string, id: string) {
  return prisma.crmCompany.findFirst({
    where: { id, companyId },
    include: {
      contacts: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          phoneE164: true,
          email: true,
        },
      },
      deals: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

export async function listCrmCompanies(companyId: string, filters?: {
  search?: string;
  sector?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = { companyId };
  if (filters?.search) {
    where.OR = [
      { legalName: { contains: filters.search, mode: 'insensitive' } },
      { tradeName: { contains: filters.search, mode: 'insensitive' } },
      { ruc: { contains: filters.search } },
    ];
  }
  if (filters?.sector) where.industry = filters.sector;

  const [companies, total] = await Promise.all([
    prisma.crmCompany.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    }),
    prisma.crmCompany.count({ where }),
  ]);

  return { companies, total };
}

export async function updateCrmCompany(companyId: string, id: string, data: Partial<CreateCrmCompanyInput>) {
  return prisma.crmCompany.updateMany({
    where: { id, companyId },
    data: {
      ...(data.name && { legalName: data.name }),
      ...(data.ruc !== undefined && { ruc: data.ruc }),
      ...(data.sector !== undefined && { industry: data.sector }),
      ...(data.size !== undefined && { size: data.size }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.annualRevenue !== undefined && { revenueEstUsd: data.annualRevenue }),
      ...(data.employeeCount !== undefined && { employeesEst: data.employeeCount }),
      ...(data.assignedTo !== undefined && { ownerUserId: data.assignedTo }),
    },
  });
}

export async function resolveOrCreateCrmCompany(
  companyId: string,
  identifier: { ruc?: string; name?: string },
  data: Partial<CreateCrmCompanyInput>,
) {
  let existing = null;
  if (identifier.ruc) {
    existing = await prisma.crmCompany.findFirst({ where: { companyId, ruc: identifier.ruc } });
  } else if (identifier.name) {
    existing = await prisma.crmCompany.findFirst({
      where: { companyId, legalName: { equals: identifier.name, mode: 'insensitive' } },
    });
  }

  if (existing) return existing;

  return prisma.crmCompany.create({
    data: {
      companyId,
      legalName: identifier.name ?? data.name ?? 'Empresa sin nombre',
      ruc: identifier.ruc ?? data.ruc,
      industry: data.sector,
      size: data.size,
      country: data.country ?? 'EC',
    },
  });
}

export async function enrichCompany(
  id: string,
  enrichedData: Record<string, any>,
  buyingSignals?: string[],
) {
  const updateData: any = {};
  if (enrichedData.website) updateData.website = enrichedData.website;
  if (enrichedData.industry || enrichedData.sector) updateData.industry = enrichedData.industry ?? enrichedData.sector;
  if (enrichedData.employeeCount) updateData.employeesEst = enrichedData.employeeCount;
  if (enrichedData.annualRevenue) updateData.revenueEstUsd = enrichedData.annualRevenue;
  if (buyingSignals?.length) updateData.buyingSignals = buyingSignals;
  updateData.enrichedAt = new Date();

  return prisma.crmCompany.update({
    where: { id },
    data: updateData,
  });
}

export async function validateRUC(ruc: string): Promise<{ valid: boolean; message: string }> {
  if (!ruc || ruc.length !== 13) {
    return { valid: false, message: 'RUC debe tener 13 dígitos' };
  }
  if (!/^\d+$/.test(ruc)) {
    return { valid: false, message: 'RUC debe contener solo números' };
  }
  const tipoContribuyente = parseInt(ruc.substring(2, 3));
  if (![6, 9].includes(tipoContribuyente) && (tipoContribuyente < 0 || tipoContribuyente > 5)) {
    return { valid: false, message: 'Tercer dígito inválido para tipo de contribuyente' };
  }
  if (!ruc.endsWith('001')) {
    return { valid: false, message: 'RUC debe terminar en 001' };
  }
  return { valid: true, message: 'RUC válido' };
}
