import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
describe.skipIf(process.env.PURCHASE_FX_TEST !== '1')(
  'purchase FX snapshot PostgreSQL invariants',
  () => {
    it('enforces real references, one source, uniqueness, positive values and immutable purchase-day evidence', async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        !['/nora_ci', '/purchase_fx_test'].includes(url.pathname)
      )
        throw new Error('Isolated test database required');
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query('BEGIN');
        const schema = 'fx_proof_' + randomUUID().replace(/-/g, '');
        await client.query(
          `CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}"`,
        );
        for (const table of [
          'ReservationServicePurchase',
          'FinanceTicketPurchaseCostRevision',
          'finance_procurement_invoice_revisions',
          'branches',
          'iam_users',
        ])
          await client.query(`CREATE TABLE "${table}" (id uuid PRIMARY KEY)`);
        const purchase = randomUUID(),
          ticket = randomUUID(),
          branch = randomUUID(),
          actor = randomUUID();
        await client.query(
          'INSERT INTO "ReservationServicePurchase" VALUES ($1)',
          [purchase],
        );
        await client.query(
          'INSERT INTO "FinanceTicketPurchaseCostRevision" VALUES ($1)',
          [ticket],
        );
        await client.query('INSERT INTO branches VALUES ($1)', [branch]);
        await client.query('INSERT INTO iam_users VALUES ($1)', [actor]);
        await client.query(
          readFileSync(
            resolve(
              __dirname,
              '../prisma/migrations/20261017103000_finance_purchase_fx/migration.sql',
            ),
            'utf8',
          ),
        );
        const insert =
          'INSERT INTO finance_purchase_fx_snapshots (id,"reservationPurchaseId","ticketCostId","branchId","actorUserId","currencyCode","foreignAmount","rateToIrr",source,"baselineAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)';
        const data = [
          randomUUID(),
          purchase,
          null,
          branch,
          actor,
          'EUR',
          '915',
          '300000',
          'SYSTEM_SELL',
          '2026-10-17T00:00:00Z',
        ];
        await client.query(insert, data);
        expect(
          (
            await client.query(
              'SELECT ("foreignAmount" * "rateToIrr")::text AS baseline FROM finance_purchase_fx_snapshots',
            )
          ).rows[0].baseline,
        ).toMatch(/^274500000(?:\.0+)?$/);
        const deny = async (sql: string, values: unknown[]) => {
          await client.query('SAVEPOINT probe');
          await expect(client.query(sql, values)).rejects.toThrow();
          await client.query('ROLLBACK TO SAVEPOINT probe');
          await client.query('RELEASE SAVEPOINT probe');
        };
        await deny(insert, [
          randomUUID(),
          purchase,
          null,
          branch,
          actor,
          'EUR',
          '915',
          '300000',
          'MANUAL',
          data[9],
        ]);
        await deny(insert, [
          randomUUID(),
          randomUUID(),
          null,
          branch,
          actor,
          'EUR',
          '915',
          '300000',
          'MANUAL',
          data[9],
        ]);
        await deny(insert, [
          randomUUID(),
          null,
          null,
          branch,
          actor,
          'EUR',
          '915',
          '300000',
          'MANUAL',
          data[9],
        ]);
        await deny(insert, [
          randomUUID(),
          purchase,
          ticket,
          branch,
          actor,
          'EUR',
          '915',
          '300000',
          'MANUAL',
          data[9],
        ]);
        for (const rate of ['0', '-1', 'NaN', 'Infinity', '-Infinity'])
          await deny(insert, [
            randomUUID(),
            null,
            ticket,
            branch,
            actor,
            'EUR',
            '915',
            rate,
            'MANUAL',
            data[9],
          ]);
        await deny(insert, [
          randomUUID(),
          null,
          ticket,
          branch,
          actor,
          'EUR',
          '0',
          '300000',
          'MANUAL',
          data[9],
        ]);
        await deny(insert, [
          randomUUID(),
          null,
          ticket,
          branch,
          actor,
          'IRR',
          '915',
          '300000',
          'MANUAL',
          data[9],
        ]);
        await deny(
          'UPDATE finance_purchase_fx_snapshots SET "rateToIrr"=1 WHERE id=$1',
          [data[0]],
        );
        await deny('DELETE FROM finance_purchase_fx_snapshots WHERE id=$1', [
          data[0],
        ]);
        await deny('DELETE FROM "ReservationServicePurchase" WHERE id=$1', [
          purchase,
        ]);
      } finally {
        await client.query('ROLLBACK').catch(() => undefined);
        await client.end();
      }
    }, 30000);
  },
);
