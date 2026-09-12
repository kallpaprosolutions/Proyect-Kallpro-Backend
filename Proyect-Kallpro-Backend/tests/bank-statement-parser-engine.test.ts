import { parseBankCsv, parseOfx } from '../src/services/treasury/engines/bank-statement-parser.engine';

describe('bank-statement-parser.engine', () => {
  describe('parseBankCsv — GENERICO (formato fijo existente, sin encabezado)', () => {
    it('parsea el formato fecha;descripción;referencia;monto', () => {
      const csv = '2026-07-09;PAGO PLANILLA IESS;Planilla 07-2026;-690.76\n2026-07-10;COMISION MANEJO CTA;;-4.50';
      const { lines, skipped } = parseBankCsv(csv, 'GENERICO');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ date: '2026-07-09', description: 'PAGO PLANILLA IESS', reference: 'Planilla 07-2026', amount: -690.76 });
      expect(lines[1].reference).toBeUndefined();
      expect(skipped).toBe(0);
    });

    it('tolera un encabezado accidental "fecha;..."', () => {
      const csv = 'fecha;descripcion;referencia;monto\n2026-07-09;Depósito;;100';
      const { lines } = parseBankCsv(csv, 'GENERICO');
      expect(lines).toHaveLength(1);
    });

    it('descarta líneas con monto 0 o fecha inválida', () => {
      const csv = '2026-07-09;Sin movimiento;;0\nno-es-una-fecha;Algo;;50';
      const { lines, skipped } = parseBankCsv(csv, 'GENERICO');
      expect(lines).toHaveLength(0);
      expect(skipped).toBe(2);
    });
  });

  describe('parseBankCsv — PICHINCHA (encabezado real, columnas por alias, fecha DMY)', () => {
    it('detecta columnas por nombre y convierte fecha DD/MM/AAAA', () => {
      const csv = 'Fecha,Concepto,Referencia,Valor\n09/07/2026,PAGO PROVEEDOR XYZ,FAC-001,-150.50\n10/07/2026,DEPOSITO CLIENTE,,300.00';
      const { lines } = parseBankCsv(csv, 'PICHINCHA');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ date: '2026-07-09', description: 'PAGO PROVEEDOR XYZ', reference: 'FAC-001', amount: -150.50 });
      expect(lines[1].amount).toBe(300);
    });

    it('soporta columnas Débito/Crédito separadas en vez de una columna con signo', () => {
      const csv = 'Fecha,Descripcion,Debito,Credito\n01/09/2026,Retiro cajero,50.00,0\n02/09/2026,Transferencia recibida,0,200.00';
      const { lines } = parseBankCsv(csv, 'PICHINCHA');
      expect(lines).toHaveLength(2);
      expect(lines[0].amount).toBe(-50);
      expect(lines[1].amount).toBe(200);
    });

    it('lanza un error claro si no reconoce ninguna columna esperada', () => {
      const csv = 'Col1,Col2,Col3\nA,B,C';
      expect(() => parseBankCsv(csv, 'PICHINCHA')).toThrow(/PRESET_COLUMNS_NOT_FOUND/);
    });
  });

  describe('parseBankCsv — PRODUBANCO', () => {
    it('detecta sus alias de columna propios', () => {
      const csv = 'Fecha Valor,Detalle,Documento,Valor de la Transaccion\n15/09/2026,Pago servicios,DOC-99,-25.00';
      const { lines } = parseBankCsv(csv, 'PRODUBANCO');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toEqual({ date: '2026-09-15', description: 'Pago servicios', reference: 'DOC-99', amount: -25 });
    });
  });

  describe('parseOfx', () => {
    it('extrae transacciones de un bloque OFX con tags sin cierre (SGML típico de bancos)', () => {
      const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260905120000
<TRNAMT>-45.90
<FITID>202609050001
<NAME>PAGO SERVICIOS BASICOS
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260906
<TRNAMT>300.00
<FITID>202609060001
<NAME>DEPOSITO CLIENTE
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
      const { lines, skipped } = parseOfx(ofx);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ date: '2026-09-05', description: 'PAGO SERVICIOS BASICOS', reference: '202609050001', amount: -45.90 });
      expect(lines[1].date).toBe('2026-09-06');
      expect(lines[1].amount).toBe(300);
      expect(skipped).toBe(0);
    });

    it('devuelve vacío (sin reventar) si el texto no tiene transacciones', () => {
      const { lines, skipped } = parseOfx('<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>');
      expect(lines).toHaveLength(0);
      expect(skipped).toBe(0);
    });
  });
});
