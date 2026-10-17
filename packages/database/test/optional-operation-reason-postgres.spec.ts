import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
describe.skipIf(process.env.OPTIONAL_OPERATION_REASON_TEST !== '1')(
  'optional operation reason migration',
  () => {
    it('accepts empty reasons while preserving finite nonzero deltas, actor FK and immutable history', async () => {
      const url = new URL(process.env.DATABASE_URL!);
      expect(url.hostname).toBe('127.0.0.1');
      expect(url.port).toBe('55484');
      expect(url.pathname).toBe('/optional_reasons_test');
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query(
          'CREATE SCHEMA optional_reason_policy_test; SET search_path TO optional_reason_policy_test',
        );
        await client.query(
          'CREATE TABLE actors(id integer PRIMARY KEY); INSERT INTO actors VALUES (1); CREATE TABLE procurement_receipt_adjustment(id serial PRIMARY KEY, "actorUserId" integer NOT NULL REFERENCES actors(id), "receivedDelta" numeric NOT NULL, "acceptedDelta" numeric NOT NULL, "rejectedDelta" numeric NOT NULL, reason text NOT NULL)',
        );
        const old = readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/20260913120000_procurement_receipt_adjustment_export/migration.sql',
          ),
          'utf8',
        );
        const constraint = old.match(
          /ALTER TABLE "procurement_receipt_adjustment"\s+ADD CONSTRAINT "procurement_receipt_adjustment_delta_check" CHECK \([\s\S]*?\n {2}\);/,
        )![0];
        await client.query(constraint);
        await client.query(
          "CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable history'; END; $$; CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON procurement_receipt_adjustment FOR EACH ROW EXECUTE FUNCTION reject_history()",
        );
        const insert =
          'INSERT INTO procurement_receipt_adjustment("actorUserId","receivedDelta","acceptedDelta","rejectedDelta",reason) VALUES ($1,$2,$3,$4,$5)';
        await expect(
          client.query(insert, [1, 1, 0, 0, '']),
        ).rejects.toMatchObject({ code: '23514' });
        await client.query(insert, [1, 1, 0, 0, 'Recorded original reason']);
        await client.query(
          readFileSync(
            resolve(
              __dirname,
              '../prisma/migrations/20261015123000_optional_operation_reason/migration.sql',
            ),
            'utf8',
          ),
        );
        await client.query(insert, [1, 1, 0, 0, '']);
        for (const deltas of [
          [0, 0, 0],
          ['NaN', 0, 0],
          [0, 'NaN', 0],
          [0, 0, 'NaN'],
        ])
          await expect(
            client.query(insert, [1, ...deltas, '']),
          ).rejects.toMatchObject({ code: '23514' });
        await expect(
          client.query(insert, [99, 1, 0, 0, '']),
        ).rejects.toMatchObject({ code: '23503' });
        await expect(
          client.query(
            "UPDATE procurement_receipt_adjustment SET reason='changed'",
          ),
        ).rejects.toThrow('Immutable history');
        await expect(
          client.query('DELETE FROM procurement_receipt_adjustment'),
        ).rejects.toThrow('Immutable history');
        expect(
          (
            await client.query(
              'SELECT reason FROM procurement_receipt_adjustment ORDER BY id',
            )
          ).rows.map((r) => r.reason),
        ).toEqual(['Recorded original reason', '']);
      } finally {
        await client.query(
          'DROP SCHEMA IF EXISTS optional_reason_policy_test CASCADE',
        );
        await client.end();
      }
    });
  },
);
