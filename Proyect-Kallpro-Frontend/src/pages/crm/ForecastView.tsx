import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, ComposedChart, Line,
} from 'recharts';
import { crmApi } from '../../api/crm';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { TrendingUp } from 'lucide-react';
import { SkeletonStatCards, Skeleton } from '../../components/ui/Skeleton';
import {
  FORECAST_CATEGORY_COLORS, ACCURACY_VERDICT_LABELS, fmtUsd, fmtUsdFull,
} from '../../lib/crmLabels';

/**
 * Pronóstico de ventas v2 (Sprint 13).
 *
 * Deja de ser un ponderado decorativo y pasa a ser una herramienta de gestión:
 * categorías (Comprometido / Mejor caso / Pipeline), cobertura contra cuota, velocidad
 * por etapa, oportunidades estancadas y precisión histórica contra las referencias del
 * mercado.
 */
export default function ForecastView() {
  const qc = useQueryClient();
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentPeriod);
  const [quotaInput, setQuotaInput] = useState('');
  const [editingQuota, setEditingQuota] = useState(false);

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['crm-forecast', period],
    queryFn: () => crmApi.getForecast(period).then(r => r.data),
  });
  const { data: trend } = useQuery({
    queryKey: ['crm-forecast-trend'],
    queryFn: () => crmApi.getMonthlyTrend(6).then(r => r.data),
  });
  const { data: accuracy } = useQuery({
    queryKey: ['crm-forecast-accuracy', period],
    queryFn: () => crmApi.getForecastAccuracy(period).then(r => r.data),
  });
  const { data: velocity } = useQuery({
    queryKey: ['crm-forecast-velocity'],
    queryFn: () => crmApi.getVelocity(6).then(r => r.data),
  });
  const { data: byOwner } = useQuery({
    queryKey: ['crm-forecast-by-owner', period],
    queryFn: () => crmApi.getForecastByOwner(period).then(r => r.data),
  });

  const saveQuota = useMutation({
    mutationFn: (value: number) => crmApi.setQuota(period, value).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-forecast', period] });
      setEditingQuota(false);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <SkeletonStatCards count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const bench = forecast?.benchmarks;
  const staleDeals = forecast?.staleDeals ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Pronóstico de ventas"
        subtitle="Categorías, cobertura y precisión — no solo un ponderado"
        icon={<TrendingUp className="w-5 h-5" />}
        actions={
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            aria-label="Período del pronóstico"
            className="px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
          />
        }
      />

      <div className="space-y-6">
        {/* ── Los tres números que importan ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BigStat
            label="Comprometido"
            value={forecast?.commit ?? 0}
            tone="emerald"
            help="Lo que el equipo se compromete a cerrar este mes"
          />
          <BigStat
            label="Mejor caso"
            value={forecast?.bestCase ?? 0}
            tone="purple"
            help="Cerraría si todo sale bien"
          />
          <BigStat
            label="Ganado"
            value={forecast?.won ?? 0}
            tone="blue"
            help="Ya cerrado dentro del período"
          />
        </div>

        {/* ── Cobertura y cuota ── */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-surface-800 dark:text-white">Cobertura de pipeline</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Pipeline abierto dividido por la cuota. La referencia sana del mercado es{' '}
                {bench?.healthyCoverage ?? 3}×.
              </p>
            </div>
            {!editingQuota ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingQuota(true); setQuotaInput(String(forecast?.quota ?? 0)); }}
              >
                {forecast?.quota ? 'Cambiar cuota' : 'Fijar cuota'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={quotaInput}
                  onChange={e => setQuotaInput(e.target.value)}
                  aria-label="Cuota del período en USD"
                  className="w-36 px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                />
                <Button size="sm" loading={saveQuota.isPending} onClick={() => saveQuota.mutate(Number(quotaInput))}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingQuota(false)}>Cancelar</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <SmallStat label="Pipeline abierto" value={fmtUsd(forecast?.openPipeline ?? 0)} />
            <SmallStat label="Cuota" value={forecast?.quota ? fmtUsd(forecast.quota) : 'Sin fijar'} />
            <div>
              <p className="text-xs text-surface-400">Cobertura</p>
              <p className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">
                {forecast?.coverageStatus === 'sin_cuota' ? '—' : `${forecast?.coverageRatio}×`}
              </p>
              {forecast?.coverageStatus !== 'sin_cuota' && (
                <Badge variant={forecast?.coverageStatus === 'saludable' ? 'success' : 'warning'} className="mt-1">
                  {forecast?.coverageStatus === 'saludable' ? 'Saludable' : 'Insuficiente'}
                </Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-surface-400">Avance de cuota</p>
              <p className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">
                {forecast?.quota ? `${forecast.quotaAttainment} %` : '—'}
              </p>
              {forecast?.quota > 0 && (
                <div className="h-1.5 w-full rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, forecast.quotaAttainment)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Por categoría ── */}
        <Card>
          <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Pipeline por categoría</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={forecast?.byCategory ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtUsd} tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(v: any) => fmtUsdFull(v ?? 0)} />
              <Bar dataKey="amount" name="Monto" radius={[4, 4, 0, 0]}>
                {(forecast?.byCategory ?? []).map((entry: any) => (
                  <Cell key={entry.category} fill={FORECAST_CATEGORY_COLORS[entry.category] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Precisión ── */}
        {accuracy && accuracy.verdict !== 'sin_datos' && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-surface-800 dark:text-white">Precisión del pronóstico</h3>
              <Badge variant={accuracy.verdict === 'preciso' ? 'success' : 'warning'}>
                {ACCURACY_VERDICT_LABELS[accuracy.verdict] ?? accuracy.verdict}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <AccuracyStat label="Comprometido" value={accuracy.commitAccuracy} benchmark={bench?.commit} />
              <AccuracyStat label="Mejor caso" value={accuracy.bestCaseAccuracy} benchmark={bench?.bestCase} />
              <AccuracyStat label="Ponderado" value={accuracy.weightedAccuracy} benchmark={bench?.weighted} />
              <SmallStat
                label="Desviación"
                value={`${accuracy.variancePct > 0 ? '+' : ''}${accuracy.variancePct} %`}
              />
            </div>

            {accuracy.notes?.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {accuracy.notes.map((note: string, i: number) => (
                  <li
                    key={i}
                    className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ── Tendencia ── */}
        {trend && trend.length > 0 && (
          <Card>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-4">Tendencia de los últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtUsd} tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={(v: any) => fmtUsdFull(v ?? 0)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="commit" name="Comprometido" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="won" name="Ganado" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="quota" name="Cuota" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Velocidad ── */}
          {velocity && velocity.length > 0 && (
            <Card>
              <h3 className="font-semibold text-surface-800 dark:text-white mb-1">Velocidad por etapa</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
                Días promedio en cada etapa frente al objetivo configurado.
              </p>
              <ul className="space-y-2">
                {velocity.map((v: any) => (
                  <li key={v.stage} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-surface-800 dark:text-surface-200">{v.label}</p>
                      <p className="text-xs text-surface-400">
                        {v.sampleSize === 0 ? 'Sin datos aún' : `${v.sampleSize} oportunidad(es)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm tabular-nums text-surface-700 dark:text-surface-300">
                        {v.avgDays} / {v.targetDays} d
                      </span>
                      {v.sampleSize > 0 && (
                        <Badge variant={v.status === 'lento' ? 'warning' : 'success'}>
                          {v.status === 'lento' ? 'Lento' : 'En objetivo'}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ── Estancadas ── */}
          <Card>
            <h3 className="font-semibold text-surface-800 dark:text-white mb-1">Oportunidades estancadas</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
              Llevan más días sin actividad que el objetivo de su etapa.
            </p>
            {staleDeals.length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Ninguna oportunidad está estancada. Buen ritmo.
              </p>
            ) : (
              <ul className="space-y-2">
                {staleDeals.slice(0, 8).map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{d.name}</p>
                      <p className="text-xs text-surface-400">{fmtUsdFull(d.amountUsd)}</p>
                    </div>
                    <Badge variant="warning" className="flex-shrink-0">
                      {d.daysInactive} d sin actividad
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Por vendedor ── */}
        {byOwner && byOwner.length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
              <h3 className="font-semibold text-surface-800 dark:text-white">Pronóstico por vendedor</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">Quién sostiene el número del mes.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-900/50">
                  <tr className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    <th className="px-5 py-3">Vendedor</th>
                    <th className="px-5 py-3 text-right">Oportunidades</th>
                    <th className="px-5 py-3 text-right">Comprometido</th>
                    <th className="px-5 py-3 text-right">Mejor caso</th>
                    <th className="px-5 py-3 text-right">Ganado</th>
                    <th className="px-5 py-3 text-right">Estancadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {byOwner.map((o: any) => (
                    <tr key={o.ownerUserId ?? 'sin-asignar'}>
                      <td className="px-5 py-3 text-surface-800 dark:text-surface-200">{o.ownerName}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-surface-600 dark:text-surface-400">{o.dealCount}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{fmtUsd(o.commit)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-purple-600 dark:text-purple-400">{fmtUsd(o.bestCase)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtUsd(o.won)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-surface-600 dark:text-surface-400">
                        {o.staleCount > 0 ? <Badge variant="warning">{o.staleCount}</Badge> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
};

function BigStat({ label, value, tone, help }: { label: string; value: number; tone: string; help: string }) {
  return (
    <div className={`rounded-xl border p-5 ${TONES[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-black mt-1 tabular-nums">{fmtUsd(value)}</p>
      <p className="text-xs opacity-70 mt-1">{help}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

function AccuracyStat({ label, value, benchmark }: { label: string; value: number; benchmark?: number }) {
  const ok = benchmark !== undefined && value >= benchmark;
  return (
    <div>
      <p className="text-xs text-surface-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-900 dark:text-white'}`}>
        {value} %
      </p>
      {benchmark !== undefined && (
        <p className="text-xs text-surface-400">referencia {benchmark} %</p>
      )}
    </div>
  );
}
