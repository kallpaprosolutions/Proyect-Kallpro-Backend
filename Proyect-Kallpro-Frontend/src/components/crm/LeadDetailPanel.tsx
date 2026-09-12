import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../api/crm';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ScoreBadge from './ScoreBadge';
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS, SOURCE_LABELS,
  SCORING_CATEGORY_LABELS, fmtDate, fmtRelative,
} from '../../lib/crmLabels';

/**
 * Panel lateral del lead: datos, atribución, desglose del puntaje y acciones.
 *
 * El desglose del puntaje es lo que hace usable al motor de reglas. Un vendedor no
 * confía en un "72" sin explicación; sí confía en "Cargo decisor +25, Vio precios +15,
 * Correo personal -10".
 */
export default function LeadDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [showConvert, setShowConvert] = useState(false);
  const [dealName, setDealName] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [showDisqualify, setShowDisqualify] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm-lead', leadId],
    queryFn: () => crmApi.getLead(leadId).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['crm-lead-stats'],
    queryFn: () => crmApi.getLeadStats().then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['crm-lead', leadId] });
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
    qc.invalidateQueries({ queryKey: ['crm-lead-stats'] });
  };

  const rescore = useMutation({
    mutationFn: () => crmApi.rescoreLead(leadId).then(r => r.data),
    onSuccess: invalidate,
  });

  const convert = useMutation({
    mutationFn: () => crmApi.convertLead(leadId, {
      createDeal: true,
      dealName: dealName || undefined,
      dealAmount: dealAmount ? Number(dealAmount) : undefined,
    }).then(r => r.data),
    onSuccess: () => { invalidate(); setShowConvert(false); },
  });

  const disqualify = useMutation({
    mutationFn: () => crmApi.disqualifyLead(leadId, disqualifyReason).then(r => r.data),
    onSuccess: () => { invalidate(); setShowDisqualify(false); },
  });

  const errorOf = (m: { error: unknown }) =>
    (m.error as any)?.response?.data?.message ?? (m.error as any)?.response?.data?.error ?? null;

  const breakdown: any[] = lead?.scoreBreakdown ?? [];
  const isClosed = lead?.status === 'CONVERTED' || lead?.status === 'DISQUALIFIED';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Detalle del lead">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar panel" />

      <div className="relative w-full max-w-lg h-full bg-white dark:bg-surface-800 shadow-xl overflow-y-auto">
        {isLoading || !lead ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Cabecera ── */}
            <div className="sticky top-0 z-10 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-white truncate">
                    {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                  </h2>
                  <p className="text-sm text-surface-500 dark:text-surface-400 truncate">
                    {lead.jobTitle ? `${lead.jobTitle} · ` : ''}{lead.companyName ?? 'Sin empresa'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 text-xl leading-none px-1"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <ScoreBadge
                  score={lead.score}
                  grade={lead.grade}
                  temperature={lead.temperature}
                  thresholds={stats?.thresholds}
                />
                <Badge variant={LEAD_STATUS_VARIANTS[lead.status] ?? 'neutral'}>
                  {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                </Badge>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* ── Aviso de duplicado ── */}
              {lead.isDuplicate && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Posible duplicado ({lead.dedupeScore} % de confianza)
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{lead.dedupeReason}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    No se fusionó automáticamente: revisa y decide tú si es la misma persona.
                  </p>
                </div>
              )}

              {/* ── Datos de contacto ── */}
              <Section title="Contacto">
                <Field label="Correo" value={lead.email} />
                <Field label="Teléfono" value={lead.phone} />
                <Field label="RUC" value={lead.ruc} />
                <Field label="Ciudad" value={lead.city} />
                <Field label="Sitio web" value={lead.website} />
                <Field label="Responsable" value={lead.ownerUserId ? 'Asignado' : 'Sin asignar'} />
              </Section>

              {lead.message && (
                <Section title="Mensaje">
                  <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap col-span-2">
                    {lead.message}
                  </p>
                </Section>
              )}

              {/* ── Desglose del puntaje ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                    Por qué tiene este puntaje
                  </h3>
                  <Button variant="ghost" size="sm" loading={rescore.isPending} onClick={() => rescore.mutate()}>
                    Recalcular
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <MiniStat label="Perfil (fit)" value={lead.fitScore} />
                  <MiniStat label="Interacción" value={lead.engageScore} />
                </div>

                {breakdown.length === 0 ? (
                  <p className="text-sm text-surface-400">
                    Ninguna regla se aplicó todavía. Revisa las reglas en Configuración del CRM.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {breakdown.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-900/40"
                      >
                        <div className="min-w-0">
                          <p className="text-surface-800 dark:text-surface-200 truncate">{item.ruleName}</p>
                          <p className="text-xs text-surface-400">
                            {SCORING_CATEGORY_LABELS[item.category] ?? item.category}
                            {item.decayFactor < 1 && ` · decaído al ${Math.round(item.decayFactor * 100)} %`}
                          </p>
                        </div>
                        <span
                          className={`font-semibold tabular-nums flex-shrink-0 ${
                            item.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {item.points >= 0 ? '+' : ''}{item.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {lead.scoredAt && (
                  <p className="text-xs text-surface-400 mt-2">Calculado {fmtRelative(lead.scoredAt)}</p>
                )}
              </div>

              {/* ── Atribución ── */}
              <Section title="Origen y atribución">
                <Field label="Origen" value={SOURCE_LABELS[lead.source] ?? lead.source} />
                <Field label="Formulario" value={lead.form?.name} />
                <Field label="Campaña" value={lead.utmCampaign} />
                <Field label="Fuente" value={lead.utmSource} />
                <Field label="Medio" value={lead.utmMedium} />
                <Field label="Capturado" value={fmtDate(lead.createdAt)} />
              </Section>

              {/* ── Historial de eventos ── */}
              {lead.events?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">
                    Actividad ({lead.events.length})
                  </h3>
                  <ul className="space-y-1">
                    {lead.events.slice(0, 10).map((ev: any) => (
                      <li key={ev.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-surface-700 dark:text-surface-300">{ev.eventType}</span>
                        <span className="text-xs text-surface-400">{fmtRelative(ev.occurredAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Acciones ── */}
              {!isClosed && (
                <div className="border-t border-surface-200 dark:border-surface-700 pt-4 space-y-3">
                  {!showConvert && !showDisqualify && (
                    <div className="flex gap-2">
                      <Button onClick={() => setShowConvert(true)} className="flex-1">
                        Convertir en oportunidad
                      </Button>
                      <Button variant="outline" onClick={() => setShowDisqualify(true)}>
                        Descartar
                      </Button>
                    </div>
                  )}

                  {showConvert && (
                    <div className="space-y-2 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        Se crearán el contacto, la empresa y la oportunidad.
                      </p>
                      <input
                        value={dealName}
                        onChange={e => setDealName(e.target.value)}
                        placeholder="Nombre de la oportunidad (opcional)"
                        aria-label="Nombre de la oportunidad"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min="0"
                        value={dealAmount}
                        onChange={e => setDealAmount(e.target.value)}
                        placeholder="Monto estimado en USD (opcional)"
                        aria-label="Monto estimado"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                      />
                      {errorOf(convert) && (
                        <p className="text-xs text-red-600 dark:text-red-400">{errorOf(convert)}</p>
                      )}
                      <div className="flex gap-2">
                        <Button loading={convert.isPending} onClick={() => convert.mutate()} className="flex-1">
                          Confirmar conversión
                        </Button>
                        <Button variant="ghost" onClick={() => setShowConvert(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  {showDisqualify && (
                    <div className="space-y-2 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                      <input
                        value={disqualifyReason}
                        onChange={e => setDisqualifyReason(e.target.value)}
                        placeholder="Motivo del descarte"
                        aria-label="Motivo del descarte"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                      />
                      {errorOf(disqualify) && (
                        <p className="text-xs text-red-600 dark:text-red-400">{errorOf(disqualify)}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          loading={disqualify.isPending}
                          disabled={disqualifyReason.trim().length < 3}
                          onClick={() => disqualify.mutate()}
                          className="flex-1"
                        >
                          Descartar lead
                        </Button>
                        <Button variant="ghost" onClick={() => setShowDisqualify(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lead.status === 'CONVERTED' && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  Convertido {fmtRelative(lead.convertedAt)}. Trabaja desde la oportunidad creada.
                </div>
              )}
              {lead.status === 'DISQUALIFIED' && (
                <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/40 px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                  Descartado: {lead.disqualifyReason ?? 'sin motivo registrado'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-surface-400">{label}</dt>
      <dd className="text-sm text-surface-800 dark:text-surface-200 break-words">{value || '—'}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-50 dark:bg-surface-900/40 px-3 py-2">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-lg font-semibold text-surface-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}
