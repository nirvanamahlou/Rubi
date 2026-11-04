import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  Prisma,
  type DatabaseClient,
} from '@nora/database';
import {
  allocateSalesContractNumber,
  retrySalesContractCreate,
} from '../src/sales/sales-contract-number';

describe.skipIf(process.env.NORA_RUN_SALES_NUMBER_POSTGRES_TESTS !== '1')(
  'rollback-safe contract numbering on PostgreSQL',
  () => {
    let db: DatabaseClient;
    const schemas: string[] = [];
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.hostname !== '127.0.0.1' ||
        !(
          (process.env.CI === 'true' && url.pathname === '/nora_ci') ||
          (url.port === '55481' && url.pathname === '/contract_number_test')
        )
      )
        throw new Error('Only the disposable numbering database is allowed');
      db = createDatabaseClient(url.toString());
    });
    afterAll(async () => {
      if (!db) return;
      for (const schema of schemas)
        await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await db.$disconnect();
    });

    async function fixture(existing?: string, sequence?: number) {
      const schema = 'sales_number_' + randomUUID().replace(/-/g, '');
      schemas.push(schema);
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe(
          'CREATE TABLE sales_contracts (contract_number TEXT UNIQUE, request_key TEXT UNIQUE)',
        );
        if (existing)
          await tx.$executeRaw`INSERT INTO sales_contracts VALUES (${existing}, 'imported')`;
        for (const migration of [
          '20261003170000_sales_six_digit_contract_numbers',
          '20261029100000_sales_transactional_contract_numbers',
        ]) {
          if (sequence && migration.startsWith('20261029'))
            await tx.$queryRaw`SELECT setval('sales_contract_public_number_seq', ${sequence}, true)`;
          const sql = readFileSync(
            resolve(
              __dirname,
              '../../../packages/database/prisma/migrations',
              migration,
              'migration.sql',
            ),
            'utf8',
          );
          for (const statement of sql.split(';').filter((part) => part.trim()))
            await tx.$executeRawUnsafe(statement);
        }
      });
      return schema;
    }

    function create(schema: string, key: string, fail = false) {
      return retrySalesContractCreate(() =>
        db.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
            const number = await allocateSalesContractNumber(tx);
            await tx.$executeRaw`INSERT INTO sales_contracts VALUES (${number}, ${key})`;
            if (fail) throw new Error('Later contract service write failed');
            return number;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    }

    it('rolls back both allocated number and inserted contract on a later failure', async () => {
      const schema = await fixture();
      await expect(create(schema, 'failed', true)).rejects.toThrow(
        'Later contract service write failed',
      );
      expect(await create(schema, 'saved')).toBe('120123');
      await expect(create(schema, 'saved')).rejects.toMatchObject({
        code: 'P2010',
      });
      expect(await create(schema, 'next')).toBe('120124');
      const rows = await db.$queryRawUnsafe<Array<{ contract_number: string }>>(
        `SELECT contract_number FROM "${schema}".sales_contracts ORDER BY contract_number`,
      );
      expect(rows.map((row) => row.contract_number)).toEqual([
        '120123',
        '120124',
      ]);
    });

    it('commits concurrent unique numbers without gaps under Serializable contention', async () => {
      const schema = await fixture();
      const values = await Promise.all(
        Array.from({ length: 4 }, (_, i) => create(schema, `request-${i}`)),
      );
      expect(values.sort()).toEqual(['120123', '120124', '120125', '120126']);
    });

    it('preserves imported numbers and does not reuse the old sequence high-water mark', async () => {
      const schema = await fixture('120150', 120160);
      expect(await create(schema, 'next')).toBe('120161');
      const imported = await db.$queryRawUnsafe<
        Array<{ contract_number: string }>
      >(
        `SELECT contract_number FROM "${schema}".sales_contracts WHERE request_key = 'imported'`,
      );
      expect(imported[0]?.contract_number).toBe('120150');
      const higherImport = await fixture('120180', 120160);
      expect(await create(higherImport, 'next')).toBe('120181');
    });

    it('allows the last six-digit number then fails without wrapping or inserting a contract', async () => {
      const schema = await fixture(undefined, 999998);
      expect(await create(schema, 'last')).toBe('999999');
      await expect(create(schema, 'overflow')).rejects.toThrow(
        'numbering is unavailable or exhausted',
      );
      const rows = await db.$queryRawUnsafe<Array<{ last_number: number }>>(
        `SELECT last_number FROM "${schema}".sales_contract_number_counters`,
      );
      expect(rows[0]?.last_number).toBe(999999);
    });
  },
);
