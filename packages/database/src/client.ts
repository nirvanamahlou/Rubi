import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

export type DatabaseClient = PrismaClient;

export function createDatabaseClient(
  databaseUrl = process.env.DATABASE_URL,
): DatabaseClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create Prisma Client.');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
