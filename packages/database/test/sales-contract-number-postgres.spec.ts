import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Pool } from 'pg';
import { describe, expect, it } from 'vitest';

describe.skipIf(process.env.SALES_NUMBER_TEST !== '1')(
  'six-digit contract numbers in PostgreSQL',
  () => {
    it('preserves old numbers, allocates concurrent unique numbers and skips imported numbers', async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55481' ||
        url.pathname !== '/contract_number_test'
      )
        throw new Error('Only disposable contract_number_test is allowed');
      const client = new Client({ connectionString: url.toString() });
      const pool = new Pool({ connectionString: url.toString(), max: 8 });
      await client.connect();
      const sql = readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261003170000_sales_six_digit_contract_numbers/migration.sql',
        ),
        'utf8',
      );
      try {
        await client.query(
          "CREATE SCHEMA number_test; SET search_path TO number_test; CREATE TABLE sales_contracts (contract_number TEXT UNIQUE); INSERT INTO sales_contracts VALUES ('SC-2026-000009')",
        );
        await client.query(sql);
        expect(
          (
            await client.query(
              "SELECT nextval('sales_contract_public_number_seq') AS value",
            )
          ).rows[0].value,
        ).toBe('120123');
        const values = await Promise.all(
          Array.from(
            { length: 24 },
            async () =>
              (
                await pool.query(
                  "SELECT nextval('number_test.sales_contract_public_number_seq') AS value",
                )
              ).rows[0].value,
          ),
        );
        expect(new Set(values).size).toBe(24);
        expect(values.map(Number).sort((a, b) => a - b)).toEqual(
          Array.from({ length: 24 }, (_, i) => 120124 + i),
        );
        expect(
          (await client.query('SELECT contract_number FROM sales_contracts'))
            .rows[0].contract_number,
        ).toBe('SC-2026-000009');
        await client.query(
          "CREATE SCHEMA number_import_test; SET search_path TO number_import_test; CREATE TABLE sales_contracts (contract_number TEXT UNIQUE); INSERT INTO sales_contracts VALUES ('120150')",
        );
        await client.query(sql);
        expect(
          (
            await client.query(
              "SELECT nextval('sales_contract_public_number_seq') AS value",
            )
          ).rows[0].value,
        ).toBe('120151');
        await client.query(
          "SELECT setval('sales_contract_public_number_seq', 999999, false)",
        );
        expect(
          (
            await client.query(
              "SELECT nextval('sales_contract_public_number_seq') AS value",
            )
          ).rows[0].value,
        ).toBe('999999');
        await expect(
          client.query("SELECT nextval('sales_contract_public_number_seq')"),
        ).rejects.toThrow(/maximum value/);
      } finally {
        await pool.end();
        await client.query(
          'SET search_path TO public; DROP SCHEMA IF EXISTS number_test CASCADE; DROP SCHEMA IF EXISTS number_import_test CASCADE',
        );
        await client.end();
      }
    });
  },
);
