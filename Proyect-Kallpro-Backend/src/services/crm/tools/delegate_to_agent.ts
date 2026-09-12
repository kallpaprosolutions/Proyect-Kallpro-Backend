import { AgentContext } from '../agents/base.agent';

const AGENT_MAP: Record<string, string> = {
  sdr: 'SdrAgent',
  researcher: 'ResearcherAgent',
  copywriter: 'CopywriterAgent',
  closer: 'CloserAgent',
  success: 'SuccessAgent',
};

export async function execute(
  args: { agentCode: string; context?: Record<string, any> },
  ctx: AgentContext,
) {
  const code = args.agentCode?.toLowerCase();
  if (!AGENT_MAP[code]) {
    return { error: `Agente '${code}' no existe. Disponibles: ${Object.keys(AGENT_MAP).join(', ')}` };
  }

  try {
    const mod = await import(`./../agents/${code}.agent`);
    const AgentClass = mod.default ?? Object.values(mod)[0];
    const agent = new AgentClass();
    const mergedCtx: AgentContext = {
      ...ctx,
      ...(args.context ?? {}),
    };
    const result = await agent.invoke(mergedCtx);
    return { delegatedTo: code, result: result.output, toolsCalled: result.toolsCalled };
  } catch (err: any) {
    return { error: `Error al delegar a '${code}': ${err.message}` };
  }
}

export default execute;
