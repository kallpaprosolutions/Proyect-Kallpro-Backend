import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadClientCsv } from './csv';

/**
 * downloadClientCsv genera el archivo en el cliente con el MISMO formato que el
 * backend: UTF-8 + BOM, separador ';' y decimales con coma. Estos tests capturan
 * el Blob que se descargaría y verifican su contenido.
 */
describe('downloadClientCsv', () => {
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => { capturedBlob = b; return 'blob:test'; }),
      revokeObjectURL: vi.fn(),
    });
    // Evita la navegación "no implementada" de jsdom al hacer click en el <a>
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('genera CSV con separador ; y decimales con coma', async () => {
    downloadClientCsv('reporte.csv', ['Cuenta', 'Saldo'], [['10101', 500.5], ['1010306', 490]]);
    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    const lines = text.split('\r\n');
    expect(lines[0]).toContain('Cuenta;Saldo');
    expect(lines[1]).toBe('10101;500,50');
    expect(lines[2]).toBe('1010306;490,00');
  });

  it('incluye BOM UTF-8 para que Excel abra acentos correctamente', async () => {
    downloadClientCsv('x.csv', ['Descripción'], [['año']]);
    // blob.text() quita el BOM al decodificar; se verifican los bytes crudos EF BB BF.
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('escapa celdas con punto y coma, comillas o saltos de línea', async () => {
    downloadClientCsv('x.csv', ['Glosa'], [['pago; parcial'], ['dijo "hola"'], ['línea1\nlínea2']]);
    const text = await capturedBlob!.text();
    expect(text).toContain('"pago; parcial"');
    expect(text).toContain('"dijo ""hola"""');
    expect(text).toContain('"línea1\nlínea2"');
  });

  it('convierte null y undefined en celdas vacías', async () => {
    downloadClientCsv('x.csv', ['A', 'B'], [[null, undefined]]);
    const text = await capturedBlob!.text();
    expect(text.split('\r\n')[1]).toBe(';');
  });
});
