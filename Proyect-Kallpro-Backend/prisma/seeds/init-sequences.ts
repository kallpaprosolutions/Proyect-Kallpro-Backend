/**
 * Backfill manual de DocumentSequence (todos los tipos, por companyId).
 * La lógica vive en src/lib/init-sequences.ts (reutilizada por el auto-seed del arranque).
 *
 *   npm run db:init-sequences
 */
import { prisma } from '../../src/lib/prisma';
import { backfillDocumentSequences } from '../../src/lib/init-sequences';

backfillDocumentSequences()
  .then(() => console.log('[init-sequences] backfill completo'))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
