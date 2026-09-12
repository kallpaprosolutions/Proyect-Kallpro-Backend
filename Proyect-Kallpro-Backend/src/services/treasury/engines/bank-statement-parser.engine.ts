// Motor PURO (sin BD) — B2: parseo de extractos bancarios CSV/OFX con presets por banco.
// Los bancos ecuatorianos exportan columnas distintas (Pichincha, Produbanco, etc.); en vez de
// adivinar el nombre EXACTO de cada columna (frágil: cambia entre versiones del portal), el
// motor detecta columnas por una lista amplia de alias en español y castea fecha/monto según
// el preset del banco. El preset "GENERICO" preserva el formato fijo que ya existía
// (fecha;descripción;referencia;monto, sin encabezado) para no romper nada existente.

export type DateFormat = 'DMY' | 'YMD' | 'MDY';

export interface BankPreset {
  key: string;
  label: string;
  delimiter?: string; // undefined = autodetectar entre , ; \t
  hasHeader: boolean;
  dateFormat: DateFormat;
  decimalSeparator: '.' | ',';
  columnAliases: {
    date: string[];
    description: string[];
    reference: string[];
    amount: string[]; // columna única con signo
    debit: string[];  // alternativa: débito/crédito en columnas separadas
    credit: string[];
  };
}

export const BANK_PRESETS: Record<string, BankPreset> = {
  GENERICO: {
    key: 'GENERICO', label: 'Genérico (fecha;descripción;referencia;monto)',
    delimiter: ';', hasHeader: false, dateFormat: 'YMD', decimalSeparator: '.',
    columnAliases: { date: [], description: [], reference: [], amount: [], debit: [], credit: [] },
  },
  PICHINCHA: {
    key: 'PICHINCHA', label: 'Banco Pichincha',
    hasHeader: true, dateFormat: 'DMY', decimalSeparator: '.',
    columnAliases: {
      date: ['fecha', 'fecha transaccion', 'fecha de transaccion', 'fecha operacion'],
      description: ['concepto', 'descripcion', 'detalle', 'glosa', 'movimiento'],
      reference: ['referencia', 'documento', 'numero documento', 'nro documento', 'comprobante'],
      amount: ['valor', 'monto', 'importe'],
      debit: ['debito', 'valor debito', 'egreso'],
      credit: ['credito', 'valor credito', 'ingreso'],
    },
  },
  PRODUBANCO: {
    key: 'PRODUBANCO', label: 'Produbanco',
    hasHeader: true, dateFormat: 'DMY', decimalSeparator: '.',
    columnAliases: {
      date: ['fecha', 'fecha valor', 'fecha de la transaccion'],
      description: ['detalle', 'descripcion', 'concepto de la transaccion', 'concepto'],
      reference: ['referencia', 'numero de documento', 'documento', 'oficina'],
      amount: ['valor de la transaccion', 'valor', 'monto'],
      debit: ['debitos', 'debito'],
      credit: ['creditos', 'credito'],
    },
  },
};

export interface StatementLineInput {
  date: string; // AAAA-MM-DD
  description: string;
  reference?: string;
  amount: number; // + crédito (ingreso) · − débito (egreso)
}

export interface ParseResult {
  lines: StatementLineInput[];
  skipped: number;
}

function normalizeHeader(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  for (const ch of line) if (ch in counts) counts[ch]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ';';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  // Soporta valores entre comillas con el delimitador dentro (CSV estándar simplificado).
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delimiter && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseDate(raw: string, format: DateFormat): string | null {
  const clean = raw.trim();
  // ISO ya viene listo (algunos bancos exportan AAAA-MM-DD sin importar el preset).
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const m = clean.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!m) return null;
  let [, a, b, c] = m;
  let year: string, month: string, day: string;
  if (format === 'YMD') { year = a; month = b; day = c; }
  else if (format === 'MDY') { month = a; day = b; year = c; }
  else { day = a; month = b; year = c; } // DMY
  if (year.length === 2) year = `20${year}`;
  if (year.length !== 4) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseAmount(raw: string, decimalSeparator: '.' | ','): number {
  let clean = raw.trim().replace(/[$\s]/g, '');
  if (!clean) return NaN;
  const negative = /^\(.*\)$/.test(clean); // "(150.00)" = negativo, convención contable
  clean = clean.replace(/[()]/g, '');
  if (decimalSeparator === ',') {
    clean = clean.replace(/\./g, '').replace(',', '.'); // 1.234,56 → 1234.56
  } else {
    clean = clean.replace(/,/g, ''); // 1,234.56 → 1234.56
  }
  const n = parseFloat(clean);
  if (isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parsea un CSV con el preset del banco (o el formato genérico fijo si es GENERICO). */
export function parseBankCsv(text: string, presetKey: string): ParseResult {
  const preset = BANK_PRESETS[presetKey] ?? BANK_PRESETS.GENERICO;
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (rawLines.length === 0) return { lines: [], skipped: 0 };

  const delimiter = preset.delimiter ?? detectDelimiter(rawLines[0]);

  if (!preset.hasHeader) {
    // Formato genérico fijo, sin encabezado: fecha;descripción;referencia;monto (la referencia puede venir vacía).
    const lines: StatementLineInput[] = [];
    let skipped = 0;
    for (const raw of rawLines) {
      if (raw.toLowerCase().startsWith('fecha')) continue; // tolera un encabezado accidental
      const parts = splitCsvLine(raw, delimiter);
      const [dateRaw, description, reference, amountRaw] = parts.length >= 4
        ? parts : [parts[0], parts[1], '', parts[2]];
      const date = parseDate(dateRaw ?? '', preset.dateFormat);
      const amount = parseAmount(amountRaw ?? '', preset.decimalSeparator);
      if (!date || !description || !Number.isFinite(amount) || amount === 0) { skipped++; continue; }
      lines.push({ date, description: description.trim(), reference: reference?.trim() || undefined, amount });
    }
    return { lines, skipped };
  }

  // Preset con encabezado: detectar columnas por alias.
  const headers = splitCsvLine(rawLines[0], delimiter);
  const dateIdx = findColumnIndex(headers, preset.columnAliases.date);
  const descIdx = findColumnIndex(headers, preset.columnAliases.description);
  const refIdx = findColumnIndex(headers, preset.columnAliases.reference);
  const amountIdx = findColumnIndex(headers, preset.columnAliases.amount);
  const debitIdx = findColumnIndex(headers, preset.columnAliases.debit);
  const creditIdx = findColumnIndex(headers, preset.columnAliases.credit);

  if (dateIdx < 0 || (amountIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
    throw new Error(`PRESET_COLUMNS_NOT_FOUND:${preset.label}`);
  }

  const lines: StatementLineInput[] = [];
  let skipped = 0;
  for (const raw of rawLines.slice(1)) {
    const cols = splitCsvLine(raw, delimiter);
    const dateStr = cols[dateIdx] ?? '';
    const date = parseDate(dateStr, preset.dateFormat);

    let amount: number;
    if (amountIdx >= 0) {
      amount = parseAmount(cols[amountIdx] ?? '', preset.decimalSeparator);
    } else {
      const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx] ?? '', preset.decimalSeparator) : 0;
      const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] ?? '', preset.decimalSeparator) : 0;
      amount = (Number.isFinite(credit) ? Math.abs(credit) : 0) - (Number.isFinite(debit) ? Math.abs(debit) : 0);
    }

    const description = descIdx >= 0 ? (cols[descIdx] ?? '').trim() : 'Movimiento del extracto';
    const reference = refIdx >= 0 ? (cols[refIdx] ?? '').trim() || undefined : undefined;

    if (!date || !Number.isFinite(amount) || amount === 0) { skipped++; continue; }
    lines.push({ date, description, reference, amount });
  }
  return { lines, skipped };
}

/** Parsea un extracto OFX/QFX (formato SGML de bancos — a menudo sin tags de cierre). */
export function parseOfx(text: string): ParseResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1); // el primer trozo es la cabecera, se descarta
  const lines: StatementLineInput[] = [];
  let skipped = 0;

  const extractTag = (block: string, tag: string): string | null => {
    const re = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i');
    return re.exec(block)?.[1]?.trim() || null;
  };

  for (const rawBlock of blocks) {
    const block = rawBlock.split(/<\/STMTTRN>/i)[0]; // corta en el cierre si existe, o toma todo el resto
    const dtPosted = extractTag(block, 'DTPOSTED');
    const trnAmt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME') || extractTag(block, 'MEMO') || 'Movimiento OFX';
    const ref = extractTag(block, 'CHECKNUM') || extractTag(block, 'REFNUM') || extractTag(block, 'FITID') || undefined;

    if (!dtPosted || !trnAmt) { skipped++; continue; }
    // DTPOSTED: AAAAMMDD[hhmmss][.xxx][[tz:TZ]] — solo interesan los primeros 8 dígitos.
    const dateDigits = dtPosted.replace(/\D/g, '').slice(0, 8);
    if (dateDigits.length !== 8) { skipped++; continue; }
    const date = `${dateDigits.slice(0, 4)}-${dateDigits.slice(4, 6)}-${dateDigits.slice(6, 8)}`;
    const amount = parseFloat(trnAmt.replace(',', '.'));
    if (!Number.isFinite(amount) || amount === 0) { skipped++; continue; }

    lines.push({ date, description: name, reference: ref, amount });
  }

  return { lines, skipped };
}
