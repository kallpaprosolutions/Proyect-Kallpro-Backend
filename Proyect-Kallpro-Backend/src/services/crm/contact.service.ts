import { prisma } from '../../lib/prisma';
// CrmContact schema fields:
//   firstName, lastName, title (NOT jobTitle), email
//   phoneE164 (NOT phone), whatsappId (NOT waId)
//   ownerUserId (NOT assignedTo), linkedinUrl, tags
//   leadScore (Int field), leadScores (relation CrmLeadScore[])

export interface CreateContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;        // maps to phoneE164
  waId?: string;         // maps to whatsappId
  jobTitle?: string;     // maps to title
  linkedinUrl?: string;
  tags?: string[];
  assignedTo?: string;   // maps to ownerUserId
  crmCompanyId?: string;
}

export async function createContact(companyId: string, data: CreateContactInput) {
  return prisma.crmContact.create({
    data: {
      companyId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phoneE164: data.phone,
      whatsappId: data.waId,
      title: data.jobTitle,
      linkedinUrl: data.linkedinUrl,
      tags: data.tags ?? [],
      ownerUserId: data.assignedTo,
      crmCompanyId: data.crmCompanyId,
    },
  });
}

export async function getContact(companyId: string, id: string) {
  return prisma.crmContact.findFirst({
    where: { id, companyId },
    include: {
      crmCompany: true,
      deals: { orderBy: { createdAt: 'desc' }, take: 5 },
      conversations: { orderBy: { updatedAt: 'desc' }, take: 3 },
      leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
    },
  });
}

export async function listContacts(companyId: string, filters?: {
  search?: string;
  stage?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = { companyId };
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phoneE164: { contains: filters.search } },
    ];
  }
  if (filters?.assignedTo) where.ownerUserId = filters.assignedTo;

  const [contacts, total] = await Promise.all([
    prisma.crmContact.findMany({
      where,
      include: {
        crmCompany: { select: { legalName: true } },
        leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    }),
    prisma.crmContact.count({ where }),
  ]);

  return { contacts, total };
}

export async function updateContact(companyId: string, id: string, data: Partial<CreateContactInput>) {
  return prisma.crmContact.updateMany({
    where: { id, companyId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phoneE164: data.phone }),
      ...(data.waId !== undefined && { whatsappId: data.waId }),
      ...(data.jobTitle !== undefined && { title: data.jobTitle }),
      ...(data.linkedinUrl !== undefined && { linkedinUrl: data.linkedinUrl }),
      ...(data.tags && { tags: data.tags }),
      ...(data.assignedTo !== undefined && { ownerUserId: data.assignedTo }),
      ...(data.crmCompanyId !== undefined && { crmCompanyId: data.crmCompanyId }),
    },
  });
}

export async function resolveOrCreateContact(
  companyId: string,
  identifier: { phone?: string; email?: string; waId?: string },
  data: Partial<CreateContactInput>,
) {
  const where: any = { companyId };
  if (identifier.waId) where.whatsappId = identifier.waId;
  else if (identifier.phone) where.phoneE164 = identifier.phone;
  else if (identifier.email) where.email = identifier.email;
  else throw new Error('Se requiere phone, email o waId para resolver contacto');

  const existing = await prisma.crmContact.findFirst({ where });
  if (existing) return existing;

  return prisma.crmContact.create({
    data: {
      companyId,
      firstName: data.firstName ?? 'Desconocido',
      lastName: data.lastName,
      email: identifier.email ?? data.email,
      phoneE164: identifier.phone ?? data.phone,
      whatsappId: identifier.waId ?? data.waId,
      tags: [],
    },
  });
}

export async function updateLeadScore(
  contactId: string,
  bantScores: { budget?: number; authority?: number; need?: number; timeline?: number },
) {
  // CrmLeadScore has no @@unique on contactId, use findFirst + update/create
  const existing = await prisma.crmLeadScore.findFirst({ where: { contactId } });

  const budgetScore = bantScores.budget ?? existing?.budgetScore ?? 0;
  const authorityScore = bantScores.authority ?? existing?.authorityScore ?? 0;
  const needScore = bantScores.need ?? existing?.needScore ?? 0;
  const timelineScore = bantScores.timeline ?? existing?.timelineScore ?? 0;
  const totalScore = Math.min(100, budgetScore + authorityScore + needScore + timelineScore);

  if (existing) {
    return prisma.crmLeadScore.update({
      where: { id: existing.id },
      data: { budgetScore, authorityScore, needScore, timelineScore, totalScore },
    });
  }
  return prisma.crmLeadScore.create({
    data: { contactId, budgetScore, authorityScore, needScore, timelineScore, totalScore },
  });
}

export async function getContactWithContext(id: string) {
  return prisma.crmContact.findUnique({
    where: { id },
    include: {
      crmCompany: true,
      deals: {
        where: { stage: { notIn: ['WON', 'LOST'] } },
        orderBy: { updatedAt: 'desc' },
      },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 3 } },
      },
      leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
    },
  });
}
