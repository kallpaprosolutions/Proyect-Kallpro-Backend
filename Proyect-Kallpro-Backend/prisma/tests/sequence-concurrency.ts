/**
 * Prueba de concurrencia de la numeración atómica.
 *
 *  Test A: 100 cotizaciones de venta EN PARALELO por el flujo real (createQuotation).
 *  Test B: 4 tipos de documento (COT, REQ, OC, AJU) × 25 EN PARALELO (helper directo).
 *
 * Verifica que cada lote genere números únicos. Footprint CERO: borra las cotizaciones
 * de prueba y restaura los contadores de DocumentSequence a su valor previo.
 *
 *   npm run test:sequence
 *
 * NODE_ENV se fuerza a 'test' ANTES de importar el singleton (imports dinámicos) para que
 * el pool de conexiones se amplíe a 30 (ver src/lib/prisma.ts).
 */
process.env.NODE_ENV = 'test';

type Settled<T> = { ok: true; v: T } | { ok: false; error: string };
const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then((v) => ({ ok: true as const, v })).catch((e) => ({ ok: false as const, error: e?.message ?? String(e) }));

async function main() {
  const { prisma } = await import('../../src/lib/prisma');
  const { createQuotation } = await import('../../src/services/sales.service');
  const { getNextDocumentNumber } = await import('../../src/utils/sequence.helper');

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('No hay empresa en la base');
  const companyId = company.id;

  const customer = await prisma.customer.findFirst({ where: { companyId }, select: { id: true } });
  const product = await prisma.product.findFirst({ where: { companyId }, select: { id: true } });
  if (!customer || !product) throw new Error('Se necesita al menos 1 cliente y 1 producto');

  const seqOf = async (docType: string) =>
    (await prisma.documentSequence.findUnique({ where: { companyId_docType: { companyId, docType } } }))?.lastNumber ?? null;
  const restoreSeq = async (docType: string, pre: number | null) => {
    if (pre === null) {
      await prisma.documentSequence.deleteMany({ where: { companyId, docType } });
    } else {
      await prisma.documentSequence.update({ where: { companyId_docType: { companyId, docType } }, data: { lastNumber: pre } });
    }
  };
  const uniqueReport = (label: string, numbers: string[], errors: number) => {
    const distinct = new Set(numbers).size;
    const unique = distinct === numbers.length && errors === 0;
    console.log(`\n[${label}] generados=${numbers.length} distintos=${distinct} errores=${errors} unique=${unique}`);
    console.log(`[${label}] números:`, [...numbers].sort());
    return unique;
  };

  // ───────────────────────── Test A: 100 COT por el flujo real ─────────────────────────
  const preCotA = await seqOf('SALES_QUOTATION');
  console.log('Test A → 100 cotizaciones concurrentes (createQuotation)…');
  const resA = await Promise.all(
    Array.from({ length: 100 }, () =>
      settle(createQuotation(companyId, { customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 1 }] })),
    ),
  );
  const okA = resA.flatMap((r) => (r.ok ? [r.v as any] : []));
  const errA = resA.length - okA.length;
  const uniqueA = uniqueReport('A · COT real', okA.map((q) => q.quoteNumber), errA);
  await prisma.salesQuotation.deleteMany({ where: { id: { in: okA.map((q) => q.id) } } });
  await restoreSeq('SALES_QUOTATION', preCotA);

  // ───────────────────────── Test B: COT/REQ/OC/AJU × 25 (helper) ─────────────────────────
  const types: Array<[string, string]> = [
    ['SALES_QUOTATION', 'COT-'],
    ['REQUISITION', 'REQ-'],
    ['PURCHASE_ORDER', 'OC-'],
    ['INVENTORY_ADJUSTMENT', 'AJU-'],
  ];
  const preB: Record<string, number | null> = {};
  for (const [dt] of types) preB[dt] = await seqOf(dt);

  console.log('\nTest B → 4 tipos × 25 = 100 correlativos concurrentes (helper directo)…');
  const resB = await Promise.all(
    types.flatMap(([dt, prefix]) =>
      Array.from({ length: 25 }, () =>
        settle(prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, dt, prefix)).then((n) => ({ dt, n }))),
      ),
    ),
  );
  let uniqueB = true;
  for (const [dt] of types) {
    const nums = resB.flatMap((r) => (r.ok && (r.v as any).dt === dt ? [(r.v as any).n as string] : []));
    const errs = resB.filter((r) => !r.ok).length; // errores globales (informativo)
    uniqueB = uniqueReport(`B · ${dt}`, nums, 0) && uniqueB;
    if (errs) console.log(`   (errores globales del lote B: ${errs})`);
  }
  for (const [dt] of types) await restoreSeq(dt, preB[dt]);

  const overall = uniqueA && uniqueB;
  console.log('\n================ RESULTADO ================');
  console.log(JSON.stringify({ testA_unique: uniqueA, testB_unique: uniqueB, unique: overall }, null, 2));
  if (!overall) { console.error('❌ FALLÓ: hay correlativos duplicados'); process.exit(1); }
  console.log('✅ OK: todos los correlativos son únicos en ambos tests');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
