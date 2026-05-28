import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function makePrisma(): PrismaClient {
  const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: (env.NODE_ENV ?? process.env.NODE_ENV) === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// In dev, skip the global cache so hot-reloads always get a fresh client
// with the current env vars. In prod, cache to avoid connection pool exhaustion.
export const prisma =
  (env.NODE_ENV ?? process.env.NODE_ENV) === 'production'
    ? (globalForPrisma.prisma ??= makePrisma())
    : makePrisma();
