import { RouterAgent } from '../services/crm/agents/router.agent';
import { getConversationThread } from '../services/crm/conversation.service';
import { logger } from '../lib/logger';

export interface CrmRouterJobData {
  messageId: string;
  conversationId: string;
  companyId: string;
}

async function processJob(data: CrmRouterJobData): Promise<void> {
  const thread = await getConversationThread(data.conversationId, 10);
  if (!thread) {
    logger.warn(`[crm-router] Conversation ${data.conversationId} not found`, { conversationId: data.conversationId });
    return;
  }

  const lastMessage = thread.messages[thread.messages.length - 1];
  if (!lastMessage || lastMessage.direction !== 'INBOUND') return;

  const router = new RouterAgent();
  await router.invoke({
    companyId: data.companyId,
    contactId: thread.contactId ?? undefined,
    conversationId: data.conversationId,
    messageBody: lastMessage.body,
    channel: thread.channel,
  });
}

// BullMQ worker (used only if Redis is available)
let worker: any = null;

export async function startCrmRouterWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('[crm-router] Redis not configured, worker disabled');
    return;
  }

  try {
    const { Worker } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    worker = new Worker(
      'crm-router',
      async (job: any) => {
        await processJob(job.data as CrmRouterJobData);
      },
      {
        connection,
        concurrency: 3,
      },
    );

    worker.on('failed', (job: any, err: Error) => {
      logger.error('[crm-router] Job falló', { jobId: job?.id, err: err.message });
    });

    logger.info('[crm-router] BullMQ worker started (concurrency: 3)');
  } catch (err: any) {
    logger.warn('[crm-router] Failed to start BullMQ worker', { err: err.message });
  }
}

// Direct (non-queue) processing for when Redis is unavailable
export async function processDirectly(data: CrmRouterJobData): Promise<void> {
  return processJob(data);
}

export async function enqueueOrProcess(data: CrmRouterJobData): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    await processDirectly(data);
    return;
  }

  try {
    const { Queue } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue('crm-router', { connection });
    await queue.add('route-message', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  } catch {
    await processDirectly(data);
  }
}
