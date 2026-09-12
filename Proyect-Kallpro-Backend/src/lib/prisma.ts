import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma ÚNICO (singleton) para todo el backend.
 *
 * Antes cada servicio hacía `new PrismaClient()` (50+ instancias) → cada una abre su
 * propio pool de conexiones, agotando la base bajo carga. Aquí se centraliza en una sola
 * instancia. En desarrollo se guarda en `globalThis` para que el hot-reload de nodemon/
 * ts-node no cree una instancia nueva en cada recarga.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // En tests ampliamos el pool para soportar ráfagas de transacciones concurrentes
  // (p.ej. test:sequence lanza 100+ transacciones a la vez).
  if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL) {
    const base = process.env.DATABASE_URL;
    const url = base.includes('connection_limit=')
      ? base
      : `${base}${base.includes('?') ? '&' : '?'}connection_limit=30`;
    return new PrismaClient({ datasourceUrl: url });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Cierre graceful de conexiones cuando el proceso va a terminar.
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
