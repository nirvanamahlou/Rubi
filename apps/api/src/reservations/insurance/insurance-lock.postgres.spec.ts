import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, Prisma } from '@nora/database';
import { lockInsurancePolicy } from './insurance.service';

describe.skipIf(process.env.INSURANCE_POLICY_TEST !== '1')(
  'insurance transaction locks through the real Prisma PostgreSQL adapter',
  () => {
    let db: ReturnType<typeof createDatabaseClient>;
    let competitor: ReturnType<typeof createDatabaseClient>;
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        !['/nora_ci', '/insurance_test'].includes(url.pathname)
      )
        throw new Error('Disposable insurance test database required');
      db = createDatabaseClient();
      competitor = createDatabaseClient();
    });
    afterAll(async () => {
      await db?.$disconnect();
      await competitor?.$disconnect();
    });

    it('reproduces the unsupported void result without touching policy data', async () => {
      const key = 'insurance-regression-' + randomUUID();
      await expect(
        db.$transaction(
          (tx) =>
            tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
        ),
      ).rejects.toMatchObject({ code: 'P2010' });
    });

    it.each(['commit', 'rollback'] as const)(
      'deserializes, excludes competing correction/confirmation and releases on %s',
      async (outcome) => {
        const contractId = randomUUID();
        const customerId = randomUUID();
        const key = 'insurance:' + contractId + ':' + customerId;
        const tryLock = () =>
          competitor.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<{ acquired: boolean }[]>(
              Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`,
            );
            return rows[0]?.acquired;
          });
        const operation = db.$transaction(async (tx) => {
          await lockInsurancePolicy(tx, contractId, customerId);
          // Re-entry is safe; both correction and confirmation use this helper.
          await lockInsurancePolicy(tx, contractId, customerId);
          expect(await tryLock()).toBe(false);
          if (outcome === 'rollback') throw new Error('synthetic rollback');
        });
        if (outcome === 'rollback')
          await expect(operation).rejects.toThrow('synthetic rollback');
        else await operation;
        expect(await tryLock()).toBe(true);
      },
    );
  },
);
