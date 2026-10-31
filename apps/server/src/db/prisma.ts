import { PrismaClient } from '@prisma/client';

export function createPrisma(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
}
