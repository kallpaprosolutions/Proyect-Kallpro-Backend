import { Request } from 'express';
import {
  listConversations,
  getConversationThread,
  addMessage,
  updateConversationStatus,
  approveAIMessage,
  createOrFindConversation,
  MessageChannel,
} from '../../services/crm/conversation.service';
import { enqueueOrProcess } from '../../jobs/crm-router.worker';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';

export const listConversationsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const result = await listConversations(companyId, {
    status: req.query.status as string,
    channel: req.query.channel as MessageChannel,
    assignedTo: req.query.assignedTo as string,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(result);
});

export const getThreadHandler = asyncHandler(async (req: Request, res) => {
  const thread = await getConversationThread(req.params.id);
  if (!thread) throw AppError.notFound('Conversación no encontrada', 'CONVERSATION_NOT_FOUND');
  res.json(thread);
});

export const addMessageHandler = asyncHandler(async (req: Request, res) => {
  const { body, direction, channel } = req.body;
  if (!body) throw AppError.badRequest('body es requerido', 'VALIDATION_ERROR');

  const msg = await addMessage(
    req.params.id,
    body,
    (direction ?? 'outbound').toLowerCase() as 'inbound' | 'outbound',
    (channel ?? 'internal').toLowerCase() as MessageChannel,
    { isAI: false },
  );

  res.status(201).json(msg);
});

export const updateStatusHandler = asyncHandler(async (req: Request, res) => {
  const { status } = req.body;
  if (!status) throw AppError.badRequest('status es requerido', 'VALIDATION_ERROR');
  const result = await updateConversationStatus(req.params.id, status);
  res.json(result);
});

export const approveMessageHandler = asyncHandler(async (req: Request, res) => {
  const msg = await approveAIMessage(req.params.messageId);
  res.json(msg);
});

// Webhook from Unipile or other channel providers
export const inboundWebhookHandler = asyncHandler(async (req: Request, res) => {
  const payload = req.body;
  // Expected: { contactPhone, message, channel, externalChatId }
  // This is simplified — real Unipile webhooks have their own format
  res.status(200).json({ received: true });

  // Process async
  setImmediate(async () => {
    try {
      const { resolveOrCreateContact } = await import('../../services/crm/contact.service');
      const contactPhone = payload.from ?? payload.contactPhone;
      if (!contactPhone) return;

      // We'd need to know the companyId from the webhook routing
      // For now, skip if no companyId mapping
      const webhookCompanyId = payload.companyId ?? process.env.DEFAULT_COMPANY_ID;
      if (!webhookCompanyId) return;

      const contact = await resolveOrCreateContact(
        webhookCompanyId,
        { phone: contactPhone, waId: payload.waId },
        { firstName: payload.senderName ?? contactPhone },
      );

      const conv = await createOrFindConversation(
        contact.id,
        (payload.channel?.toLowerCase() ?? 'whatsapp') as MessageChannel,
        payload.externalChatId,
      );

      const msg = await addMessage(conv.id, payload.message ?? payload.body, 'inbound', conv.channel as MessageChannel, {
        externalId: payload.messageId,
      });

      await enqueueOrProcess({
        messageId: msg.id,
        conversationId: conv.id,
        companyId: webhookCompanyId,
      });
    } catch (err: any) {
      logger.error('[crm/webhook] processing error', { err: err.message });
    }
  });
});
