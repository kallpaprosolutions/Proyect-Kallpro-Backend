/**
 * Catálogo de instituciones financieras del Ecuador para Tesorería.
 *
 * `swift` es el BIC de 8 caracteres para transferencias internacionales
 * (verificados los principales contra directorios SWIFT públicos; los que no
 * tienen BIC operativo conocido van en null — se puede escribir manualmente
 * en la cuenta). Para pagos al exterior el sistema pide siempre el BIC del
 * banco DESTINO en la transacción.
 *
 * NOTA DE INTEGRACIÓN: los bancos ecuatorianos no exponen APIs públicas de
 * pagos; la integración operativa hoy es por archivos de Cash Management
 * (CSV/TXT que se cargan en la banca empresarial de cada banco). Este
 * catálogo alimenta la capa `treasury` que ya deja los movimientos vinculados
 * a obligación + asiento, de modo que conectar un canal directo (API/Open
 * Banking o archivos) sea solo agregar un adaptador. Ver
 * "Arquitectura KallpaPro/tesoreria-biometrico.md".
 */

export interface BancoEc {
  code: string;      // código interno estable del catálogo
  name: string;
  swift: string | null;
  type: 'BANCO' | 'COOPERATIVA' | 'MUTUALISTA' | 'PUBLICO';
}

export const BANCOS_ECUADOR: BancoEc[] = [
  { code: 'PICHINCHA',     name: 'Banco Pichincha',                swift: 'PICHECEQ', type: 'BANCO' },
  { code: 'GUAYAQUIL',     name: 'Banco Guayaquil',                swift: 'GUAYECEG', type: 'BANCO' },
  { code: 'PACIFICO',      name: 'Banco del Pacífico',             swift: 'PACIECEG', type: 'BANCO' },
  { code: 'PRODUBANCO',    name: 'Produbanco (Banco de la Producción)', swift: 'PRODECEQ', type: 'BANCO' },
  { code: 'BOLIVARIANO',   name: 'Banco Bolivariano',              swift: 'BBOLECEG', type: 'BANCO' },
  { code: 'INTERNACIONAL', name: 'Banco Internacional',            swift: 'BINTECEQ', type: 'BANCO' },
  { code: 'AUSTRO',        name: 'Banco del Austro',               swift: 'AUSTECEC', type: 'BANCO' },
  { code: 'MACHALA',       name: 'Banco de Machala',               swift: null,       type: 'BANCO' },
  { code: 'LOJA',          name: 'Banco de Loja',                  swift: null,       type: 'BANCO' },
  { code: 'RUMINAHUI',     name: 'Banco General Rumiñahui',        swift: null,       type: 'BANCO' },
  { code: 'SOLIDARIO',     name: 'Banco Solidario',                swift: null,       type: 'BANCO' },
  { code: 'PROCREDIT',     name: 'Banco ProCredit',                swift: null,       type: 'BANCO' },
  { code: 'AMAZONAS',      name: 'Banco Amazonas',                 swift: null,       type: 'BANCO' },
  { code: 'CITIBANK_EC',   name: 'Citibank Ecuador',               swift: 'CITIECEQ', type: 'BANCO' },
  { code: 'BANECUADOR',    name: 'BanEcuador B.P.',                swift: null,       type: 'PUBLICO' },
  { code: 'CFN',           name: 'CFN (Corporación Financiera Nacional)', swift: null, type: 'PUBLICO' },
  { code: 'JEP',           name: 'Cooperativa JEP',                swift: null,       type: 'COOPERATIVA' },
  { code: 'JARDIN_AZUAYO', name: 'Cooperativa Jardín Azuayo',      swift: null,       type: 'COOPERATIVA' },
  { code: 'POLICIA',       name: 'Cooperativa Policía Nacional',   swift: null,       type: 'COOPERATIVA' },
  { code: '29_OCTUBRE',    name: 'Cooperativa 29 de Octubre',      swift: null,       type: 'COOPERATIVA' },
  { code: 'EXTRANJERO',    name: 'Banco del exterior (SWIFT)',     swift: null,       type: 'BANCO' },
];

/**
 * Día máximo de pago del IVA/retenciones mensuales según el 9.º dígito del RUC
 * (SRI): 1→10, 2→12, … 9→26, 0→28 del mes siguiente. Contribuyentes especiales: día 9.
 */
export function sriDueDay(ruc: string | null | undefined, isSpecialTaxpayer = false): number {
  if (isSpecialTaxpayer) return 9;
  const ninth = ruc && ruc.length >= 9 ? Number(ruc[8]) : NaN;
  if (Number.isNaN(ninth)) return 28; // sin RUC configurado: fecha más tardía
  return ninth === 0 ? 28 : 8 + ninth * 2;
}

/** Las planillas de aportes IESS se pagan hasta el día 15 del mes siguiente. */
export const IESS_DUE_DAY = 15;
