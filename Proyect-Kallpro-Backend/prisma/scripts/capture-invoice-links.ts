/**
 * PASO 1 (correr ANTES de `prisma migrate dev`).
 *
 * La migración del despacho parcial ELIMINA la columna sales_orders."invoiceId" (relación 1:1)
 * y la reemplaza por invoices."salesOrderId" (1:N). Para no perder el histórico, aquí capturamos
 * el mapeo actual pedido→factura (vía SQL crudo, porque el modelo Prisma ya no expone invoiceId)
 * y lo guardamos en un JSON. Luego, tras migrar, restore-invoice-links.ts lo reescribe.
 *
 *   npm run db:capture-invoice-links
 */
import { prisma } from '../../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.join(__dirname, '.invoice-links.json');

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; invoiceId: string }>>(
    `SELECT id, "invoiceId" FROM sales_orders WHERE "invoiceId" IS NOT NULL`,
  );
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`[capture] ${rows.length} vínculos pedido→factura guardados en ${path.basename(OUT)}`);
  console.log('[capture] Ahora corre la migración y luego: npm run db:restore-invoice-links');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
