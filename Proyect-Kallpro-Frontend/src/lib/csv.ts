/**
 * CSV en el cliente para reportes pequeños ya cargados en pantalla
 * (BG, ER, formularios 103/104). Los reportes grandes (diario, mayor,
 * balanza) se descargan del backend con format=csv.
 * Mismo formato que el backend: UTF-8 + BOM, separador `;`, decimales con coma.
 */
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadClientCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
