/**
 * Motor de scoring de leads — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Modelo de dos ejes, el estándar de la industria (HubSpot, Salesforce):
 *
 *   FIT        (0-100) — QUIÉN es: cargo, industria, tamaño, ciudad, RUC. No decae:
 *                        un gerente financiero de una minera sigue siéndolo mañana.
 *   ENGAGEMENT (0-100) — QUÉ HIZO: envió el formulario, vio precios, pidió demo.
 *                        SÍ decae: el interés se enfría. Se aplica media vida.
 *   NEGATIVE   (resta) — motivos de descalificación: correo personal, competidor,
 *                        estudiante, país fuera de mercado. Nunca decae, porque un
 *                        competidor no deja de serlo con el tiempo.
 *
 * Por qué separarlos: un lead con fit alto y engagement bajo necesita marketing;
 * uno con engagement alto y fit bajo es ruido. Un único número los confunde y el
 * vendedor termina llamando al equivocado.
 *
 * El decaimiento usa media vida exponencial: peso = 0.5 ^ (díasDeAntigüedad / mediaVida).
 * Con la media vida por defecto (30 días) un evento de hace un mes vale la mitad y uno
 * de hace seis meses vale ~1.5 %.
 */

import { Condition, ConditionOperator, evaluateCondition } from './condition.engine';

export interface ScoringRuleInput {
  id: string;
  name: string;
  category: 'FIT' | 'ENGAGEMENT' | 'NEGATIVE';
  field: string;
  operator: ConditionOperator;
  value: string[];
  points: number;
  maxPoints?: number | null;
  /** Media vida propia; si falta se usa la global de la configuración. */
  halfLifeDays?: number | null;
  isActive?: boolean;
  priority?: number;
  description?: string;
}

export interface ScoringConfigInput {
  fitWeight: number;
  engagementWeight: number;
  halfLifeDays: number;
  mqlThreshold: number;
  sqlThreshold: number;
  gradeAThreshold: number;
  gradeBThreshold: number;
  gradeCThreshold: number;
  hotThreshold: number;
  warmThreshold: number;
}

export interface LeadEventInput {
  eventType: string;
  occurredAt: Date;
}

export interface ScoreLineItem {
  ruleId: string;
  ruleName: string;
  category: 'FIT' | 'ENGAGEMENT' | 'NEGATIVE';
  /** Puntos configurados en la regla, antes de decaimiento y tope. */
  rawPoints: number;
  /** Puntos realmente aplicados (tras decaimiento y tope). */
  points: number;
  /** Factor de decaimiento aplicado (1 = sin decaimiento). */
  decayFactor: number;
  detail: string;
}

export interface ScoreResult {
  score: number;        // 0-100 final
  fitScore: number;     // 0-100 normalizado
  engageScore: number;  // 0-100 normalizado
  negativePoints: number; // total restado (valor negativo o 0)
  grade: 'A' | 'B' | 'C' | 'D';
  temperature: 'hot' | 'warm' | 'cold';
  lifecycle: 'LEAD' | 'MQL' | 'SQL';
  breakdown: ScoreLineItem[];
}

export const DEFAULT_SCORING_CONFIG: ScoringConfigInput = {
  fitWeight: 50,
  engagementWeight: 50,
  halfLifeDays: 30,
  mqlThreshold: 50,
  sqlThreshold: 75,
  gradeAThreshold: 80,
  gradeBThreshold: 60,
  gradeCThreshold: 40,
  hotThreshold: 75,
  warmThreshold: 45,
};

/**
 * Cuántas reglas de interacción definen el techo del eje (las de mayor peso).
 * Ver la explicación completa en el cálculo de `engageMax`.
 */
export const ENGAGEMENT_CEILING_RULES = 3;

/** Peso de un evento según su antigüedad. Media vida exponencial. */
export function decayFactor(occurredAt: Date, now: Date, halfLifeDays: number): number {
  if (!halfLifeDays || halfLifeDays <= 0) return 1; // media vida 0 = sin decaimiento
  const ageDays = (now.getTime() - occurredAt.getTime()) / 86_400_000;
  if (ageDays <= 0) return 1; // eventos futuros o de este instante valen completo
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calcula el score de un lead.
 *
 * @param lead     objeto plano con los campos del lead (firstName, email, jobTitle…)
 * @param events   eventos de comportamiento, con su fecha, para el decaimiento
 * @param rules    reglas configuradas por la empresa
 * @param config   umbrales y pesos de la empresa
 * @param now      inyectable para que los tests sean deterministas
 */
export function calculateLeadScore(
  lead: Record<string, any>,
  events: LeadEventInput[],
  rules: ScoringRuleInput[],
  config: ScoringConfigInput = DEFAULT_SCORING_CONFIG,
  now: Date = new Date(),
): ScoreResult {
  const activeRules = (rules ?? [])
    .filter(r => r.isActive !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  // Conteo simple de eventos por tipo — lo consume el operador EVENT_COUNT.
  const eventCounts: Record<string, number> = {};
  for (const e of events ?? []) {
    eventCounts[e.eventType] = (eventCounts[e.eventType] ?? 0) + 1;
  }

  const breakdown: ScoreLineItem[] = [];
  let fitRaw = 0;
  let fitMax = 0;
  let engageRaw = 0;
  let negativePoints = 0;
  // Puntos máximos que podría aportar CADA regla de interacción, por separado.
  // Se guardan sueltos porque el techo del eje NO es su suma (ver ENGAGEMENT_CEILING_RULES).
  const engageCaps: number[] = [];

  for (const rule of activeRules) {
    const condition: Condition = { field: rule.field, operator: rule.operator, value: rule.value ?? [] };

    // ── ENGAGEMENT con EVENT_COUNT: se puntúa evento por evento con decaimiento ──
    // Cada ocurrencia aporta `points` degradados por su antigüedad, hasta `maxPoints`.
    if (rule.category === 'ENGAGEMENT' && rule.operator === 'EVENT_COUNT') {
      const halfLife = rule.halfLifeDays ?? config.halfLifeDays;
      const matching = (events ?? []).filter(e => e.eventType === rule.field);
      const cap = rule.maxPoints ?? rule.points * 3; // tope por defecto: 3 ocurrencias
      engageCaps.push(cap);
      if (matching.length === 0) continue;

      let earned = 0;
      let weightSum = 0;
      for (const e of matching) {
        const f = decayFactor(e.occurredAt, now, halfLife);
        earned += rule.points * f;
        weightSum += f;
      }
      earned = Math.min(earned, cap);
      const avgDecay = matching.length > 0 ? weightSum / matching.length : 1;
      engageRaw += earned;
      breakdown.push({
        ruleId: rule.id,
        ruleName: rule.name,
        category: 'ENGAGEMENT',
        rawPoints: rule.points,
        points: Math.round(earned * 10) / 10,
        decayFactor: Math.round(avgDecay * 100) / 100,
        detail: `${matching.length} evento(s) "${rule.field}" · decaimiento medio ${(avgDecay * 100).toFixed(0)} %`,
      });
      continue;
    }

    // ── Resto de reglas: condición booleana sobre el lead ──
    if (rule.category === 'FIT') fitMax += Math.max(0, rule.points);
    if (rule.category === 'ENGAGEMENT') engageCaps.push(Math.max(0, rule.points));

    const matches = evaluateCondition(condition, lead, eventCounts);
    if (!matches) continue;

    if (rule.category === 'NEGATIVE') {
      // Los puntos negativos se guardan como negativos aunque el usuario escriba 20.
      const applied = -Math.abs(rule.points);
      negativePoints += applied;
      breakdown.push({
        ruleId: rule.id, ruleName: rule.name, category: 'NEGATIVE',
        rawPoints: rule.points, points: applied, decayFactor: 1,
        detail: `Penalización aplicada (${rule.field})`,
      });
      continue;
    }

    if (rule.category === 'FIT') fitRaw += rule.points;
    else engageRaw += rule.points;

    breakdown.push({
      ruleId: rule.id, ruleName: rule.name, category: rule.category,
      rawPoints: rule.points, points: rule.points, decayFactor: 1,
      detail: `Cumple: ${rule.field}`,
    });
  }

  // ── Normalización de los dos ejes a 0-100 ──
  //
  // PERFIL: el techo SÍ es la suma de todas sus reglas. Los atributos firmográficos
  // (cargo, RUC, ciudad, teléfono) son simultáneos: un lead puede cumplirlos todos.
  const fitScore = fitMax > 0 ? clamp(Math.round((fitRaw / fitMax) * 100), 0, 100) : 0;

  // INTERACCIÓN: el techo NO es la suma de todas sus reglas. Nadie pide una demo, ve
  // precios dos veces, responde tres mensajes, agenda una reunión Y descarga material.
  // Sumarlas daba un denominador inalcanzable (157 con las reglas por defecto), lo que
  // comprimía el eje y hacía que los umbrales MQL/SQL nunca se alcanzaran: todos los
  // leads salían grado D. El techo realista son las señales de más peso que un lead
  // interesado sí produce, así que se normaliza contra las TRES mayores.
  const engageMax = [...engageCaps]
    .sort((a, b) => b - a)
    .slice(0, ENGAGEMENT_CEILING_RULES)
    .reduce((sum, cap) => sum + cap, 0);
  const engageScore = engageMax > 0 ? clamp(Math.round((engageRaw / engageMax) * 100), 0, 100) : 0;

  let fitW = config.fitWeight;
  let engW = config.engagementWeight;
  // Si un eje no tiene reglas configuradas, el otro se lleva todo el peso: así no se
  // castiga a quien solo definió reglas de perfil (o solo de interacción).
  if (fitMax === 0 && engageMax > 0) { fitW = 0; engW = 100; }
  else if (engageMax === 0 && fitMax > 0) { fitW = 100; engW = 0; }
  const weightSum = fitW + engW;

  const combined = weightSum > 0
    ? (fitScore * fitW + engageScore * engW) / weightSum
    : 0;

  const score = clamp(Math.round(combined + negativePoints), 0, 100);

  const grade: ScoreResult['grade'] =
    score >= config.gradeAThreshold ? 'A'
    : score >= config.gradeBThreshold ? 'B'
    : score >= config.gradeCThreshold ? 'C'
    : 'D';

  const temperature: ScoreResult['temperature'] =
    score >= config.hotThreshold ? 'hot'
    : score >= config.warmThreshold ? 'warm'
    : 'cold';

  const lifecycle: ScoreResult['lifecycle'] =
    score >= config.sqlThreshold ? 'SQL'
    : score >= config.mqlThreshold ? 'MQL'
    : 'LEAD';

  return { score, fitScore, engageScore, negativePoints, grade, temperature, lifecycle, breakdown };
}

/**
 * Reglas de arranque para una empresa nueva. Son un punto de partida razonable para el
 * mercado ecuatoriano de PYMEs; el usuario las edita desde la interfaz.
 */
export function defaultScoringRules(): Omit<ScoringRuleInput, 'id'>[] {
  return [
    // ── FIT: quién es ──
    { name: 'Cargo decisor (gerente, director, dueño)', category: 'FIT', field: 'jobTitle', operator: 'CONTAINS', value: ['gerente', 'director', 'jefe', 'dueño', 'propietario', 'ceo', 'cfo'], points: 25, description: 'Habla con quien firma' },
    { name: 'Tiene RUC (empresa formal)', category: 'FIT', field: 'ruc', operator: 'EXISTS', value: [], points: 20 },
    { name: 'Empresa identificada', category: 'FIT', field: 'companyName', operator: 'EXISTS', value: [], points: 10 },
    { name: 'Ciudad principal (Quito, Guayaquil, Cuenca)', category: 'FIT', field: 'city', operator: 'IN', value: ['quito', 'guayaquil', 'cuenca'], points: 10 },
    { name: 'Teléfono de contacto', category: 'FIT', field: 'phone', operator: 'EXISTS', value: [], points: 10 },
    { name: 'Sitio web propio', category: 'FIT', field: 'website', operator: 'EXISTS', value: [], points: 5 },
    // Un correo con dominio propio distingue a una empresa de un curioso, y es lo único
    // que un formulario de 3 campos alcanza a revelar sobre el perfil.
    { name: 'Correo corporativo (dominio propio)', category: 'FIT', field: 'email', operator: 'NOT_CONTAINS', value: ['@gmail.', '@hotmail.', '@yahoo.', '@outlook.', '@live.', '@icloud.'], points: 15 },

    // ── ENGAGEMENT: qué hizo (decae) ──
    { name: 'Solicitó demostración', category: 'ENGAGEMENT', field: 'demo_request', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
    { name: 'Vio la página de precios', category: 'ENGAGEMENT', field: 'pricing_view', operator: 'EVENT_COUNT', value: ['1'], points: 15, maxPoints: 30 },
    { name: 'Respondió un mensaje', category: 'ENGAGEMENT', field: 'message_reply', operator: 'EVENT_COUNT', value: ['1'], points: 12, maxPoints: 36 },
    { name: 'Envió un formulario', category: 'ENGAGEMENT', field: 'form_submit', operator: 'EVENT_COUNT', value: ['1'], points: 10, maxPoints: 20 },
    { name: 'Agendó una reunión', category: 'ENGAGEMENT', field: 'meeting_booked', operator: 'EVENT_COUNT', value: ['1'], points: 25, maxPoints: 25 },
    { name: 'Descargó material', category: 'ENGAGEMENT', field: 'doc_download', operator: 'EVENT_COUNT', value: ['1'], points: 8, maxPoints: 16 },
    // El texto del mensaje es la señal de intención más fuerte que trae un formulario:
    // "quiero cotizar 40 licencias" vale más que tres visitas a la página de precios.
    { name: 'Mensaje con intención de compra', category: 'ENGAGEMENT', field: 'message', operator: 'CONTAINS', value: ['cotizar', 'cotización', 'precio', 'presupuesto', 'demo', 'implementar', 'licencia', 'contratar', 'usuarios'], points: 25 },

    // ── NEGATIVE: motivos de descalificación ──
    { name: 'Correo personal (no corporativo)', category: 'NEGATIVE', field: 'email', operator: 'CONTAINS', value: ['@gmail.', '@hotmail.', '@yahoo.', '@outlook.'], points: 10 },
    { name: 'Estudiante o tesis', category: 'NEGATIVE', field: 'message', operator: 'CONTAINS', value: ['estudiante', 'tesis', 'tarea', 'universidad'], points: 25 },
    { name: 'Competidor', category: 'NEGATIVE', field: 'companyName', operator: 'CONTAINS', value: ['odoo', 'sap', 'contifico', 'siigo'], points: 30 },
    { name: 'Se dio de baja', category: 'NEGATIVE', field: 'unsubscribe', operator: 'EVENT_COUNT', value: ['1'], points: 40 },
  ];
}
