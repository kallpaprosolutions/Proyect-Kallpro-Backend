import { prisma } from '../../../lib/prisma';
import axios from 'axios';
import { isAiEnabled } from '../../ollama.service';
export interface AgentContext {
  companyId: string;
  contactId?: string;
  conversationId?: string;
  dealId?: string;
  messageBody?: string;
  channel?: string;
  userId?: string;
  extra?: Record<string, any>;
}

export interface AgentResult {
  output: string;
  toolsCalled: string[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  requiresApproval?: boolean;
  approvalPayload?: any;
}

// Cost per 1M tokens (USD)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20251101': { input: 15.00, output: 75.00 },
};

function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 3.00, output: 15.00 };
  return (tokensIn * costs.input + tokensOut * costs.output) / 1_000_000;
}

export abstract class BaseAgent {
  protected code: string;
  protected config: any = null;

  constructor(code: string) {
    this.code = code;
  }

  protected async loadConfig(companyId: string): Promise<void> {
    this.config = await prisma.crmAgent.findFirst({
      where: { code: this.code, companyId },
    });
    if (!this.config) {
      // Try global config (no companyId filter)
      this.config = await prisma.crmAgent.findFirst({ where: { code: this.code } });
    }
    if (!this.config) throw new Error(`Agente '${this.code}' no configurado`);
  }

  protected async loadTool(name: string): Promise<(args: any, ctx: AgentContext) => Promise<any>> {
    try {
      const mod = await import(`../tools/${name}`);
      return mod.default ?? mod.execute;
    } catch {
      return async () => ({ error: `Tool '${name}' no disponible` });
    }
  }

  async invoke(context: AgentContext): Promise<AgentResult> {
    await this.loadConfig(context.companyId);
    const startedAt = Date.now();

    const runRecord = await prisma.crmAgentRun.create({
      data: {
        companyId: context.companyId,
        agentId: this.config.id,
        agentCode: this.code,
        status: 'running',
        inputContext: context as any,
        conversationId: context.conversationId,
        dealId: context.dealId,
      },
    });

    try {
      const result = await this.runAgenticLoop(context);
      const latencyMs = Date.now() - startedAt;

      await prisma.crmAgentRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'success',
          output: { output: result.output } as any,
          toolsCalled: result.toolsCalled,
          tokensInput: result.tokensIn,
          tokensOutput: result.tokensOut,
          costUsd: result.costUsd,
          latencyMs,
        },
      });

      return { ...result, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - startedAt;
      await prisma.crmAgentRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'failed',
          errorMessage: err.message,
          latencyMs,
        },
      });
      throw err;
    }
  }

  private async runAgenticLoop(context: AgentContext): Promise<AgentResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return this.runWithOllama(context);
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const model: string = this.config.model ?? 'claude-haiku-4-5-20251001';
    const tools: any[] = this.config.tools ?? [];
    const maxTokens: number = this.config.maxTokens ?? 1024;

    const messages: any[] = [
      { role: 'user', content: this.buildUserMessage(context) },
    ];

    let totalIn = 0;
    let totalOut = 0;
    const toolsCalled: string[] = [];
    let output = '';

    // Agentic loop (max 5 iterations)
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: this.config.systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        messages,
      });

      totalIn += response.usage.input_tokens;
      totalOut += response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b: any) => b.type === 'text') as any;
        output = textBlock?.text ?? '';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use') as any[];
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: any[] = [];
        for (const toolUse of toolUseBlocks) {
          toolsCalled.push(toolUse.name as string);
          const toolFn = await this.loadTool(toolUse.name as string);
          let toolResult: any;
          try {
            toolResult = await toolFn(toolUse.input, context);
          } catch (e: any) {
            toolResult = { error: e.message };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id as string,
            content: JSON.stringify(toolResult),
          });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      break;
    }

    const costUsd = calcCost(model, totalIn, totalOut);
    return { output, toolsCalled, tokensIn: totalIn, tokensOut: totalOut, costUsd, latencyMs: 0 };
  }

  private async runWithOllama(context: AgentContext): Promise<AgentResult> {
    // Respeta el interruptor maestro de IA: si está desactivado, corta de inmediato.
    if (!(await isAiEnabled())) {
      return { output: 'IA desactivada en Configuración.', toolsCalled: [], tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0 };
    }
    const ollamaUrl = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

    try {
      const res = await axios.post(`${ollamaUrl}/api/generate`, {
        model,
        prompt: `${this.config.systemPrompt}\n\nContexto: ${this.buildUserMessage(context)}`,
        stream: false,
        options: { temperature: this.config.temperature ?? 0.5, num_predict: 512 },
      }, { timeout: 30000 });

      return {
        output: res.data?.response ?? '',
        toolsCalled: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: 0,
      };
    } catch {
      return {
        output: 'Agente no disponible en este momento.',
        toolsCalled: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: 0,
      };
    }
  }

  protected buildUserMessage(context: AgentContext): string {
    const parts: string[] = [];
    if (context.messageBody) parts.push(`Mensaje: "${context.messageBody}"`);
    if (context.contactId) parts.push(`ContactoId: ${context.contactId}`);
    if (context.dealId) parts.push(`DealId: ${context.dealId}`);
    if (context.channel) parts.push(`Canal: ${context.channel}`);
    if (context.extra) parts.push(`Contexto extra: ${JSON.stringify(context.extra)}`);
    return parts.join('\n') || 'Procesar solicitud';
  }
}
