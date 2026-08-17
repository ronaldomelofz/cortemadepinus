import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: env.isProd ? ['error', 'warn'] : ['error', 'warn'],
});

export async function desconectarPrisma(): Promise<void> {
  await prisma.$disconnect();
}
