/**
 * Evaluador de condiciones — motor PURO (sin BD, sin I/O).
 *
 * Por qué existe: tanto el scoring como el enrutamiento de leads dejan que el usuario
 * defina reglas desde la interfaz. Si cada motor interpretara los operadores a su
 * manera, "contiene" significaría cosas distintas en cada pantalla y el usuario perdería
 * la confianza en la configuración. Un único evaluador garantiza que una regla se lee
 * igual en todas partes.
 *
 * Las comparaciones de texto son SIEMPRE insensibles a mayúsculas y a acentos, porque
 * en Ecuador "Guayaquil" y "guayaquíl" son la misma ciudad y el usuario no debería tener
 * que escribir la regla dos veces (mismo problema que la búsqueda global, ver CLAUDE.md).
 */

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IN'
  | 'NOT_IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EVENT_COUNT';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  /** Siempre lista: así IN y BETWEEN no necesitan columnas extra en la tabla. */
  value: string[];
}

// Rango Unicode de los diacríticos combinantes (Combining Diacritical Marks). Tras
// normalize('NFD') la "í" queda como "i" + U+0301, así que basta con borrar el rango.
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normaliza para comparar: minúsculas, sin acentos, sin espacios sobrantes. */
export function normalize(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .trim();
}

/**
 * Lee un campo del objeto admitiendo rutas con punto ("crmCompany.industry").
 * Devuelve undefined si algún tramo del camino no existe.
 */
export function readField(source: Record<string, any>, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), source);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** true si el valor cuenta como "vacío" para EXISTS / NOT_EXISTS. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Evalúa una condición contra un objeto.
 *
 * @param eventCounts conteo de eventos por tipo; solo lo usa el operador EVENT_COUNT,
 *   donde `field` es el tipo de evento y `value[0]` el mínimo de ocurrencias.
 */
export function evaluateCondition(
  condition: Condition,
  source: Record<string, any>,
  eventCounts: Record<string, number> = {},
): boolean {
  const { field, operator, value } = condition;

  // EVENT_COUNT no mira el objeto: cuenta señales de comportamiento.
  if (operator === 'EVENT_COUNT') {
    const min = toNumber(value?.[0]) ?? 1;
    return (eventCounts[field] ?? 0) >= min;
  }

  const raw = readField(source, field);

  switch (operator) {
    case 'EXISTS':
      return !isEmpty(raw);
    case 'NOT_EXISTS':
      return isEmpty(raw);
  }

  // A partir de aquí un campo vacío nunca casa: evita que una regla mal escrita
  // ("industria = ''") puntúe a todos los leads sin industria.
  if (isEmpty(raw)) return false;

  const list = value ?? [];

  switch (operator) {
    case 'EQUALS':
      return list.some(v => normalize(v) === normalize(raw));
    case 'NOT_EQUALS':
      return !list.some(v => normalize(v) === normalize(raw));
    case 'CONTAINS':
      return list.some(v => normalize(v) !== '' && normalize(raw).includes(normalize(v)));
    case 'NOT_CONTAINS':
      return !list.some(v => normalize(v) !== '' && normalize(raw).includes(normalize(v)));
    case 'IN':
      // Si el campo es una lista (p. ej. tags), casa cuando cualquiera coincide.
      if (Array.isArray(raw)) {
        return raw.some(item => list.some(v => normalize(v) === normalize(item)));
      }
      return list.some(v => normalize(v) === normalize(raw));
    case 'NOT_IN':
      if (Array.isArray(raw)) {
        return !raw.some(item => list.some(v => normalize(v) === normalize(item)));
      }
      return !list.some(v => normalize(v) === normalize(raw));
    case 'GT':
    case 'GTE':
    case 'LT':
    case 'LTE': {
      const a = toNumber(raw);
      const b = toNumber(list[0]);
      if (a === null || b === null) return false;
      if (operator === 'GT') return a > b;
      if (operator === 'GTE') return a >= b;
      if (operator === 'LT') return a < b;
      return a <= b;
    }
    case 'BETWEEN': {
      const a = toNumber(raw);
      const min = toNumber(list[0]);
      const max = toNumber(list[1]);
      if (a === null || min === null || max === null) return false;
      return a >= min && a <= max;
    }
    default:
      return false;
  }
}

/** Todas las condiciones deben cumplirse (AND). Sin condiciones = casa siempre. */
export function evaluateAll(
  conditions: Condition[],
  source: Record<string, any>,
  eventCounts: Record<string, number> = {},
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, source, eventCounts));
}

export const CONDITION_OPERATORS: ConditionOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN', 'NOT_IN',
  'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'EXISTS', 'NOT_EXISTS', 'EVENT_COUNT',
];

/** Etiquetas en español para los selectores de la interfaz (regla transversal 7). */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  EQUALS: 'es igual a',
  NOT_EQUALS: 'no es igual a',
  CONTAINS: 'contiene',
  NOT_CONTAINS: 'no contiene',
  IN: 'está en la lista',
  NOT_IN: 'no está en la lista',
  GT: 'es mayor que',
  GTE: 'es mayor o igual que',
  LT: 'es menor que',
  LTE: 'es menor o igual que',
  BETWEEN: 'está entre',
  EXISTS: 'tiene valor',
  NOT_EXISTS: 'está vacío',
  EVENT_COUNT: 'nº de eventos ≥',
};
