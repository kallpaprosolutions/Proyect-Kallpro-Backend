import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../api/crm';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ScoreBadge from '../../components/crm/ScoreBadge';
import LeadDetailPanel from '../../components/crm/LeadDetailPanel';
import { Magnet } from 'lucide-react';
import { SkeletonTable } from '../../components/ui/Skeleton';
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS, SOURCE_LABELS, fmtRelative,
} from '../../lib/crmLabels';

/**
 * Bandeja de leads (Sprint 13).
 *
 * Ordenada por score de forma predeterminada: la bandeja debe responder "¿a quién llamo
 * ahora?", no "¿qué entró último?". Los duplicados se muestran marcados en vez de
 * ocultarse, para que un humano decida si fusionar.
 */
export default function LeadsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');
  const [search, setSearch] = useState('');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = {
    status: status || undefined,
    grade: grade || undefined,
    search: search || undefined,
    onlyDuplicates: onlyDuplicates || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', filters],
    queryFn: () => crmApi.listLeads(filters).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['crm-lead-stats'],
    queryFn: () => crmApi.getLeadStats().then(r => r.data),
  });

  const rescoreAll = useMutation({
    mutationFn: () => crmApi.rescoreAllLeads().then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-lead-stats'] });
    },
  });

  const leads = data?.leads ?? [];
  const thresholds = stats?.thresholds;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Leads"
        subtitle="Captura, puntaje y conversión — ordenados por prioridad"
        icon={<Magnet className="w-5 h-5" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={rescoreAll.isPending}
            onClick={() => rescoreAll.mutate()}
            title="Aplica las reglas de puntaje vigentes a todos los leads abiertos"
          >
            Recalcular puntajes
          </Button>
        }
      />

      {/* ── Indicadores ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <StatTile label="Leads totales" value={stats.total} />
          <StatTile label="Calificados (SQL)" value={stats.sql} accent="text-emerald-600 dark:text-emerald-400" />
          <StatTile label="Marketing (MQL)" value={stats.mql} accent="text-blue-600 dark:text-blue-400" />
          <StatTile label="Puntaje promedio" value={stats.avgScore} />
          <StatTile
            label="Tasa de conversión"
            value={`${stats.conversionRate}%`}
            accent="text-brand-600 dark:text-brand-400"
          />
        </div>
      )}

      {stats?.duplicatesPending > 0 && !onlyDuplicates && (
        <button
          onClick={() => setOnlyDuplicates(true)}
          className="w-full mb-4 text-left px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <strong>{stats.duplicatesPending}</strong> lead(s) marcados como posible duplicado esperan revisión. Ver solo esos →
        </button>
      )}

      {/* ── Filtros ── */}
      <Card padding="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, empresa o teléfono…"
            aria-label="Buscar leads"
            className="flex-1 min-w-[220px] px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder:text-surface-400"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            aria-label="Filtrar por estado"
            className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
          >
            <option value="">Todos los estados</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={grade}
            onChange={e => setGrade(e.target.value)}
            aria-label="Filtrar por grado"
            className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
          >
            <option value="">Todos los grados</option>
            {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>Grado {g}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 px-2">
            <input
              type="checkbox"
              checked={onlyDuplicates}
              onChange={e => setOnlyDuplicates(e.target.checked)}
              className="rounded border-surface-300"
            />
            Solo duplicados
          </label>
        </div>
      </Card>

      {/* ── Lista ── */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Magnet className="w-5 h-5" />}
          title="Todavía no hay leads"
          hint="Publica un formulario de captura desde Configuración del CRM o crea un lead a mano."
          ctaText="Configurar captura"
          ctaTo="/crm/config"
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
                <tr className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Puntaje</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Capturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {leads.map((lead: any) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className="hover:bg-surface-50 dark:hover:bg-surface-700/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-surface-900 dark:text-white">
                        {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">
                        {lead.email ?? lead.phone ?? '—'}
                      </div>
                      {lead.isDuplicate && (
                        <Badge variant="warning" className="mt-1" dot>Posible duplicado</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                      <div>{lead.companyName ?? '—'}</div>
                      {lead.jobTitle && (
                        <div className="text-xs text-surface-500 dark:text-surface-400">{lead.jobTitle}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge
                        score={lead.score}
                        grade={lead.grade}
                        temperature={lead.temperature}
                        thresholds={thresholds}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={LEAD_STATUS_VARIANTS[lead.status] ?? 'neutral'}>
                        {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                      {lead.utmCampaign && (
                        <div className="text-xs text-surface-400">{lead.utmCampaign}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-500 dark:text-surface-400">
                      {fmtRelative(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.total > leads.length && (
            <div className="px-4 py-3 text-xs text-surface-500 border-t border-surface-100 dark:border-surface-700">
              Mostrando {leads.length} de {data.total} leads
            </div>
          )}
        </Card>
      )}

      {selectedId && (
        <LeadDetailPanel leadId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3">
      <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${accent ?? 'text-surface-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}
