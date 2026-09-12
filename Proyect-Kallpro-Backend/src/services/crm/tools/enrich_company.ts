import { AgentContext } from '../agents/base.agent';
import { enrichCompany } from '../company.service';

export async function execute(
  args: {
    companyId?: string;
    sector?: string;
    employeeCount?: number;
    annualRevenue?: number;
    website?: string;
    description?: string;
    buyingSignals?: string[];
  },
  ctx: AgentContext,
) {
  const id = args.companyId;
  if (!id) return { error: 'companyId requerido' };

  const updated = await enrichCompany(
    id,
    {
      sector: args.sector,
      employeeCount: args.employeeCount,
      annualRevenue: args.annualRevenue,
      website: args.website,
    },
    args.buyingSignals,
  );

  return {
    companyId: id,
    enriched: true,
    sector: args.sector,
    buyingSignals: args.buyingSignals ?? [],
  };
}

export default execute;
