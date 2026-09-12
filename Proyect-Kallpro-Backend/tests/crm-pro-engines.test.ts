/**
 * Sprint 13 — tests de los motores puros del CRM Pro.
 * Sin BD: los cuatro motores son funciones puras (regla transversal 6).
 */

import {
  evaluateCondition, evaluateAll, normalize, readField,
} from '../src/services/crm/engines/condition.engine';
import {
  calculateLeadScore, decayFactor, defaultScoringRules,
  DEFAULT_SCORING_CONFIG, ScoringRuleInput,
} from '../src/services/crm/engines/lead-scoring.engine';
import {
  findDuplicate, scorePair, stringSimilarity, normalizePhone,
  emailDomain, isCorporateDomain, DEDUPE_THRESHOLD,
} from '../src/services/crm/engines/lead-dedup.engine';
import { routeLead, AssignmentRuleInput } from '../src/services/crm/engines/lead-routing.engine';
import {
  calculateForecastV2, calculateAccuracy, calculateVelocity,
  defaultPipelineStages, resolveCategory, DealInput, StageConfigInput,
} from '../src/services/crm/engines/forecast.engine';

const NOW = new Date('2026-07-22T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

// ════════════════════════════════════════════════════════════════════
// 1 · Evaluador de condiciones
// ════════════════════════════════════════════════════════════════════
describe('condition.engine', () => {
  it('normaliza quitando acentos y mayúsculas', () => {
    expect(normalize('Guayaquíl')).toBe('guayaquil');
    expect(normalize('  TORNILLERÍA  ')).toBe('tornilleria');
    expect(normalize(null)).toBe('');
  });

  it('lee campos anidados con notación de punto', () => {
    expect(readField({ a: { b: { c: 7 } } }, 'a.b.c')).toBe(7);
    expect(readField({ a: null }, 'a.b')).toBeUndefined();
  });

  it('EQUALS es insensible a acentos (Guayaquil ≡ Guayaquíl)', () => {
    expect(evaluateCondition({ field: 'city', operator: 'EQUALS', value: ['guayaquil'] }, { city: 'Guayaquíl' })).toBe(true);
  });

  it('CONTAINS casa con cualquiera de los valores de la lista', () => {
    const c = { field: 'jobTitle', operator: 'CONTAINS' as const, value: ['gerente', 'director'] };
    expect(evaluateCondition(c, { jobTitle: 'Gerente Financiero' })).toBe(true);
    expect(evaluateCondition(c, { jobTitle: 'Pasante' })).toBe(false);
  });

  it('IN sobre un campo lista (tags) casa si cualquiera coincide', () => {
    const c = { field: 'tags', operator: 'IN' as const, value: ['feria', 'referido'] };
    expect(evaluateCondition(c, { tags: ['web', 'referido'] })).toBe(true);
    expect(evaluateCondition(c, { tags: ['web'] })).toBe(false);
  });

  it('BETWEEN respeta ambos extremos, inclusive', () => {
    const c = { field: 'empleados', operator: 'BETWEEN' as const, value: ['10', '50'] };
    expect(evaluateCondition(c, { empleados: 10 })).toBe(true);
    expect(evaluateCondition(c, { empleados: 50 })).toBe(true);
    expect(evaluateCondition(c, { empleados: 51 })).toBe(false);
  });

  it('EXISTS distingue vacío de ausente', () => {
    expect(evaluateCondition({ field: 'ruc', operator: 'EXISTS', value: [] }, { ruc: '1790012345001' })).toBe(true);
    expect(evaluateCondition({ field: 'ruc', operator: 'EXISTS', value: [] }, { ruc: '   ' })).toBe(false);
    expect(evaluateCondition({ field: 'ruc', operator: 'NOT_EXISTS', value: [] }, {})).toBe(true);
  });

  it('un campo vacío nunca casa en operadores de comparación', () => {
    // Protege contra la regla mal escrita "industria = ''" que puntuaría a todos.
    expect(evaluateCondition({ field: 'industry', operator: 'EQUALS', value: [''] }, { industry: '' })).toBe(false);
  });

  it('EVENT_COUNT compara contra el mínimo de ocurrencias', () => {
    const c = { field: 'pricing_view', operator: 'EVENT_COUNT' as const, value: ['2'] };
    expect(evaluateCondition(c, {}, { pricing_view: 3 })).toBe(true);
    expect(evaluateCondition(c, {}, { pricing_view: 1 })).toBe(false);
  });

  it('evaluateAll aplica AND y sin condiciones casa siempre', () => {
    const lead = { city: 'Quito', jobTitle: 'Gerente' };
    expect(evaluateAll([], lead)).toBe(true);
    expect(evaluateAll([
      { field: 'city', operator: 'EQUALS', value: ['quito'] },
      { field: 'jobTitle', operator: 'CONTAINS', value: ['gerente'] },
    ], lead)).toBe(true);
    expect(evaluateAll([
      { field: 'city', operator: 'EQUALS', value: ['quito'] },
      { field: 'jobTitle', operator: 'CONTAINS', value: ['pasante'] },
    ], lead)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2 · Motor de scoring
// ════════════════════════════════════════════════════════════════════
describe('lead-scoring.engine', () => {
  const fitRule = (over: Partial<ScoringRuleInput> = {}): ScoringRuleInput => ({
    id: 'r1', name: 'Cargo decisor', category: 'FIT',
    field: 'jobTitle', operator: 'CONTAINS', value: ['gerente'], points: 50, ...over,
  });

  it('decayFactor: a una media vida el evento vale la mitad', () => {
    expect(decayFactor(daysAgo(30), NOW, 30)).toBeCloseTo(0.5, 3);
    expect(decayFactor(daysAgo(60), NOW, 30)).toBeCloseTo(0.25, 3);
    expect(decayFactor(NOW, NOW, 30)).toBe(1);
  });

  it('decayFactor: media vida 0 desactiva el decaimiento', () => {
    expect(decayFactor(daysAgo(365), NOW, 0)).toBe(1);
  });

  it('normaliza cada eje sobre el máximo alcanzable de sus reglas', () => {
    const rules: ScoringRuleInput[] = [
      fitRule({ id: 'a', points: 30 }),
      fitRule({ id: 'b', name: 'RUC', field: 'ruc', operator: 'EXISTS', value: [], points: 20 }),
    ];
    // Cumple solo la primera → 30 de 50 posibles = 60 de fit.
    const r = calculateLeadScore({ jobTitle: 'Gerente' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(r.fitScore).toBe(60);
    // Sin reglas de engagement, el fit se lleva todo el peso.
    expect(r.score).toBe(60);
    expect(r.grade).toBe('B');
  });

  it('los puntos negativos restan del score final', () => {
    const rules: ScoringRuleInput[] = [
      fitRule({ id: 'a', points: 100 }),
      { id: 'n', name: 'Estudiante', category: 'NEGATIVE', field: 'message', operator: 'CONTAINS', value: ['tesis'], points: 25 },
    ];
    const sin = calculateLeadScore({ jobTitle: 'Gerente', message: 'Cotización' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    const con = calculateLeadScore({ jobTitle: 'Gerente', message: 'Es para mi tesis' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(sin.score).toBe(100);
    expect(con.score).toBe(75);
    expect(con.negativePoints).toBe(-25);
  });

  it('el score nunca sale del rango 0-100 por muchos negativos que haya', () => {
    const rules: ScoringRuleInput[] = [
      { id: 'n1', name: 'Competidor', category: 'NEGATIVE', field: 'companyName', operator: 'CONTAINS', value: ['odoo'], points: 90 },
      { id: 'n2', name: 'Baja', category: 'NEGATIVE', field: 'unsubscribe', operator: 'EVENT_COUNT', value: ['1'], points: 90 },
    ];
    const r = calculateLeadScore(
      { companyName: 'Odoo SA' },
      [{ eventType: 'unsubscribe', occurredAt: NOW }],
      rules, DEFAULT_SCORING_CONFIG, NOW,
    );
    expect(r.score).toBe(0);
  });

  it('el engagement decae: el mismo evento vale menos cuanto más viejo', () => {
    const rules: ScoringRuleInput[] = [{
      id: 'e', name: 'Vio precios', category: 'ENGAGEMENT',
      field: 'pricing_view', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30,
    }];
    const fresco = calculateLeadScore({}, [{ eventType: 'pricing_view', occurredAt: NOW }], rules, DEFAULT_SCORING_CONFIG, NOW);
    const viejo = calculateLeadScore({}, [{ eventType: 'pricing_view', occurredAt: daysAgo(60) }], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(fresco.engageScore).toBe(100);
    expect(viejo.engageScore).toBe(25); // dos medias vidas → 0.25
    expect(viejo.score).toBeLessThan(fresco.score);
  });

  it('maxPoints topa el acumulado de un evento repetido', () => {
    const rules: ScoringRuleInput[] = [{
      id: 'e', name: 'Respondió', category: 'ENGAGEMENT',
      field: 'message_reply', operator: 'EVENT_COUNT', value: ['1'], points: 12, maxPoints: 24,
    }];
    const events = Array.from({ length: 10 }, () => ({ eventType: 'message_reply', occurredAt: NOW }));
    const r = calculateLeadScore({}, events, rules, DEFAULT_SCORING_CONFIG, NOW);
    // 10 × 12 = 120, topado a 24 → el eje llega a su máximo, no lo supera.
    expect(r.engageScore).toBe(100);
    expect(r.breakdown.find(b => b.ruleId === 'e')!.points).toBe(24);
  });

  it('los pesos fit/engagement mueven el resultado', () => {
    const rules: ScoringRuleInput[] = [
      fitRule({ id: 'f', points: 100 }),
      { id: 'e', name: 'Demo', category: 'ENGAGEMENT', field: 'demo_request', operator: 'EVENT_COUNT', value: ['1'], points: 100, maxPoints: 100 },
    ];
    const lead = { jobTitle: 'Gerente' }; // cumple fit, sin eventos → engagement 0
    const equilibrado = calculateLeadScore(lead, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    const proFit = calculateLeadScore(lead, [], rules, { ...DEFAULT_SCORING_CONFIG, fitWeight: 80, engagementWeight: 20 }, NOW);
    expect(equilibrado.score).toBe(50);
    expect(proFit.score).toBe(80);
  });

  it('clasifica grado, temperatura y ciclo de vida según los umbrales', () => {
    const rules: ScoringRuleInput[] = [fitRule({ id: 'f', points: 100 })];
    const alto = calculateLeadScore({ jobTitle: 'Gerente' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(alto.grade).toBe('A');
    expect(alto.temperature).toBe('hot');
    expect(alto.lifecycle).toBe('SQL');

    const bajo = calculateLeadScore({ jobTitle: 'Pasante' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(bajo.grade).toBe('D');
    expect(bajo.temperature).toBe('cold');
    expect(bajo.lifecycle).toBe('LEAD');
  });

  it('el desglose explica cada punto sumado o restado', () => {
    const rules: ScoringRuleInput[] = [
      fitRule({ id: 'f', points: 50 }),
      { id: 'n', name: 'Correo personal', category: 'NEGATIVE', field: 'email', operator: 'CONTAINS', value: ['@gmail.'], points: 10 },
    ];
    const r = calculateLeadScore({ jobTitle: 'Gerente', email: 'x@gmail.com' }, [], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown.find(b => b.category === 'NEGATIVE')!.points).toBe(-10);
  });

  it('las reglas inactivas se ignoran', () => {
    const rules: ScoringRuleInput[] = [fitRule({ id: 'f', points: 100, isActive: false })];
    expect(calculateLeadScore({ jobTitle: 'Gerente' }, [], rules, DEFAULT_SCORING_CONFIG, NOW).score).toBe(0);
  });

  it('el techo de interacción son las 3 reglas mayores, no la suma de todas', () => {
    // Regresión: sumar TODOS los topes daba un denominador inalcanzable (nadie dispara
    // las seis señales), el eje quedaba comprimido y ningún lead llegaba nunca a MQL.
    const rules: ScoringRuleInput[] = [
      { id: 'e1', name: 'Demo', category: 'ENGAGEMENT', field: 'demo_request', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
      { id: 'e2', name: 'Reunión', category: 'ENGAGEMENT', field: 'meeting_booked', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
      { id: 'e3', name: 'Precios', category: 'ENGAGEMENT', field: 'pricing_view', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
      { id: 'e4', name: 'Descarga', category: 'ENGAGEMENT', field: 'doc_download', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
      { id: 'e5', name: 'Formulario', category: 'ENGAGEMENT', field: 'form_submit', operator: 'EVENT_COUNT', value: ['1'], points: 30, maxPoints: 30 },
    ];
    // Techo = 3 × 30 = 90, no 5 × 30 = 150.
    const tresSenales = calculateLeadScore({}, [
      { eventType: 'demo_request', occurredAt: NOW },
      { eventType: 'meeting_booked', occurredAt: NOW },
      { eventType: 'pricing_view', occurredAt: NOW },
    ], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(tresSenales.engageScore).toBe(100);

    const unaSenal = calculateLeadScore({}, [
      { eventType: 'demo_request', occurredAt: NOW },
    ], rules, DEFAULT_SCORING_CONFIG, NOW);
    expect(unaSenal.engageScore).toBe(33); // 30/90, no 30/150 = 20
  });

  it('el correo corporativo y la intención de compra separan a un lead real del ruido', () => {
    // Un formulario web corto no revela cargo, RUC ni ciudad, así que su puntaje absoluto
    // será modesto (eso lo calibra el usuario con los umbrales). Lo que el motor SÍ debe
    // garantizar es el ORDEN: quien escribe desde su empresa pidiendo cotización tiene que
    // quedar muy por encima de quien deja un correo personal y un "hola".
    const rules = defaultScoringRules().map((r, i) => ({ ...r, id: `d${i}` })) as ScoringRuleInput[];
    const evento = [{ eventType: 'form_submit', occurredAt: NOW }];

    const conIntencion = calculateLeadScore(
      {
        firstName: 'Ana',
        email: 'ana.vaca@mineraandina.com',
        companyName: 'Minera Andina S.A.',
        message: 'Necesito cotizar el módulo de inventario para 40 usuarios',
      },
      evento, rules, DEFAULT_SCORING_CONFIG, NOW,
    );

    const sinIntencion = calculateLeadScore(
      { firstName: 'Ana', email: 'ana.vaca@gmail.com', message: 'Hola' },
      evento, rules, DEFAULT_SCORING_CONFIG, NOW,
    );

    expect(conIntencion.score).toBeGreaterThan(sinIntencion.score * 3);
    // El correo corporativo suma en perfil y además evita la penalización.
    expect(conIntencion.breakdown.some(b => b.ruleName.includes('corporativo'))).toBe(true);
    expect(sinIntencion.breakdown.some(b => b.category === 'NEGATIVE')).toBe(true);
  });

  it('el juego de reglas por defecto puntúa alto a un buen lead y bajo a uno malo', () => {
    const rules = defaultScoringRules().map((r, i) => ({ ...r, id: `d${i}` })) as ScoringRuleInput[];
    const bueno = calculateLeadScore(
      { jobTitle: 'Gerente General', ruc: '1790012345001', companyName: 'Minera Andina', city: 'Quito', phone: '+593998887766', website: 'https://x.ec', email: 'jefe@mineraandina.com' },
      [
        { eventType: 'demo_request', occurredAt: NOW },
        { eventType: 'pricing_view', occurredAt: NOW },
        { eventType: 'meeting_booked', occurredAt: NOW },
      ],
      rules, DEFAULT_SCORING_CONFIG, NOW,
    );
    const malo = calculateLeadScore(
      { firstName: 'Ana', email: 'ana@gmail.com', message: 'Necesito info para mi tesis de la universidad' },
      [], rules, DEFAULT_SCORING_CONFIG, NOW,
    );
    expect(bueno.score).toBeGreaterThan(malo.score);
    expect(bueno.grade === 'A' || bueno.grade === 'B').toBe(true);
    expect(malo.grade).toBe('D');
  });
});

// ════════════════════════════════════════════════════════════════════
// 3 · Motor de deduplicación
// ════════════════════════════════════════════════════════════════════
describe('lead-dedup.engine', () => {
  it('normalizePhone se queda con los 9 dígitos significativos', () => {
    expect(normalizePhone('+593 99 888 7766')).toBe('998887766');
    expect(normalizePhone('0998887766')).toBe('998887766');
  });

  it('distingue dominio corporativo de correo personal', () => {
    expect(emailDomain('a@mineraandina.com')).toBe('mineraandina.com');
    expect(isCorporateDomain('gmail.com')).toBe(false);
    expect(isCorporateDomain('mineraandina.com')).toBe(true);
  });

  it('stringSimilarity tolera acentos y orden invertido', () => {
    expect(stringSimilarity('José Pérez', 'Jose Perez')).toBe(1);
    expect(stringSimilarity('Ana Vaca', 'Carlos Mendoza')).toBeLessThan(0.3);
  });

  it('el RUC idéntico es la señal más fuerte', () => {
    const m = scorePair({ id: 'new', ruc: '1790012345001' }, { id: 'old', ruc: '1790012345001' });
    expect(m!.score).toBe(100);
  });

  it('el mismo correo marca duplicado', () => {
    const r = findDuplicate(
      { id: 'new', email: 'JEFE@Andina.com' },
      [{ id: 'old', email: 'jefe@andina.com' }],
    );
    expect(r.isDuplicate).toBe(true);
    expect(r.best!.score).toBe(95);
  });

  it('dos personas DISTINTAS de la misma empresa NO son duplicados', () => {
    const r = findDuplicate(
      { id: 'new', firstName: 'Ana', lastName: 'Vaca', email: 'ana@andina.com' },
      [{ id: 'old', firstName: 'Carlos', lastName: 'Mendoza', email: 'carlos@andina.com' }],
    );
    expect(r.isDuplicate).toBe(false);
    expect(r.best!.score).toBe(40); // relación informativa, por debajo del umbral
  });

  it('mismo dominio corporativo y nombre casi igual sí marca duplicado', () => {
    const r = findDuplicate(
      { id: 'new', firstName: 'José', lastName: 'Pérez', email: 'jperez@andina.com' },
      [{ id: 'old', firstName: 'Jose', lastName: 'Perez', email: 'jose.perez@andina.com' }],
    );
    expect(r.isDuplicate).toBe(true);
    expect(r.best!.score).toBeGreaterThanOrEqual(DEDUPE_THRESHOLD);
  });

  it('el correo personal compartido no basta para marcar duplicado', () => {
    const r = findDuplicate(
      { id: 'new', firstName: 'Ana', email: 'ana@gmail.com' },
      [{ id: 'old', firstName: 'Luis', email: 'luis@gmail.com' }],
    );
    expect(r.best).toBeNull();
  });

  it('nunca se compara un lead consigo mismo', () => {
    expect(scorePair({ id: 'x', email: 'a@b.com' }, { id: 'x', email: 'a@b.com' })).toBeNull();
  });

  it('devuelve la coincidencia más fuerte primero', () => {
    const r = findDuplicate(
      { id: 'new', ruc: '1790012345001', email: 'a@andina.com', phone: '0998887766' },
      [
        { id: 'porTelefono', phone: '+593998887766' },
        { id: 'porRuc', ruc: '1790012345001' },
      ],
    );
    expect(r.best!.candidateId).toBe('porRuc');
    expect(r.all).toHaveLength(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4 · Motor de enrutamiento
// ════════════════════════════════════════════════════════════════════
describe('lead-routing.engine', () => {
  const fija = (over: Partial<AssignmentRuleInput> = {}): AssignmentRuleInput => ({
    id: 'r1', name: 'Sierra', priority: 10,
    conditions: [{ field: 'city', operator: 'EQUALS', value: ['quito'] }],
    assignMode: 'FIXED', ownerUserId: 'u-sierra', ...over,
  });

  it('gana la primera regla que casa por prioridad', () => {
    const rules = [
      fija({ id: 'baja', priority: 50, ownerUserId: 'u-baja', conditions: [] }),
      fija({ id: 'alta', priority: 10, ownerUserId: 'u-alta' }),
    ];
    expect(routeLead({ city: 'Quito' }, rules).ownerUserId).toBe('u-alta');
  });

  it('cae al propietario por defecto si ninguna regla casa', () => {
    const r = routeLead({ city: 'Loja' }, [fija()], 'u-default');
    expect(r.ownerUserId).toBe('u-default');
    expect(r.ruleId).toBeNull();
  });

  it('sin regla ni propietario por defecto el lead queda sin asignar', () => {
    const r = routeLead({ city: 'Loja' }, [fija()]);
    expect(r.ownerUserId).toBeNull();
  });

  it('el round-robin avanza el cursor y da la vuelta', () => {
    const rr = (cursor: number): AssignmentRuleInput => ({
      id: 'rr', name: 'Equipo costa', priority: 10, conditions: [],
      assignMode: 'ROUND_ROBIN', poolUserIds: ['a', 'b', 'c'], rrCursor: cursor,
    });
    expect(routeLead({}, [rr(0)])).toMatchObject({ ownerUserId: 'a', nextCursor: 1 });
    expect(routeLead({}, [rr(1)])).toMatchObject({ ownerUserId: 'b', nextCursor: 2 });
    expect(routeLead({}, [rr(2)])).toMatchObject({ ownerUserId: 'c', nextCursor: 0 });
    // Cursor fuera de rango (equipo achicado): no debe romper.
    expect(routeLead({}, [rr(7)]).ownerUserId).toBe('b');
  });

  it('una regla mal configurada se salta en vez de romper la captura', () => {
    const rota: AssignmentRuleInput = { id: 'rota', name: 'Sin dueño', priority: 1, conditions: [], assignMode: 'FIXED', ownerUserId: null };
    const sinEquipo: AssignmentRuleInput = { id: 'vacia', name: 'Sin equipo', priority: 2, conditions: [], assignMode: 'ROUND_ROBIN', poolUserIds: [] };
    const r = routeLead({ city: 'Quito' }, [rota, sinEquipo, fija({ priority: 90 })]);
    expect(r.ownerUserId).toBe('u-sierra');
  });

  it('las reglas inactivas se ignoran', () => {
    expect(routeLead({ city: 'Quito' }, [fija({ isActive: false })]).ownerUserId).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
// 5 · Motor de pronóstico
// ════════════════════════════════════════════════════════════════════
describe('forecast.engine', () => {
  const stages: StageConfigInput[] = defaultPipelineStages();

  const deal = (over: Partial<DealInput> = {}): DealInput => ({
    id: 'd1', name: 'Oportunidad', stage: 'proposal',
    amountUsd: 10_000, probability: 50, lastActivityAt: NOW, ...over,
  });

  it('la categoría se hereda de la etapa', () => {
    expect(resolveCategory(deal({ stage: 'negotiation' }), stages)).toBe('COMMIT');
    expect(resolveCategory(deal({ stage: 'proposal' }), stages)).toBe('BEST_CASE');
    expect(resolveCategory(deal({ stage: 'lead' }), stages)).toBe('PIPELINE');
  });

  it('la categoría manual manda sobre la de la etapa', () => {
    const d = deal({ stage: 'lead', forecastCategory: 'COMMIT', categoryOverride: true });
    expect(resolveCategory(d, stages)).toBe('COMMIT');
    // Sin la marca de anulación, la etapa vuelve a mandar.
    expect(resolveCategory({ ...d, categoryOverride: false }, stages)).toBe('PIPELINE');
  });

  it('agrupa por categoría y separa lo ganado del pipeline abierto', () => {
    const deals = [
      deal({ id: 'a', stage: 'negotiation', amountUsd: 50_000 }),  // COMMIT
      deal({ id: 'b', stage: 'proposal', amountUsd: 30_000 }),     // BEST_CASE
      deal({ id: 'c', stage: 'lead', amountUsd: 20_000 }),         // PIPELINE
      deal({ id: 'd', stage: 'won', amountUsd: 40_000 }),          // CLOSED
      deal({ id: 'e', stage: 'lost', amountUsd: 90_000 }),         // OMITTED
    ];
    const f = calculateForecastV2('2026-07', deals, stages, 0, NOW);
    expect(f.commit).toBe(50_000);
    expect(f.bestCase).toBe(30_000);
    expect(f.won).toBe(40_000);
    expect(f.omitted).toBe(90_000);
    // Lo ganado, lo perdido y lo omitido NO son pipeline abierto.
    expect(f.openPipeline).toBe(100_000);
    expect(f.committedPlusUpside).toBe(120_000);
  });

  it('el ponderado usa la probabilidad de la etapa configurada, no la guardada', () => {
    // El usuario baja Propuesta de 50 % a 20 %: el pronóstico debe seguirlo sin migrar filas.
    const custom = stages.map(s => s.code === 'proposal' ? { ...s, probability: 20 } : s);
    const f = calculateForecastV2('2026-07', [deal({ amountUsd: 10_000, probability: 50 })], custom, 0, NOW);
    expect(f.weightedForecast).toBe(2_000);
  });

  it('calcula cobertura de pipeline y avance de cuota', () => {
    const deals = [
      deal({ id: 'a', stage: 'negotiation', amountUsd: 90_000 }),
      deal({ id: 'w', stage: 'won', amountUsd: 25_000 }),
    ];
    const f = calculateForecastV2('2026-07', deals, stages, 100_000, NOW);
    expect(f.coverageRatio).toBe(0.9);
    expect(f.coverageStatus).toBe('insuficiente'); // sano es 3x
    expect(f.quotaAttainment).toBe(25);
    expect(f.gapToQuota).toBe(75_000);
  });

  it('marca cobertura saludable a partir de 3x la cuota', () => {
    const f = calculateForecastV2('2026-07', [deal({ stage: 'negotiation', amountUsd: 300_000 })], stages, 100_000, NOW);
    expect(f.coverageStatus).toBe('saludable');
  });

  it('sin cuota no inventa cobertura', () => {
    const f = calculateForecastV2('2026-07', [deal()], stages, 0, NOW);
    expect(f.coverageRatio).toBe(0);
    expect(f.coverageStatus).toBe('sin_cuota');
  });

  it('detecta oportunidades estancadas por encima del objetivo de la etapa', () => {
    const deals = [
      deal({ id: 'quieta', stage: 'proposal', lastActivityAt: daysAgo(40) }),  // objetivo 14
      deal({ id: 'activa', stage: 'proposal', lastActivityAt: daysAgo(3) }),
      deal({ id: 'ganada', stage: 'won', lastActivityAt: daysAgo(90) }),       // cerrada: no cuenta
    ];
    const f = calculateForecastV2('2026-07', deals, stages, 0, NOW);
    expect(f.staleDeals.map(d => d.id)).toEqual(['quieta']);
    expect(f.staleDeals[0].daysInactive).toBe(40);
  });

  it('una etapa desconocida se trata como abierta (comportamiento conservador)', () => {
    const f = calculateForecastV2('2026-07', [deal({ stage: 'etapa_inventada', amountUsd: 5_000, probability: 30 })], stages, 0, NOW);
    expect(f.openPipeline).toBe(5_000);
    expect(f.weightedForecast).toBe(1_500);
  });

  it('un pronóstico vacío no divide por cero', () => {
    const f = calculateForecastV2('2026-07', [], stages, 0, NOW);
    expect(f.openPipeline).toBe(0);
    expect(f.avgDealSize).toBe(0);
    expect(f.byCategory).toHaveLength(5);
  });

  // ── Precisión ──
  it('mide la precisión del comprometido contra lo realmente ganado', () => {
    const a = calculateAccuracy('2026-06', { commitUsd: 100_000, bestCaseUsd: 200_000, weightedFcstUsd: 150_000 }, 95_000);
    expect(a.commitAccuracy).toBe(95);
    expect(a.variancePct).toBe(-5);
    expect(a.verdict).toBe('preciso');
  });

  it('detecta sobre-pronóstico cuando la varianza supera el ±25 %', () => {
    const a = calculateAccuracy('2026-06', { commitUsd: 100_000, bestCaseUsd: 200_000, weightedFcstUsd: 150_000 }, 60_000);
    expect(a.verdict).toBe('sobre_pronostico');
    expect(a.notes.length).toBeGreaterThan(0);
  });

  it('detecta sub-pronóstico y avisa del Mejor caso por encima del 55 %', () => {
    const a = calculateAccuracy('2026-06', { commitUsd: 100_000, bestCaseUsd: 200_000, weightedFcstUsd: 150_000 }, 150_000);
    expect(a.verdict).toBe('sub_pronostico');
    expect(a.bestCaseAccuracy).toBe(75);
    expect(a.notes.some(n => n.includes('Mejor caso'))).toBe(true);
  });

  it('sin foto guardada no inventa precisión', () => {
    const a = calculateAccuracy('2026-06', { commitUsd: 0, bestCaseUsd: 0, weightedFcstUsd: 0 }, 50_000);
    expect(a.verdict).toBe('sin_datos');
  });

  // ── Velocidad ──
  it('calcula los días promedio en cada etapa', () => {
    const t = (dealId: string, toStage: string, day: number) => ({
      dealId, fromStage: null, toStage, changedAt: daysAgo(day),
    });
    // d1: lead 10 días (60→50), qualified 20 días (50→30)
    // d2: lead 20 días (60→40)
    const velocity = calculateVelocity([
      t('d1', 'lead', 60), t('d1', 'qualified', 50), t('d1', 'proposal', 30),
      t('d2', 'lead', 60), t('d2', 'qualified', 40),
    ], stages);

    const lead = velocity.find(v => v.stage === 'lead')!;
    expect(lead.sampleSize).toBe(2);
    expect(lead.avgDays).toBe(15); // (10 + 20) / 2
    expect(lead.status).toBe('lento'); // objetivo 7 días

    const qualified = velocity.find(v => v.stage === 'qualified')!;
    expect(qualified.sampleSize).toBe(1);
    expect(qualified.avgDays).toBe(20);
  });

  it('la velocidad excluye las etapas cerradas y no rompe sin datos', () => {
    const v = calculateVelocity([], stages);
    expect(v.map(s => s.stage)).toEqual(['lead', 'qualified', 'proposal', 'negotiation']);
    expect(v.every(s => s.sampleSize === 0 && s.status === 'ok')).toBe(true);
  });
});
