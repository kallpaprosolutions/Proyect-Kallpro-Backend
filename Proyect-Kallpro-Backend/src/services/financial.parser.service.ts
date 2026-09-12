/**
 * financial.parser.service.ts
 * Parses Balance Sheet (Balance de Situación) and Income Statement (Estado de Resultados)
 * from PDFs or Excel files exported from Odoo / Ecuador Superintendency format.
 *
 * Ecuador uses the Superintendency of Companies' NIIF-PYMES chart of accounts:
 *  1 ACTIVO | 2 PASIVO | 3 PATRIMONIO | 4 INGRESOS | 5 EGRESOS
 */

import pdfParse from 'pdf-parse';
import { logger } from '../lib/logger';
import ExcelJS from 'exceljs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAccount {
  code: string;
  name: string;
  value: number;
  depth: number; // code length as proxy for hierarchy depth
}

export interface FinancialDocument {
  company: string;
  period: string;
  docType: 'balance_sheet' | 'income_statement' | 'unknown';
  raw: ParsedAccount[];
  kpiFields: Record<string, number>;
  // For vertical analysis — includes all account entries
  structuredAccounts: ParsedAccount[];
}

export interface ParseStatementResult {
  balanceSheet: FinancialDocument | null;
  incomeStatement: FinancialDocument | null;
  // Combined KPI fields ready for calcKPIs
  bsFields: Record<string, number>;
  pygFields: Record<string, number>;
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Matches: "1101 EFECTIVO Y EQUIVALENTES AL EFECTIVO $ 156724.83"
// or:      "110101 Efectivo $ 0.00"
const ACCOUNT_LINE_RE = /^(\d{1,12})\s{1,}(.+?)\s{2,}\$\s*([-]?[\d,]+\.?\d*)\s*$/;

// Matches presentation headers: "ACTIVOS $ 11416572.75", "Ingreso $ 978292.87"
const HEADER_LINE_RE = /^(ACTIVOS|PASIVOS|PATRIMONIO|Ingreso|Ganancia bruta|Gastos?)\s+\$\s*([-]?[\d,]+\.?\d*)\s*$/i;

// Matches "Resultado del Ejercicio $ -4472.08" or "Resultado del Ejercicio $ 4472.08"
const RESULTADO_RE = /resultado del ejercicio\s+\$\s*([-]?[\d,]+\.?\d*)/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanNum(s: string): number {
  return parseFloat(s.replace(/,/g, '').trim());
}

function extractLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
}

// ─── Text parser ─────────────────────────────────────────────────────────────

interface ParsedText {
  accounts: ParsedAccount[];
  headers: Record<string, number>;
  resultado: number | null;
  allLines: string[];
}

function parseTextContent(text: string): ParsedText {
  const accounts: ParsedAccount[] = [];
  const headers: Record<string, number> = {};
  let resultado: number | null = null;
  const allLines = extractLines(text);

  for (const line of allLines) {
    // Account code line
    const aMatch = ACCOUNT_LINE_RE.exec(line);
    if (aMatch) {
      const v = cleanNum(aMatch[3]);
      if (!isNaN(v)) {
        accounts.push({ code: aMatch[1], name: aMatch[2].trim(), value: v, depth: aMatch[1].length });
      }
      continue;
    }

    // Presentation header
    const hMatch = HEADER_LINE_RE.exec(line);
    if (hMatch) {
      const v = cleanNum(hMatch[2]);
      if (!isNaN(v)) {
        headers[hMatch[1].toUpperCase()] = v;
      }
      continue;
    }

    // Resultado del Ejercicio
    const rMatch = RESULTADO_RE.exec(line);
    if (rMatch) {
      resultado = cleanNum(rMatch[1]);
    }
  }

  return { accounts, headers, resultado, allLines };
}

// ─── Document type detection ──────────────────────────────────────────────────

function detectDocType(allLines: string[]): 'balance_sheet' | 'income_statement' | 'unknown' {
  const joined = allLines.join(' ').toLowerCase();
  if (joined.includes('balance de situaci') || joined.includes('estado de situaci')) {
    return 'balance_sheet';
  }
  if (joined.includes('estado de resultados') || joined.includes('ganancia bruta') ||
      joined.includes('egresos')) {
    return 'income_statement';
  }
  // Fallback: look for ACTIVO/PASIVO → balance, COSTO DE VENTAS → income
  if (joined.includes('activo corriente') || joined.includes('pasivo corriente')) {
    return 'balance_sheet';
  }
  if (joined.includes('costo de ventas') && joined.includes('ingresos')) {
    return 'income_statement';
  }
  return 'unknown';
}

// ─── Code → field mapping for Balance Sheet ──────────────────────────────────

function mapBalanceSheet(accounts: ParsedAccount[], headers: Record<string, number>): Record<string, number> {
  // Build code map — for duplicate codes keep the one with larger absolute value
  // (Odoo PDFs can show code "2" twice: once for a subset, once for full pasivos)
  const cm: Record<string, number> = {};
  for (const acc of accounts) {
    if (!(acc.code in cm) || Math.abs(acc.value) > Math.abs(cm[acc.code])) {
      cm[acc.code] = acc.value;
    }
  }

  // Prefer presentation headers for top-level totals (they are always positive)
  const totalActivos = headers['ACTIVOS'] ?? Math.abs(cm['1'] ?? 0);
  const totalPasivos = headers['PASIVOS'] ?? Math.abs(cm['2'] ?? 0);
  const patrimonio   = headers['PATRIMONIO'] ?? (totalActivos - totalPasivos);

  return {
    // Assets
    efectivo:                   Math.abs(cm['1101'] ?? 0),
    cuentas_cobrar:             Math.abs(cm['110205'] ?? cm['110207'] ?? cm['1102'] ?? 0),
    inventario:                 Math.abs(cm['1103'] ?? 0),
    otros_activos_corrientes:   Math.abs((cm['1104'] ?? 0)) + Math.abs(cm['1105'] ?? 0),
    activos_no_corrientes:      Math.abs(cm['12'] ?? 0),
    activo_corriente:           Math.abs(cm['11'] ?? 0),
    total_activos:              totalActivos,
    // Liabilities
    cuentas_pagar:              Math.abs(cm['2103'] ?? cm['210301'] ?? 0),
    deuda_corto_plazo:          Math.abs(cm['2104'] ?? 0),
    otros_pasivos_corrientes:   Math.abs(cm['2107'] ?? 0) + Math.abs(cm['2110'] ?? 0) + Math.abs(cm['2114'] ?? 0),
    pasivo_corriente:           Math.abs(cm['21'] ?? 0),
    deuda_largo_plazo:          Math.abs(cm['22'] ?? 0),
    total_pasivos:              totalPasivos,
    // Equity
    patrimonio:                 Math.abs(patrimonio),
    // Constructions in progress (sector-specific)
    construcciones_proceso:     Math.abs(cm['1107'] ?? 0),
  };
}

// ─── Code → field mapping for Income Statement ────────────────────────────────

function mapIncomeStatement(
  accounts: ParsedAccount[],
  headers: Record<string, number>,
  resultado: number | null,
): Record<string, number> {
  const cm: Record<string, number> = {};
  for (const acc of accounts) {
    if (!(acc.code in cm) || Math.abs(acc.value) > Math.abs(cm[acc.code])) {
      cm[acc.code] = acc.value;
    }
  }

  const ingresos          = headers['INGRESO'] ?? Math.abs(cm['41'] ?? cm['4'] ?? 0);
  const costoVentas       = Math.abs(cm['51'] ?? 0);
  const gastosVentas      = Math.abs(cm['5201'] ?? 0);
  const gastosAdmin       = Math.abs(cm['5202'] ?? 0);
  const gastosFinancieros = Math.abs(cm['5203'] ?? 0);
  const otrosGastos       = Math.abs(cm['5204'] ?? 0);
  const depreciacion      = Math.abs(cm['520221'] ?? 0);

  // Resultado can be negative (loss) — preserve sign
  const utilidadNeta = resultado !== null
    ? resultado
    : ingresos - costoVentas - gastosVentas - gastosAdmin - gastosFinancieros - otrosGastos;

  return {
    ingresos,
    costo_ventas:        costoVentas,
    gastos_operativos:   gastosVentas + gastosAdmin,
    gastos_ventas:       gastosVentas,
    gastos_administrativos: gastosAdmin,
    depreciacion,
    gastos_financieros:  gastosFinancieros,
    otros_gastos:        otrosGastos,
    utilidad_neta:       utilidadNeta,
    utilidad_bruta:      ingresos - costoVentas,
    utilidad_operativa:  ingresos - costoVentas - gastosVentas - gastosAdmin,
  };
}

// ─── Company / period extraction ─────────────────────────────────────────────

function extractMeta(lines: string[]): { company: string; period: string } {
  // Company: usually in first 3 lines, doesn't start with a digit
  const company = lines
    .slice(0, 6)
    .find(l => l.length > 5 && !/^\d/.test(l) && !l.includes('Ecuador') && !l.includes('Guayaquil'))
    ?? 'Empresa';

  // Period: look for a date or year
  const periodLine = lines.find(l => /\d{2}\/\d{2}\/20\d{2}/.test(l) || /^20\d{2}$/.test(l));
  const period = periodLine?.match(/(\d{2}\/\d{2}\/20\d{2}|20\d{2})/)?.[0] ?? '';

  return { company, period };
}

// ─── Build structured account tree for vertical analysis ─────────────────────

function buildStructured(accounts: ParsedAccount[], docType: string): ParsedAccount[] {
  // Only include code levels that are meaningful for vertical analysis
  // Balance: 2-4 digit codes; Income: 2-6 digit codes
  const maxDepth = docType === 'income_statement' ? 6 : 4;
  return accounts.filter(a => a.code.length >= 2 && a.code.length <= maxDepth);
}

// ─── Core document builder ───────────────────────────────────────────────────

function buildDocument(text: string): FinancialDocument {
  const { accounts, headers, resultado, allLines } = parseTextContent(text);
  const docType = detectDocType(allLines);
  const { company, period } = extractMeta(allLines);

  const kpiFields = docType === 'balance_sheet'
    ? mapBalanceSheet(accounts, headers)
    : docType === 'income_statement'
      ? mapIncomeStatement(accounts, headers, resultado)
      : {};

  return {
    company,
    period,
    docType,
    raw: accounts,
    kpiFields,
    structuredAccounts: buildStructured(accounts, docType),
  };
}

// ─── PDF parser ───────────────────────────────────────────────────────────────

export async function parsePdfBuffer(buffer: Buffer): Promise<FinancialDocument> {
  const data = await pdfParse(buffer);
  return buildDocument(data.text);
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

export async function parseExcelBuffer(buffer: Buffer): Promise<FinancialDocument> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const lines: string[] = [];
  workbook.eachSheet(sheet => {
    sheet.eachRow(row => {
      const cells = (row.values as (string | number | null | undefined)[]).slice(1);
      const parts = cells
        .filter(c => c !== null && c !== undefined && String(c).trim().length > 0)
        .map(c => String(c).trim());
      if (parts.length >= 2) {
        // Reconstruct as "CODE  NAME  $ VALUE" format
        const lastPart = parts[parts.length - 1];
        const isNum = /^[-]?[\d,]+\.?\d*$/.test(lastPart);
        if (isNum && parts.length >= 2) {
          const code = parts[0];
          const name = parts.slice(1, -1).join(' ');
          lines.push(`${code}  ${name}  $ ${lastPart}`);
        } else {
          // Could be a header line like "ACTIVOS  11416572.75"
          lines.push(parts.join('  '));
        }
      }
    });
  });

  return buildDocument(lines.join('\n'));
}

// ─── Combined parse (both documents) ─────────────────────────────────────────

export async function parseStatements(
  bsBuffer: Buffer | null,
  bsMime: string,
  pygBuffer: Buffer | null,
  pygMime: string,
): Promise<ParseStatementResult> {
  const parseBuffer = async (buf: Buffer, mime: string): Promise<FinancialDocument | null> => {
    if (!buf) return null;
    try {
      const isExcel = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('xlsx');
      return isExcel ? await parseExcelBuffer(buf) : await parsePdfBuffer(buf);
    } catch (err) {
      logger.error('[financial.parser] Parse error', { err });
      return null;
    }
  };

  const [bs, pyg] = await Promise.all([
    bsBuffer ? parseBuffer(bsBuffer, bsMime) : Promise.resolve(null),
    pygBuffer ? parseBuffer(pygBuffer, pygMime) : Promise.resolve(null),
  ]);

  return {
    balanceSheet: bs,
    incomeStatement: pyg,
    bsFields: bs?.kpiFields ?? {},
    pygFields: pyg?.kpiFields ?? {},
  };
}
