import { Response } from 'express';

/**
 * Export CSV para reportes contables (Sprint 6).
 * UTF-8 con BOM y separador `;` para que Excel en español lo abra directo
 * (locale es-EC usa coma decimal, así que `;` evita que rompa columnas).
 */

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))];
  return '﻿' + lines.join('\r\n');
}

/** Envía un CSV como descarga (attachment). */
export function sendCsv(res: Response, filename: string, headers: string[], rows: unknown[][]): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(headers, rows));
}
