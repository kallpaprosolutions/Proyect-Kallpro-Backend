import { prisma } from '../../lib/prisma';
// CrmConversation: ownerUserId (not assignedTo)
// CrmMessage: senderType (not isAI), sentAt (not createdAt for ordering)
//             no 'metadata' field
// CrmContact: phoneE164 (not phone)
// CrmCompany: legalName (not name)

export type MessageChannel = 'whatsapp' | 'telegram' | 'gmail' | 'internal' | 'phone';
export type MessageDirection = 'inbound' | 'outbound';

export async function createOrFindConversation(
  contactId: string,
  channel: MessageChannel,
  externalChatId?: string,
) {
  const existing = await prisma.crmConversation.findFirst({
    where: {
      contactId,
      channel,
      ...(externalChatId && { externalChatId }),
      status: { not: 'closed' },
    },
  });
  if (existing) return existing;

  // Get contact to retrieve companyId
  const contact = await prisma.crmContact.findUnique({
    where: { id: contactId },
    select: { companyId: true },
  });
  if (!contact) throw new Error('Contacto no encontrado');

  return prisma.crmConversation.create({
    data: {
      companyId: contact.companyId,
      contactId,
      channel,
      externalChatId,
      status: 'open',
    },
  });
}

export async function addMessage(
  conversationId: string,
  body: string,
  direction: MessageDirection,
  channel: MessageChannel,
  options?: {
    externalId?: string;
    isAI?: boolean;
    agentCode?: string;
    requiresApproval?: boolean;
  },
) {
  const [msg] = await prisma.$transaction([
    prisma.crmMessage.create({
      data: {
        conversationId,
        body,
        direction,
        channel,
        externalId: options?.externalId,
        senderType: options?.isAI ? 'ai_agent' : 'human',
        agentCode: options?.agentCode,
        requiresApproval: options?.requiresApproval ?? false,
        status: direction === 'outbound' ? 'sent' : 'delivered',
      },
    }),
    prisma.crmConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageBody: body.substring(0, 200),
        ...(direction === 'inbound' && { unreadCount: { increment: 1 } }),
      },
    }),
  ]);
  return msg;
}

export async function listConversations(
  companyId: string,
  filters?: {
    status?: string;
    channel?: MessageChannel;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  },
) {
  const where: any = { companyId };
  if (filters?.status) where.status = filters.status;
  if (filters?.channel) where.channel = filters.channel;
  if (filters?.assignedTo) where.ownerUserId = filters.assignedTo;

  const [conversations, total] = await Promise.all([
    prisma.crmConversation.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phoneE164: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    }),
    prisma.crmConversation.count({ where }),
  ]);

  return { conversations, total };
}

export async function getConversationThread(id: string, limit = 50) {
  const conversation = await prisma.crmConversation.findUnique({
    where: { id },
    include: {
      contact: {
        include: {
          crmCompany: { select: { legalName: true } },
          leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
          deals: {
            where: { stage: { notIn: ['WON', 'LOST', 'won', 'lost'] } },
            orderBy: { updatedAt: 'desc' },
            take: 3,
          },
        },
      },
      messages: {
        orderBy: { sentAt: 'desc' },
        take: limit,
      },
    },
  });

  if (!conversation) return null;

  return {
    ...conversation,
    messages: [...conversation.messages].reverse(),
  };
}

export async function updateConversationStatus(id: string, status: string) {
  return prisma.crmConversation.update({
    where: { id },
    data: { status },
  });
}

export async function approveAIMessage(messageId: string) {
  return prisma.crmMessage.update({
    where: { id: messageId },
    data: { requiresApproval: false, status: 'sent' },
  });
}
