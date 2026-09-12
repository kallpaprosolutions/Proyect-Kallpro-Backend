/**
 * PASO 3 (correr DESPUÉS de `prisma migrate dev`).
 *
 * Lee el mapeo capturado por capture-invoice-links.ts y rellena invoices."salesOrderId"
 * para no perder el vínculo pedido→factura tras eliminar sales_orders."invoiceId".
 * Idempotente (solo escribe donde salesOrderId está NULL).
 *
 *   npm run db:restore-invoice-links
 */
import { prisma } from '../../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const IN = path.join(__dirname, '.invoice-links.json');

async function main() {
  if (!fs.existsSync(IN)) {
    console.log('[restore] No hay archivo de captura (.invoice-links.json); nada que restaurar.');
    return;
  }
  const rows: Array<{ id: string; invoiceId: string }> = JSON.parse(fs.readFileSync(IN, 'utf8'));
  let n = 0;
  for (const r of rows) {
    const affected = await prisma.$executeRaw`
      UPDATE "invoices" SET "salesOrderId" = ${r.id}
      WHERE "id" = ${r.invoiceId} AND "salesOrderId" IS NULL`;
    n += Number(affected);
  }
  console.log(`[restore] ${n} factura(s) re-vinculadas a su pedido de venta.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
