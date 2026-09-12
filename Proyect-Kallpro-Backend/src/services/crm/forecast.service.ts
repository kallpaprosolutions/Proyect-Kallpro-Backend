/**
 * Servicio de pronóstico de ventas (v2 · Sprint 13).
 *
 * Toda la aritmética vive en `engines/forecast.engine.ts` (motor puro con tests).
 * Aquí solo se consulta la BD y se guarda la foto del período.
 *
 * Por qué se guarda una foto (`CrmForecast`) cada vez que se consulta el mes en curso:
 * sin ella no hay forma de medir la precisión después. Cuando el mes cierra, comparar
 * "lo que dijimos que cerraríamos" contra "lo que cerramos" es lo único que convierte
 * el pronóstico en una herramienta de gestión en vez de un número decorativo.
 *
 * Antes de este sprint el cálculo usaba `STAGE_PROBABILITY`, una constante quemada en
 * `deal.service.ts`. Ahora las probabilidades y las categorías salen de
 * `CrmPipelineStage`, que el usuario edita desde la interfaz.
 */

import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import {
  calculateForecastV2, calculateAccuracy, calculateVelocity,
  ForecastResultV2, AccuracyResult, VelocityStage, DealInput,
  FORECAST_CATEGORIES, FORECAST_CATEGORY_LABELS, ACCURACY_BENCHMARKS,
  ForecastCategory,
} from './engines/forecast.engine';
import { getPipelineStages } from './crm-config.service';

export { FORECAST_CATEGORIES, FORECAST_CATEGORY_LABELS, ACCURACY_BENCHMARKS };

/** Rango [inicio, fin] del período "AAAA-MM". */
function periodRange(period?: string): { period: string; start: Date; end: Date } {
  const base = period ? new Date(`${period}-01T00:00:00`) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  return {
    period: `${year}-${String(month + 1).padStart(2, '0')}`,
    start: new Date(year, month, 1, 0, 0, 0),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

/**
 * Oportunidades que pertenecen al pronóstico del período:
 *   · las cerradas DENTRO del período (ganadas o perdidas), y
 *   · las abiertas con cierre esperado dentro del período o sin fecha de cierre.
 * Las abiertas con cierre esperado en otro mes no son de este pronóstico.
 */
async function dealsForPeriod(companyId: string, start: Date, end: Date): Promise<DealInput[]> {
  const stages = await getPipelineStages(companyId);
  const closedCodes = stages.filter(s => s.isWon || s.isLost).map(s => s.code);

  const rows = await prisma.crmDeal.findMany({
    where: {
      companyId,
      OR: [
        { closedAt: { gte: start, lte: end } },
        {
          stage: { notIn: closedCodes },
          closedAt: null,
          OR: [
            { expectedCloseDate: { gte: start, lte: end } },
            { expectedCloseDate: null },
          ],
        },
      ],
    },
    select: {
      id: true, name: true, stage: true, amountUsd: true, probability: true,
      forecastCategory: true, categoryOverride: true, expectedCloseDate: true,
      closedAt: true, lastActivityAt: true, ownerUserId: true,
    },
  });

  return rows.map(d => ({
    id: d.id,
    name: d.name,
    stage: d.stage,
    amountUsd: Number(d.amountUsd),
    probability: d.probability,
    forecastCategory: d.forecastCategory as ForecastCategory,
    categoryOverride: d.categoryOverride,
    expectedCloseDate: d.expectedCloseDate,
    closedAt: d.closedAt,
    lastActivityAt: d.lastActivityAt,
    ownerUserId: d.ownerUserId,
  }));
}

export async function getForecast(
  companyId: string,
  period?: string,
  quota?: number,
): Promise<ForecastResultV2 & { benchmarks: typeof ACCURACY_BENCHMARKS }> {
  const { period: periodStr, start, end } = periodRange(period);
  const [stages, deals] = await Promise.all([
    getPipelineStages(companyId),
    dealsForPeriod(companyId, start, end),
  ]);

  // La cuota se toma del parámetro o de la foto guardada; no se inventa.
  let effectiveQuota = quota;
  if (effectiveQuota === undefined) {
    const saved = await prisma.crmForecast.findFirst({ where: { companyId, period: periodStr } });
    effectiveQuota = saved ? Number(saved.quotaUsd) : 0;
  }

  const result = calculateForecastV2(periodStr, deals, stages, effectiveQuota);

  // Foto del período: se refresca mientras el período siga abierto.
  await saveSnapshot(companyId, result).catch(() => undefined);

  return { ...result, benchmarks: ACCURACY_BENCHMARKS };
}

/**
 * Compatibilidad: la firma antigua que usaba el controlador y el tablero.
 * Devuelve los campos del v1 más los del v2, para no romper a quien ya los leía.
 */
export async function calculateForecast(companyId: string, period?: string) {
  const v2 = await getForecast(companyId, period);
  return {
    ...v2,
    totalPipelineValue: v2.openPipeline,
    wonValue: v2.won,
    byStage: v2.byStage.map(s => ({
      stage: s.stage.toUpperCase(),
      label: s.label,
      count: s.count,
      value: s.amount,
      probability: s.probability,
      weighted: s.weighted,
    })),
  };
}

/** Guarda o refresca la foto. Un período marcado como cerrado ya no se toca. */
export async function saveSnapshot(companyId: string, result: ForecastResultV2) {
  const existing = await prisma.crmForecast.findFirst({
    where: { companyId, period: result.period },
  });

  if (existing?.isClosed) return existing;

  const data = {
    totalPipelineUsd: result.openPipeline,
    weightedFcstUsd: result.weightedForecast,
    wonUsd: result.won,
    commitUsd: result.commit,
    bestCaseUsd: result.bestCase,
    omittedUsd: result.omitted,
    quotaUsd: result.quota,
    coverageRatio: result.coverageRatio,
    byStage: result.byStage as any,
    byCategory: result.byCategory as any,
    calculatedAt: new Date(),
  };

  if (existing) {
    return prisma.crmForecast.update({ where: { id: existing.id }, data });
  }
  return prisma.crmForecast.create({ data: { companyId, period: result.period, ...data } });
}

/** Fija la cuota del período. */
export async function setQuota(companyId: string, period: string, quotaUsd: number) {
  if (quotaUsd < 0) throw AppError.badRequest('La cuota no puede ser negativa', 'INVALID_QUOTA');
  const existing = await prisma.crmForecast.findFirst({ where: { companyId, period } });
  if (existing) {
    return prisma.crmForecast.update({ where: { id: existing.id }, data: { quotaUsd } });
  }
  return prisma.crmForecast.create({ data: { companyId, period, quotaUsd } });
}

/**
 * Cierra el período: congela la foto y calcula la precisión definitiva.
 * A partir de aquí la foto ya no se refresca, que es justo lo que la hace comparable.
 */
export async function closePeriod(companyId: string, period: string) {
  const existing = await prisma.crmForecast.findFirst({ where: { companyId, period } });
  if (existing?.isClosed) {
    throw AppError.badRequest('Este período ya está cerrado', 'PERIOD_ALREADY_CLOSED');
  }
  if (!existing) {
    // Sin foto previa se genera una ahora, aunque el valor de comparación será pobre.
    await getForecast(companyId, period);
  }

  const fresh = await prisma.crmForecast.findFirst({ where: { companyId, period } });
  if (!fresh) throw AppError.notFound('No se pudo generar el pronóstico del período', 'FORECAST_NOT_FOUND');

  const { start, end } = periodRange(period);
  const stages = await getPipelineStages(companyId);
  const wonCodes = stages.filter(s => s.isWon).map(s => s.code);

  const won = await prisma.crmDeal.aggregate({
    where: { companyId, stage: { in: wonCodes }, closedAt: { gte: start, lte: end } },
    _sum: { amountUsd: true },
  });
  const actualWon = Number(won._sum.amountUsd ?? 0);

  const accuracy = calculateAccuracy(period, {
    commitUsd: Number(fresh.commitUsd),
    bestCaseUsd: Number(fresh.bestCaseUsd),
    weightedFcstUsd: Number(fresh.weightedFcstUsd),
  }, actualWon);

  return prisma.crmForecast.update({
    where: { id: fresh.id },
    data: {
      wonUsd: actualWon,
      commitAccuracy: accuracy.commitAccuracy,
      bestCaseAccuracy: accuracy.bestCaseAccuracy,
      isClosed: true,
    },
  });
}

/** Precisión del pronóstico de un período contra lo realmente ganado. */
export async function getAccuracy(companyId: string, period: string): Promise<AccuracyResult> {
  const snapshot = await prisma.crmForecast.findFirst({ where: { companyId, period } });
  const { start, end } = periodRange(period);
  const stages = await getPipelineStages(companyId);
  const wonCodes = stages.filter(s => s.isWon).map(s => s.code);

  const won = await prisma.crmDeal.aggregate({
    where: { companyId, stage: { in: wonCodes }, closedAt: { gte: start, lte: end } },
    _sum: { amountUsd: true },
  });

  return calculateAccuracy(
    period,
    {
      commitUsd: Number(snapshot?.commitUsd ?? 0),
      bestCaseUsd: Number(snapshot?.bestCaseUsd ?? 0),
      weightedFcstUsd: Number(snapshot?.weightedFcstUsd ?? 0),
    },
    Number(won._sum.amountUsd ?? 0),
  );
}

/** Velocidad por etapa a partir del historial real de cambios. */
export async function getVelocity(companyId: string, months = 6): Promise<VelocityStage[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [stages, history] = await Promise.all([
    getPipelineStages(companyId),
    prisma.crmDealStageHistory.findMany({
      where: { changedAt: { gte: since }, deal: { companyId } },
      select: { dealId: true, fromStage: true, toStage: true, changedAt: true },
      orderBy: { changedAt: 'asc' },
    }),
  ]);

  return calculateVelocity(history, stages);
}

/** Tendencia mensual: la foto guardada de los meses pasados, el cálculo en vivo del actual. */
export async function getMonthlyTrend(companyId: string, months = 6) {
  const now = new Date();
  const out: Array<{
    period: string; openPipeline: number; weightedForecast: number;
    commit: number; bestCase: number; won: number; quota: number; isClosed: boolean;
    // Alias del v1 para no romper a quien ya los consumía.
    totalPipelineValue: number; weightedForecastValue: number; wonValue: number;
  }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const snapshot = await prisma.crmForecast.findFirst({ where: { companyId, period } });

    const push = (v: { openPipeline: number; weightedForecast: number; commit: number; bestCase: number; won: number; quota: number; isClosed: boolean }) => {
      out.push({
        period, ...v,
        totalPipelineValue: v.openPipeline,
        weightedForecastValue: v.weightedForecast,
        wonValue: v.won,
      });
    };

    if (snapshot && (snapshot.isClosed || i > 0)) {
      push({
        openPipeline: Number(snapshot.totalPipelineUsd),
        weightedForecast: Number(snapshot.weightedFcstUsd),
        commit: Number(snapshot.commitUsd),
        bestCase: Number(snapshot.bestCaseUsd),
        won: Number(snapshot.wonUsd),
        quota: Number(snapshot.quotaUsd),
        isClosed: snapshot.isClosed,
      });
      continue;
    }

    const live = await getForecast(companyId, period);
    push({
      openPipeline: live.openPipeline,
      weightedForecast: live.weightedForecast,
      commit: live.commit,
      bestCase: live.bestCase,
      won: live.won,
      quota: live.quota,
      isClosed: false,
    });
  }

  return out;
}

/** Pronóstico desglosado por vendedor: quién sostiene el número del mes. */
export async function getForecastByOwner(companyId: string, period?: string) {
  const { period: periodStr, start, end } = periodRange(period);
  const [stages, deals] = await Promise.all([
    getPipelineStages(companyId),
    dealsForPeriod(companyId, start, end),
  ]);

  const owners = new Map<string, DealInput[]>();
  for (const d of deals) {
    const key = d.ownerUserId ?? '__sin_asignar__';
    if (!owners.has(key)) owners.set(key, []);
    owners.get(key)!.push(d);
  }

  const userIds = Array.from(owners.keys()).filter(k => k !== '__sin_asignar__');
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
    : [];
  const userById = new Map(users.map(u => [u.id, u]));

  return Array.from(owners.entries())
    .map(([ownerUserId, ownerDeals]) => {
      const f = calculateForecastV2(periodStr, ownerDeals, stages, 0);
      const user = userById.get(ownerUserId);
      return {
        ownerUserId: ownerUserId === '__sin_asignar__' ? null : ownerUserId,
        ownerName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Sin asignar',
        dealCount: f.dealCount,
        openPipeline: f.openPipeline,
        weightedForecast: f.weightedForecast,
        commit: f.commit,
        bestCase: f.bestCase,
        won: f.won,
        staleCount: f.staleDeals.length,
      };
    })
    .sort((a, b) => b.commit - a.commit);
}

/**
 * Cambia la categoría de pronóstico de una oportunidad a mano.
 * Marca `categoryOverride` para que un cambio de etapa posterior no la pise: el juicio
 * del vendedor sobre "esto cierra" pesa más que la etapa formal.
 */
export async function setDealCategory(companyId: string, dealId: string, category: string) {
  if (!FORECAST_CATEGORIES.includes(category as ForecastCategory)) {
    throw AppError.badRequest('Categoría de pronóstico inválida', 'INVALID_FORECAST_CATEGORY');
  }
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, companyId } });
  if (!deal) throw AppError.notFound('Oportunidad no encontrada', 'DEAL_NOT_FOUND');

  return prisma.crmDeal.update({
    where: { id: dealId },
    data: { forecastCategory: category, categoryOverride: true, lastActivityAt: new Date() },
  });
}

/** Quita la anulación manual: la oportunidad vuelve a heredar la categoría de su etapa. */
export async function clearDealCategoryOverride(companyId: string, dealId: string) {
  const [stages, deal] = await Promise.all([
    getPipelineStages(companyId),
    prisma.crmDeal.findFirst({ where: { id: dealId, companyId } }),
  ]);
  if (!deal) throw AppError.notFound('Oportunidad no encontrada', 'DEAL_NOT_FOUND');

  const stage = stages.find(s => s.code.toLowerCase() === deal.stage.toLowerCase());
  return prisma.crmDeal.update({
    where: { id: dealId },
    data: { categoryOverride: false, forecastCategory: stage?.forecastCategory ?? 'PIPELINE' },
  });
}
