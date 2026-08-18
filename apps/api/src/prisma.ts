import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: { db: { url: env.DATABASE_URL } },
});

/**
 * No SQLite o modo WAL permite leituras simultaneas durante uma escrita, e o
 * busy_timeout evita erro imediato quando duas requisicoes gravam ao mesmo
 * tempo. Sem isso o banco trava sob concorrencia mesmo em volume pequeno.
 */
export async function prepararBanco(): Promise<void> {
  if (env.ehPostgres) return;
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');
}

export async function desconectarPrisma(): Promise<void> {
  await prisma.$disconnect();
}
