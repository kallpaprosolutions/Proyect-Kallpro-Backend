// Catálogo de criterios de evaluación ponderada ("pesos") de proveedores.
// El comprador elige cuáles aplican a cada requisición y asigna un peso (suma 100).

export type CriterionDirection = 'lower_better' | 'higher_better' | 'manual';

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  direction: CriterionDirection;
}

export interface CriterionDef {
  key: string;
  label: string;
  direction: CriterionDirection;
  icon: string;
  help: string;
  manual: boolean; // si el comprador ingresa el valor manualmente por cotización
}

export const CRITERIA_CATALOG: CriterionDef[] = [
  { key: 'PRICE',    label: 'Precio',            direction: 'lower_better',  icon: '💰', manual: false, help: 'Menor precio total = mayor puntaje' },
  { key: 'DELIVERY', label: 'Tiempo de entrega', direction: 'lower_better',  icon: '🚚', manual: false, help: 'Menos días de entrega = mayor puntaje' },
  { key: 'PAYMENT',  label: 'Crédito / Anticipo', direction: 'higher_better', icon: '💳', manual: false, help: 'Más días de crédito y menor anticipo exigido = mejor flujo de caja' },
  { key: 'HISTORY',  label: 'Score histórico',   direction: 'higher_better', icon: '⭐', manual: false, help: 'Desempeño histórico del proveedor (calidad/cumplimiento/entregas)' },
  { key: 'QUALITY',  label: 'Calidad',           direction: 'manual',        icon: '✨', manual: true,  help: 'Calificación de calidad 0-100 que ingresa el comprador por cotización' },
];

export const DEFAULT_CRITERIA: Criterion[] = [
  { key: 'PRICE',    label: 'Precio',            weight: 50, direction: 'lower_better' },
  { key: 'DELIVERY', label: 'Tiempo de entrega', weight: 30, direction: 'lower_better' },
  { key: 'QUALITY',  label: 'Calidad',           weight: 20, direction: 'manual' },
];

export function getCriterionDef(key: string): CriterionDef | undefined {
  if (key.startsWith('CUSTOM')) {
    return { key, label: key, direction: 'manual', icon: '🏷️', manual: true, help: 'Criterio personalizado' };
  }
  return CRITERIA_CATALOG.find((c) => c.key === key);
}

export function isManualCriterion(key: string): boolean {
  const def = getCriterionDef(key);
  return def?.manual ?? key.startsWith('CUSTOM');
}
