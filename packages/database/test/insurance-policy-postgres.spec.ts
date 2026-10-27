import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

describe.skipIf(process.env.INSURANCE_POLICY_TEST !== '1')(
  'passenger insurance PostgreSQL invariants',
  () => {
    it('requires real references, unique passenger/provider policies, complete confirmation and exact money', async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        !['/nora_ci', '/insurance_test'].includes(url.pathname)
      )
        throw new Error('Disposable insurance test database required');
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query('BEGIN');
        const schema = 'insurance_proof_' + randomUUID().replace(/-/g, '');
        await client.query(
          `CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}"`,
        );
        for (const table of [
          'sales_contracts',
          'ReservationIntake',
          'customers',
          'iam_users',
        ])
          await client.query(`CREATE TABLE "${table}" (id uuid PRIMARY KEY)`);
        const contract = randomUUID(),
          intake = randomUUID(),
          customer = randomUUID(),
          actor = randomUUID();
        for (const [table, id] of [
          ['sales_contracts', contract],
          ['ReservationIntake', intake],
          ['customers', customer],
          ['iam_users', actor],
        ])
          await client.query(`INSERT INTO "${table}" VALUES ($1)`, [id]);
        await client.query(
          readFileSync(
            resolve(
              __dirname,
              '../prisma/migrations/20261025180000_reservation_insurance_policies/migration.sql',
            ),
            'utf8',
          ),
        );
        const insert =
          'INSERT INTO reservation_insurance_policies (id,"contractId","intakeId","customerId","destinationCode","planCode","departureDate","durationDays","updatedAt") VALUES ($1,$2,$3,$4,\'90\',\'P1\',\'2027-02-20\',7,NOW())';
        const id = randomUUID();
        await client.query(insert, [id, contract, intake, customer]);
        expect(
          (
            await client.query(
              'SELECT "policyNumber" FROM reservation_insurance_policies WHERE id=$1',
              [id],
            )
          ).rows[0].policyNumber,
        ).toBeNull();
        const deny = async (sql: string, values: unknown[]) => {
          await client.query('SAVEPOINT probe');
          await expect(client.query(sql, values)).rejects.toThrow();
          await client.query('ROLLBACK TO SAVEPOINT probe');
          await client.query('RELEASE SAVEPOINT probe');
        };
        await deny(insert, [randomUUID(), contract, intake, customer]);
        await deny(insert, [randomUUID(), randomUUID(), intake, customer]);
        await deny(insert, [
          randomUUID(),
          contract,
          randomUUID(),
          randomUUID(),
        ]);
        await deny(
          "UPDATE reservation_insurance_policies SET status='ISSUED' WHERE id=$1",
          [id],
        );
        await deny(
          'UPDATE reservation_insurance_policies SET "policyNumber"=\'temporary\' WHERE id=$1',
          [id],
        );
        await deny(
          'UPDATE reservation_insurance_policies SET "durationDays"=0 WHERE id=$1',
          [id],
        );
        await client.query(
          'UPDATE reservation_insurance_policies SET status=\'ISSUED\',"policyNumber"=\'TEST-1\',"providerId"=\'P-TEST-1\',"issuedAt"=NOW(),amount=123456789012345.1234,"currencyCode"=\'IRR\' WHERE id=$1',
          [id],
        );
        expect(
          (
            await client.query(
              'SELECT amount::text FROM reservation_insurance_policies WHERE id=$1',
              [id],
            )
          ).rows[0].amount,
        ).toBe('123456789012345.1234');
        await deny(
          'UPDATE reservation_insurance_policies SET "currencyCode"=NULL WHERE id=$1',
          [id],
        );
        await deny('DELETE FROM customers WHERE id=$1', [customer]);
        await deny(
          "UPDATE reservation_insurance_policies SET status='CANCELLED' WHERE id=$1",
          [id],
        );
        const revision =
          'INSERT INTO reservation_insurance_revisions (id,"policyId",version,action,snapshot,"actorUserId") VALUES ($1,$2,1,\'PROVIDER_CONFIRMED\',\'{}\',$3)';
        await client.query(revision, [randomUUID(), id, actor]);
        await deny(revision, [randomUUID(), id, actor]);
        await deny(revision, [randomUUID(), randomUUID(), actor]);
        await deny('DELETE FROM reservation_insurance_policies WHERE id=$1', [
          id,
        ]);
      } finally {
        await client.query('ROLLBACK');
        await client.end();
      }
    });
  },
);
