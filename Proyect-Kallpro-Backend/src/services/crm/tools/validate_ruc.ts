import { AgentContext } from '../agents/base.agent';
import { validateRUC } from '../company.service';

export async function execute(args: { ruc: string }, _ctx: AgentContext) {
  return validateRUC(args.ruc);
}

export default execute;
