import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crmApi } from '../../api/crm';
import { LeadScoreGauge } from '../../components/crm/LeadScoreGauge';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';
import { Users } from 'lucide-react';
import { SkeletonTable } from '../../components/ui/Skeleton';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-contacts', search],
    queryFn: () => crmApi.listContacts({ search, limit: 50 }).then(r => r.data),
    staleTime: 10000,
  });

  const contacts = data?.contacts ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Contactos CRM"
        subtitle={`${data?.total ?? 0} contactos registrados`}
        icon={<Users className="w-5 h-5" />}
      />

      <div className="flex gap-6">
        {/* List */}
        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
            {isLoading ? (
              <SkeletonTable rows={5} cols={3} />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Contacto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {contacts.map((c: any) => {
                    const score = c.leadScores?.[0]?.totalScore ?? 0;
                    const scoreVariant = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'error';
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-brand-50 dark:hover:bg-brand-900/10 cursor-pointer transition-colors"
                        onClick={() => setSelected(c)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 text-xs font-bold flex-shrink-0">
                              {c.firstName?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <p className="font-medium text-surface-800 dark:text-white">{c.firstName} {c.lastName ?? ''}</p>
                              <p className="text-xs text-surface-400">{c.email ?? c.phoneE164 ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-surface-600 dark:text-surface-300 text-sm">
                          {c.crmCompany?.legalName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={scoreVariant} size="sm">{score}</Badge>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags as string[] ?? []).slice(0, 2).map((tag: string) => (
                              <Badge key={tag} variant="neutral" size="sm">{tag}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-surface-400">
                        Sin contactos encontrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Contact drawer */}
        {selected && (
          <div className="w-72 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 space-y-4 shrink-0 self-start sticky top-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold">
                  {selected.firstName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 dark:text-white text-sm">{selected.firstName} {selected.lastName ?? ''}</h3>
                  {selected.title && <p className="text-xs text-surface-500">{selected.title}</p>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors text-lg leading-none">×</button>
            </div>

            {selected.leadScores?.[0] && (
              <LeadScoreGauge
                score={selected.leadScores[0].totalScore ?? 0}
                bant={{
                  budget: selected.leadScores[0].budgetScore ?? 0,
                  authority: selected.leadScores[0].authorityScore ?? 0,
                  need: selected.leadScores[0].needScore ?? 0,
                  timeline: selected.leadScores[0].timelineScore ?? 0,
                }}
                size="sm"
              />
            )}

            <div className="space-y-2 text-sm">
              {selected.email && (
                <div className="flex items-center gap-2">
                  <span className="text-surface-400">📧</span>
                  <span className="text-surface-700 dark:text-surface-300 truncate">{selected.email}</span>
                </div>
              )}
              {selected.phoneE164 && (
                <div className="flex items-center gap-2">
                  <span className="text-surface-400">📱</span>
                  <span className="text-surface-700 dark:text-surface-300">{selected.phoneE164}</span>
                </div>
              )}
              {selected.crmCompany && (
                <div className="flex items-center gap-2">
                  <span className="text-surface-400">🏢</span>
                  <span className="text-surface-700 dark:text-surface-300">{selected.crmCompany.legalName}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-surface-400">Fuente: {selected.source ?? 'manual'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
