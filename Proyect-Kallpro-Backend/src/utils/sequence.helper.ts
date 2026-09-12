import { Prisma } from '@prisma/client';

/**
 * Numeración ATÓMICA de documentos.
 *
 * Debe ejecutarse SIEMPRE dentro de una transacción (`prisma.$transaction(async (tx) => ...)`)
 * para que el incremento del correlativo y la creación del documento ocurran de forma atómica.
 * El `upsert` con `increment: 1` evita que dos requests concurrentes obtengan el mismo número.
 *
 * @example
 *   const number = await prisma.$transaction(async (tx) => {
 *     const n = await getNextDocumentNumber(tx, companyId, 'SALES_QUOTATION', 'COT-');
 *     return tx.salesQuotation.create({ data: { quoteNumber: n, ... } });
 *   });
 *
 * ⚠️ Si la base ya tiene documentos con numeración previa (ej. COT-0001), corre el seed
 *    `prisma/seeds/init-sequences.ts` una vez para inicializar `lastNumber` al máximo actual
 *    y evitar colisiones con el índice único.
 */
export async function getNextDocumentNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  docType: string,
  prefix: string,
  padding: number = 4,
): Promise<string> {
  // Reintento ante P2002 (unique constraint): cubre la carrera del PRIMER INSERT, cuando
  // dos transacciones intentan crear la misma fila (companyId, docType) a la vez. Una vez
  // que la fila existe, el upsert toma siempre el camino UPDATE (con lock de fila), que es
  // seguro bajo concurrencia. La protección definitiva es el seed init-sequences, que crea
  // las filas por adelantado para que nunca se ejecute el INSERT en caliente.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await tx.documentSequence.upsert({
        where: { companyId_docType: { companyId, docType } },
        update: { lastNumber: { increment: 1 } },
        create: { companyId, docType, prefix, lastNumber: 1, padding },
      });
      const padded = String(result.lastNumber).padStart(result.padding, '0');
      return `${result.prefix}${padded}`;
    } catch (e: any) {
      if (e?.code === 'P2002') { lastErr = e; continue; }
      throw e;
    }
  }
  throw lastErr;
}
