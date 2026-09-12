import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { crmApi } from '../../api/crm';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import { LayoutDashboard, Users, Briefcase, DollarSign, TrendingUp, Inbox, Target } from 'lucide-react';
import { SkeletonStatCards, Skeleton } from '../../components/ui/Skeleton';

const STAGE_COLORS: Record<string, string> = {
  LEAD: '#6b7280',
  QUALIFIED: '#3b82f6',
  PROPOSAL: '#8b5cf6',
  NEGOTIATION: '#f59e0b',
  WON: '#10b981',
  LOST: '#ef4444',
};

export default function CRMDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => crmApi.getDashboard().then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: trend } = useQuery({
    queryKey: ['crm-forecast-trend'],
    queryFn: () => crmApi.getMonthlyTrend(6).then(r => r.data),
  });

  if (isLoading) return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <SkeletonStatCards count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
  if (!data) return null;

  const { contacts, deals, pipeline, dealsAtRisk, agents } = data;

  const pipelineChartData = pipeline?.byStage?.map((s: any) => ({
    stage: s.stage,
    count: s.count,
    value: s.totalValue,
    weighted: s.weightedValue,
    color: STAGE_COLORS[s.stage] ?? '#6b7280',
  })) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="CRM Dashboard"
        subtitle="Pipeline · Agentes IA · Forecast"
        icon={<LayoutDashboard className="w-5 h-5" />}
        actions={
          <>
            <Link to="/crm/inbox">
              <Button variant="outline" size="sm" icon={<Inbox className="w-4 h-4" />}>Inbox</Button>
            </Link>
            <Link to="/crm/pipeline">
              <Button size="sm" icon={<Target className="w-4 h-4" />}>Ver Pipeline</Button>
            </Link>
          </>
        }
      />

      {/* KPI Grid — colapsable */}
      <CollapsiblePanel id="crm-dashboard-kpis" title="Indicadores CRM" icon={LayoutDashboard}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Contactos"
            value={contacts?.total ?? 0}
            icon={<Users className="w-5 h-5" />}
            color="blue"
            trend={{ value: `+${contacts?.newThisMonth ?? 0} este mes`, positive: true }}
            index={0}
          />
          <StatCard
            label="Deals Abiertos"
            value={deals?.open ?? 0}
            icon={<Briefcase className="w-5 h-5" />}
            color="emerald"
            trend={{ value: `${deals?.wonThisMonth ?? 0} ganados`, positive: true }}
            index={1}
          />
          <StatCard
            label="Pipeline Total"
            value={`$${((pipeline?.totalValue ?? 0) / 1000).toFixed(0)}K`}
            icon={<DollarSign className="w-5 h-5" />}
            color="purple"
            trend={{ value: `$${((pipeline?.weightedValue ?? 0) / 1000).toFixed(0)}K pond.`, positive: true }}
            index={2}
          />
          <StatCard
            label="Conversión"
            value={`${deals?.conversionRate ?? 0}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="amber"
            trend={{ value: `Ticket $${(deals?.avgDealSize ?? 0).toLocaleString()}`, positive: true }}
            index={3}
          />
        </div>
      </CollapsiblePanel>

      {/* Pipeline Chart + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Pipeline por Etapa</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipelineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} width={50} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: 8 }}
                formatter={(v: any) => [`$${Number(v ?? 0).toLocaleString()}`, 'Valor']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pipelineChartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Tendencia Mensual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Array.isArray(trend) ? trend : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} width={50} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: 8 }}
                formatter={(v: any) => [`$${Number(v ?? 0).toLocaleString()}`, '']}
              />
              <Bar dataKey="wonValue" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganado" />
              <Bar dataKey="weightedForecast" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Forecast" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Deals at risk + Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dealsAtRisk?.length > 0 && (
          <Card>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-3">⚠️ Deals en Riesgo</h3>
            <div className="space-y-2">
              {dealsAtRisk.map((deal: any) => (
                <Link
                  key={deal.id}
                  to="/crm/pipeline"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 border border-surface-100 dark:border-surface-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-800 dark:text-white">{deal.name ?? deal.title}</p>
                    <p className="text-xs text-surface-500">{deal.crmCompany?.legalName ?? deal.contact?.firstName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-surface-900 dark:text-white">${Number(deal.amountUsd ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">{deal.stage}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-surface-800 dark:text-white">🤖 Actividad de Agentes</h3>
            <Link to="/crm/agents" className="text-xs text-brand-500 hover:text-brand-600 font-medium">Ver todos →</Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-700/50">
              <span className="text-sm text-surface-600 dark:text-surface-300">Invocaciones hoy</span>
              <span className="font-bold text-surface-900 dark:text-white text-lg">{agents?.runsToday ?? 0}</span>
            </div>
            <Link to="/crm/agents" className="block">
              <Button variant="outline" size="sm" className="w-full justify-center">
                Ver agentes IA
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
