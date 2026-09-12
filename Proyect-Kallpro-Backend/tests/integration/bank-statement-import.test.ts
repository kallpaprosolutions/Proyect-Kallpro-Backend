import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { parseBankCsv, parseOfx } from '../../src/services/treasury/engines/bank-statement-parser.engine';
import { importStatement } from '../../src/services/reconciliation.service';

/**
 * Integración con BD real: B2 — un CSV real de banco (con encabezado y columnas propias,
 * no el formato fijo genérico) se parsea con el preset correcto y se importa/concilia
 * exactamente igual que el flujo genérico ya probado en Sprint 9.1 — cero lógica de
 * conciliación duplicada, el parser solo produce la misma forma `StatementLineInput[]`.
 */
const TAG = `bankimp_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let bankAccountId = '';

async function cleanup() {
  await prisma.bankStatementLine.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.bankTransaction.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.bankAccount.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
  const account = await prisma.bankAccount.create({
    data: { companyId, bankCode: 'PICHINCHA', bankName: 'Banco Pichincha', accountNumber: '1234567890', alias: 'Pichincha principal' },
  });
  bankAccountId = account.id;

  // Movimiento REGISTRADO ya existente en el sistema (ej. un pago) que el extracto debe conciliar.
  await prisma.bankTransaction.create({
    data: {
      companyId, bankAccountId, type: 'EGRESO', method: 'TRANSFERENCIA',
      amount: new Prisma.Decimal(150.50), date: new Date('2026-07-09T00:00:00Z'),
      reference: 'FAC-001', status: 'REGISTRADO',
    },
  });
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('B2 — import de extracto CSV con preset de banco (e2e con BD real)', () => {
  it('parsea un CSV estilo Pichincha (encabezado + columnas propias) y concilia automáticamente por referencia', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    const csv = 'Fecha,Concepto,Referencia,Valor\n09/07/2026,PAGO PROVEEDOR XYZ,FAC-001,-150.50\n10/07/2026,DEPOSITO CLIENTE,,300.00';
    const { lines, skipped } = parseBankCsv(csv, 'PICHINCHA');
    expect(skipped).toBe(0);
    expect(lines).toHaveLength(2);

    const result = await importStatement(companyId, bankAccountId, lines);
    expect(result.imported).toBe(2);
    expect(result.autoMatched).toBe(1); // el de -150.50 con referencia FAC-001 idéntica
    expect(result.pending).toBe(1);

    const txMatched = await prisma.bankTransaction.findFirst({ where: { companyId, reference: 'FAC-001' } });
    expect(txMatched!.status).toBe('CONCILIADO');

    const pendingLine = await prisma.bankStatementLine.findFirst({ where: { companyId, description: 'DEPOSITO CLIENTE' } });
    expect(pendingLine!.status).toBe('PENDIENTE');
    expect(Number(pendingLine!.amount)).toBe(300);
  });

  it('un OFX real se parsea y se importa por el mismo camino', async () => {
    if (!dbAvailable) return;
    const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260815
<TRNAMT>-25.00
<FITID>OFX-001
<NAME>COMISION MANEJO CUENTA
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const { lines } = parseOfx(ofx);
    expect(lines).toHaveLength(1);
    const result = await importStatement(companyId, bankAccountId, lines);
    expect(result.imported).toBe(1);
  });
});
