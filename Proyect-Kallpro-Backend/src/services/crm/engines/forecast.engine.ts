/**
 * Motor de pronóstico de ventas — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Sustituye al ponderado ingenuo por etapa. Implementa el método que usan Salesforce,
 * HubSpot y los equipos de RevOps serios: CATEGORÍAS DE PRONÓSTICO.
 *
 *   PIPELINE  — oportunidades tempranas, baja probabilidad.
 *   BEST_CASE — cerrarían si todo sale bien.
 *   COMMIT    — el vendedor se compromete: cierran este período.
 *   CLOSED    — ya ganadas en el período.
 *   OMITTED   — excluidas a propósito (perdidas, pospuestas, basura).
 *
 * Por qué importa: el ponderado por etapa es una media que nunca ocurre; el vendedor no
 * puede comprometerse con "el 50 % de una oportunidad". Las categorías obligan a un juicio
 * binario y ese juicio se puede MEDIR después contra lo realmente cerrado.
 *
 * Referencias de precisión (medianas B2B 2026, usadas como semáforo):
 *   Commit ≈ 85 % · Best Case ≈ 38 % · ponderado ≈ 22 %.
 *   Un Best Case > 55 % indica sub-pronóstico (el vendedor esconde oportunidades).
 *   Varianza > ±25 % es bandera roja.
 * Cobertura de pipeline sana: 3x la cuota.
 */

export type ForecastCategory = 'PIPELINE' | 'BEST_CASE' | 'COMMIT' | 'CLOSED' | 'OMITTED';

export const FORECAST_CATEGORIES: ForecastCategory[] = [
  'PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED',
];

export const FORECAST_CATEGORY_LABELS: Record<ForecastCategory, string> = {
  PIPELINE: 'Pipeline',
  BEST_CASE: 'Mejor caso',
  COMMIT: 'Comprometido',
  CLOSED: 'Cerrado',
  OMITTED: 'Omitido',
};

/** Referencias de precisión de la industria (%), para el semáforo de la interfaz. */
export const ACCURACY_BENCHMARKS = {
  commit: 85,
  bestCase: 38,
  weighted: 22,
  /** Por encima de esto, el vendedor está sub-pronosticando su mejor caso. */
  bestCaseOverAchievement: 55,
  /** Varianza tolerable del pronóstico total (%). */
  varianceRedFlag: 25,
  /** Cobertura de pipeline sana (veces la cuota). */
  healthyCoverage: 3,
};

export interface StageConfigInput {
  code: string;
  name: string;
  sequence: number;
  probability: number;
  forecastCategory: ForecastCategory;
  isWon: boolean;
  isLost: boolean;
  targetDays: number;
}

export interface DealInput {
  id: string;
  name: string;
  stage: string;
  amountUsd: number;
  probability: number;
  forecastCategory?: ForecastCategory | null;
  categoryOverride?: boolean;
  expectedCloseDate?: Date | null;
  closedAt?: Date | null;
  lastActivityAt?: Date | null;
  ownerUserId?: string | null;
}

export interface CategoryBucket {
  category: ForecastCategory;
  label: string;
  count: number;
  amount: number;
  weighted: number;
}

export interface StageBucket {
  stage: string;
  label: string;
  sequence: number;
  count: number;
  amount: number;
  probability: number;
  weighted: number;
}

export interface StaleDeal {
  id: string;
  name: string;
  stage: string;
  amountUsd: number;
  daysInactive: number;
  targetDays: number;
  ownerUserId?: string | null;
}

export interface ForecastResultV2 {
  period: string;
  /** Suma de todo lo abierto (ni ganado ni perdido ni omitido). */
  openPipeline: number;
  /** Suma amount × probabilidad de todo lo abierto. */
  weightedForecast: number;
  commit: number;
  bestCase: number;
  /** commit + bestCase + ganado: el número que se lleva al comité. */
  committedPlusUpside: number;
  won: number;
  omitted: number;
  quota: number;
  /** pipeline abierto ÷ cuota. 0 si no hay cuota. */
  coverageRatio: number;
  coverageStatus: 'sin_cuota' | 'insuficiente' | 'saludable';
  /** % de la cuota ya ganado. */
  quotaAttainment: number;
  /** Cuánto falta para la cuota tras descontar lo ganado. */
  gapToQuota: number;
  byCategory: CategoryBucket[];
  byStage: StageBucket[];
  dealCount: number;
  avgDealSize: number;
  staleDeals: StaleDeal[];
}

/** Categoría que le toca a una oportunidad: la manual manda sobre la de su etapa. */
export function resolveCategory(deal: DealInput, stages: StageConfigInput[]): ForecastCategory {
  if (deal.categoryOverride && deal.forecastCategory) return deal.forecastCategory;
  const stage = stages.find(s => s.code.toLowerCase() === String(deal.stage).toLowerCase());
  if (stage) return stage.forecastCategory;
  return (deal.forecastCategory as ForecastCategory) ?? 'PIPELINE';
}

function isOpenStage(stage: StageConfigInput | undefined): boolean {
  if (!stage) return true; // etapa desconocida: se trata como abierta, es lo conservador
  return !stage.isWon && !stage.isLost;
}

/**
 * Calcula el pronóstico del período.
 *
 * @param deals  oportunidades ya filtradas por período por el servicio (las abiertas con
 *               cierre esperado en el período + las cerradas dentro del período)
 * @param now    inyectable para tests deterministas
 */
export function calculateForecastV2(
  period: string,
  deals: DealInput[],
  stages: StageConfigInput[],
  quota = 0,
  now: Date = new Date(),
): ForecastResultV2 {
  const stageByCode = new Map(stages.map(s => [s.code.toLowerCase(), s]));

  const categoryTotals = new Map<ForecastCategory, CategoryBucket>();
  for (const c of FORECAST_CATEGORIES) {
    categoryTotals.set(c, { category: c, label: FORECAST_CATEGORY_LABELS[c], count: 0, amount: 0, weighted: 0 });
  }

  const stageTotals = new Map<string, StageBucket>();
  for (const s of stages) {
    stageTotals.set(s.code.toLowerCase(), {
      stage: s.code, label: s.name, sequence: s.sequence,
      count: 0, amount: 0, probability: s.probability, weighted: 0,
    });
  }

  let openPipeline = 0;
  let weightedForecast = 0;
  let won = 0;
  const staleDeals: StaleDeal[] = [];

  for (const deal of deals) {
    const amount = Number(deal.amountUsd) || 0;
    const stageKey = String(deal.stage).toLowerCase();
    const stage = stageByCode.get(stageKey);
    // La probabilidad de la etapa manda sobre la guardada en la oportunidad: si el
    // usuario reconfigura sus etapas, el pronóstico debe reflejarlo sin migrar filas.
    const probability = stage?.probability ?? deal.probability ?? 0;
    const weighted = amount * (probability / 100);

    // ── Acumulado por etapa ──
    if (!stageTotals.has(stageKey)) {
      stageTotals.set(stageKey, {
        stage: deal.stage, label: deal.stage, sequence: 999,
        count: 0, amount: 0, probability, weighted: 0,
      });
    }
    const sb = stageTotals.get(stageKey)!;
    sb.count++;
    sb.amount += amount;
    sb.weighted += weighted;

    // ── Acumulado por categoría ──
    const category = resolveCategory(deal, stages);
    const cb = categoryTotals.get(category)!;
    cb.count++;
    cb.amount += amount;
    cb.weighted += weighted;

    if (stage?.isWon) {
      won += amount;
    } else if (isOpenStage(stage) && category !== 'OMITTED') {
      openPipeline += amount;
      weightedForecast += weighted;

      // ── Estancamiento: días sin actividad frente al objetivo de la etapa ──
      const last = deal.lastActivityAt ?? null;
      if (last) {
        const daysInactive = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
        const target = stage?.targetDays ?? 14;
        if (daysInactive > target) {
          staleDeals.push({
            id: deal.id, name: deal.name, stage: deal.stage,
            amountUsd: amount, daysInactive, targetDays: target,
            ownerUserId: deal.ownerUserId,
          });
        }
      }
    }
  }

  const byCategory = FORECAST_CATEGORIES.map(c => {
    const b = categoryTotals.get(c)!;
    return { ...b, amount: round2(b.amount), weighted: round2(b.weighted) };
  });

  const byStage = Array.from(stageTotals.values())
    .sort((a, b) => a.sequence - b.sequence)
    .map(b => ({ ...b, amount: round2(b.amount), weighted: round2(b.weighted) }));

  const commit = categoryTotals.get('COMMIT')!.amount;
  const bestCase = categoryTotals.get('BEST_CASE')!.amount;
  const omitted = categoryTotals.get('OMITTED')!.amount;

  const coverageRatio = quota > 0 ? openPipeline / quota : 0;
  const coverageStatus: ForecastResultV2['coverageStatus'] =
    quota <= 0 ? 'sin_cuota'
    : coverageRatio >= ACCURACY_BENCHMARKS.healthyCoverage ? 'saludable'
    : 'insuficiente';

  const dealCount = deals.length;

  return {
    period,
    openPipeline: round2(openPipeline),
    weightedForecast: round2(weightedForecast),
    commit: round2(commit),
    bestCase: round2(bestCase),
    committedPlusUpside: round2(commit + bestCase + won),
    won: round2(won),
    omitted: round2(omitted),
    quota: round2(quota),
    coverageRatio: Math.round(coverageRatio * 100) / 100,
    coverageStatus,
    quotaAttainment: quota > 0 ? Math.round((won / quota) * 100) : 0,
    gapToQuota: round2(Math.max(0, quota - won)),
    byCategory,
    byStage,
    dealCount,
    avgDealSize: dealCount > 0 ? round2(deals.reduce((s, d) => s + (Number(d.amountUsd) || 0), 0) / dealCount) : 0,
    staleDeals: staleDeals.sort((a, b) => b.daysInactive - a.daysInactive).slice(0, 20),
  };
}

export interface AccuracyResult {
  period: string;
  commitForecast: number;
  bestCaseForecast: number;
  weightedForecast: number;
  actualWon: number;
  /** actual ÷ pronosticado, en %. >100 = se superó lo prometido. */
  commitAccuracy: number;
  bestCaseAccuracy: number;
  weightedAccuracy: number;
  /** Desviación del comprometido respecto de lo real, en % (con signo). */
  variancePct: number;
  verdict: 'preciso' | 'sub_pronostico' | 'sobre_pronostico' | 'sin_datos';
  notes: string[];
}

/**
 * Compara la foto guardada del pronóstico contra lo realmente ganado.
 * Sin la foto (CrmForecast del período) esto no se puede calcular: por eso el servicio
 * guarda un snapshot cada vez que se consulta el pronóstico del mes en curso.
 */
export function calculateAccuracy(
  period: string,
  snapshot: { commitUsd: number; bestCaseUsd: number; weightedFcstUsd: number },
  actualWon: number,
): AccuracyResult {
  const commitForecast = Number(snapshot.commitUsd) || 0;
  const bestCaseForecast = Number(snapshot.bestCaseUsd) || 0;
  const weightedForecast = Number(snapshot.weightedFcstUsd) || 0;
  const notes: string[] = [];

  if (commitForecast <= 0 && bestCaseForecast <= 0 && weightedForecast <= 0) {
    return {
      period, commitForecast, bestCaseForecast, weightedForecast, actualWon,
      commitAccuracy: 0, bestCaseAccuracy: 0, weightedAccuracy: 0, variancePct: 0,
      verdict: 'sin_datos',
      notes: ['No hay foto de pronóstico guardada para este período.'],
    };
  }

  const pct = (actual: number, forecast: number) =>
    forecast > 0 ? Math.round((actual / forecast) * 1000) / 10 : 0;

  const commitAccuracy = pct(actualWon, commitForecast);
  const bestCaseAccuracy = pct(actualWon, bestCaseForecast);
  const weightedAccuracy = pct(actualWon, weightedForecast);

  const variancePct = commitForecast > 0
    ? Math.round(((actualWon - commitForecast) / commitForecast) * 1000) / 10
    : 0;

  let verdict: AccuracyResult['verdict'] = 'preciso';
  if (Math.abs(variancePct) > ACCURACY_BENCHMARKS.varianceRedFlag) {
    verdict = variancePct > 0 ? 'sub_pronostico' : 'sobre_pronostico';
    notes.push(
      variancePct > 0
        ? `Se cerró ${variancePct.toFixed(1)} % por encima de lo comprometido: el equipo está escondiendo oportunidades.`
        : `Se cerró ${Math.abs(variancePct).toFixed(1)} % por debajo de lo comprometido: los criterios de Comprometido son demasiado laxos.`,
    );
  }

  if (bestCaseAccuracy > ACCURACY_BENCHMARKS.bestCaseOverAchievement) {
    notes.push(
      `La precisión de Mejor caso (${bestCaseAccuracy.toFixed(1)} %) supera el ${ACCURACY_BENCHMARKS.bestCaseOverAchievement} %: bandera roja de sub-pronóstico.`,
    );
  }

  if (commitAccuracy > 0 && commitAccuracy < ACCURACY_BENCHMARKS.commit - 15) {
    notes.push(
      `La precisión de Comprometido (${commitAccuracy.toFixed(1)} %) está muy por debajo de la referencia (${ACCURACY_BENCHMARKS.commit} %). Documenta criterios de entrada a la etapa.`,
    );
  }

  return {
    period, commitForecast, bestCaseForecast, weightedForecast, actualWon,
    commitAccuracy, bestCaseAccuracy, weightedAccuracy, variancePct, verdict, notes,
  };
}

export interface VelocityStage {
  stage: string;
  label: string;
  sequence: number;
  /** Días promedio que las oportunidades pasaron en la etapa. */
  avgDays: number;
  targetDays: number;
  /** Oportunidades que pasaron por la etapa en la muestra. */
  sampleSize: number;
  status: 'ok' | 'lento';
}

export interface StageTransition {
  dealId: string;
  fromStage: string | null;
  toStage: string;
  changedAt: Date;
}

/**
 * Velocidad por etapa a partir del historial de cambios de etapa.
 * El tiempo en una etapa es la diferencia entre el cambio que entró a ella y el siguiente
 * cambio de esa misma oportunidad. La última etapa de cada oportunidad no cuenta (aún
 * está dentro) salvo que se pase `now` y se quiera medir la permanencia actual.
 */
export function calculateVelocity(
  transitions: StageTransition[],
  stages: StageConfigInput[],
): VelocityStage[] {
  const byDeal = new Map<string, StageTransition[]>();
  for (const t of transitions ?? []) {
    if (!byDeal.has(t.dealId)) byDeal.set(t.dealId, []);
    byDeal.get(t.dealId)!.push(t);
  }

  const durations = new Map<string, number[]>();

  for (const list of byDeal.values()) {
    const sorted = [...list].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const key = String(sorted[i].toStage).toLowerCase();
      const days = (sorted[i + 1].changedAt.getTime() - sorted[i].changedAt.getTime()) / 86_400_000;
      if (days < 0) continue;
      if (!durations.has(key)) durations.set(key, []);
      durations.get(key)!.push(days);
    }
  }

  return stages
    .filter(s => !s.isWon && !s.isLost)
    .sort((a, b) => a.sequence - b.sequence)
    .map(s => {
      const samples = durations.get(s.code.toLowerCase()) ?? [];
      const avgDays = samples.length > 0
        ? Math.round((samples.reduce((x, y) => x + y, 0) / samples.length) * 10) / 10
        : 0;
      return {
        stage: s.code,
        label: s.name,
        sequence: s.sequence,
        avgDays,
        targetDays: s.targetDays,
        sampleSize: samples.length,
        status: (samples.length > 0 && avgDays > s.targetDays ? 'lento' : 'ok') as 'ok' | 'lento',
      };
    });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Etapas de arranque para una empresa nueva. Editables desde la interfaz. */
export function defaultPipelineStages(): StageConfigInput[] {
  return [
    { code: 'lead',        name: 'Prospecto',   sequence: 10, probability: 10,  forecastCategory: 'PIPELINE',  isWon: false, isLost: false, targetDays: 7 },
    { code: 'qualified',   name: 'Calificado',  sequence: 20, probability: 25,  forecastCategory: 'PIPELINE',  isWon: false, isLost: false, targetDays: 10 },
    { code: 'proposal',    name: 'Propuesta',   sequence: 30, probability: 50,  forecastCategory: 'BEST_CASE', isWon: false, isLost: false, targetDays: 14 },
    { code: 'negotiation', name: 'Negociación', sequence: 40, probability: 75,  forecastCategory: 'COMMIT',    isWon: false, isLost: false, targetDays: 14 },
    { code: 'won',         name: 'Ganada',      sequence: 50, probability: 100, forecastCategory: 'CLOSED',    isWon: true,  isLost: false, targetDays: 0 },
    { code: 'lost',        name: 'Perdida',     sequence: 60, probability: 0,   forecastCategory: 'OMITTED',   isWon: false, isLost: true,  targetDays: 0 },
  ];
}
