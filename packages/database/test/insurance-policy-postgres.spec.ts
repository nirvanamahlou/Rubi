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
          'branches',
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
        await client.query(
          readFileSync(
            resolve(
              __dirname,
              '../prisma/migrations/20261107110000_insurance_automation/migration.sql',
            ),
            'utf8',
          ),
        );
        expect(
          (
            await client.query(
              'SELECT automatic, sandbox FROM reservation_insurance_policies WHERE id=$1',
              [id],
            )
          ).rows[0],
        ).toEqual({ automatic: false, sandbox: false });
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
        await deny(
          'UPDATE reservation_insurance_policies SET automatic=true WHERE id=$1',
          [id],
        );
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
          'UPDATE reservation_insurance_policies SET automatic=true,sandbox=true WHERE id=$1',
          [id],
        );
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
        await client.query(
          readFileSync(
            resolve(
              __dirname,
              '../prisma/migrations/20261109100000_standalone_insurance_applicants/migration.sql',
            ),
            'utf8',
          ),
        );
        expect(
          (
            await client.query(
              'SELECT "contractId", "customerId", "applicantId" FROM reservation_insurance_policies WHERE id=$1',
              [id],
            )
          ).rows[0],
        ).toEqual({
          contractId: contract,
          customerId: customer,
          applicantId: null,
        });
        const branch = randomUUID(),
          applicant = randomUUID(),
          requestKey = randomUUID(),
          standalone = randomUUID();
        await client.query('INSERT INTO branches VALUES ($1)', [branch]);
        const applicantInsert =
          'INSERT INTO reservation_insurance_applicants (id,"branchId","createdByUserId","requestKey","requestFingerprint","displayName","encryptedData","sourceCountryCode","updatedAt") VALUES ($1,$2,$3,$4,$5,\'Synthetic Applicant\',$6,\'1\',NOW())';
        const envelope =
          'synthetic-encrypted-envelope-placeholder-with-no-personal-values';
        await client.query(applicantInsert, [
          applicant,
          branch,
          actor,
          requestKey,
          'f'.repeat(64),
          envelope,
        ]);
        await deny(applicantInsert, [
          randomUUID(),
          branch,
          actor,
          requestKey,
          'f'.repeat(64),
          envelope,
        ]);
        await deny(applicantInsert, [
          randomUUID(),
          randomUUID(),
          actor,
          randomUUID(),
          'f'.repeat(64),
          envelope,
        ]);
        const independent =
          'INSERT INTO reservation_insurance_policies (id,"applicantId","destinationCode","planCode","departureDate","durationDays",automatic,sandbox,"updatedAt") VALUES ($1,$2,\'5\',\'76\',\'2027-01-01\',7,true,true,NOW())';
        await client.query(independent, [standalone, applicant]);
        await deny(independent, [randomUUID(), applicant]);
        await deny(independent, [randomUUID(), randomUUID()]);
        await deny(
          'UPDATE reservation_insurance_policies SET "contractId"=$1 WHERE id=$2',
          [contract, standalone],
        );
        await deny(
          'UPDATE reservation_insurance_policies SET "applicantId"=NULL WHERE id=$1',
          [standalone],
        );
        await deny(
          'UPDATE reservation_insurance_policies SET "customerId"=NULL WHERE id=$1',
          [id],
        );
        await deny('DELETE FROM reservation_insurance_applicants WHERE id=$1', [
          applicant,
        ]);
        const reader = randomUUID();
        await client.query('INSERT INTO iam_users VALUES ($1)', [reader]);
        await client.query(
          'INSERT INTO reservation_insurance_applicant_access (id,"applicantId","actorUserId",action) VALUES ($1,$2,$3,\'CORRECTION_READ\')',
          [randomUUID(), applicant, reader],
        );
        await deny('DELETE FROM iam_users WHERE id=$1', [reader]);
      } finally {
        await client.query('ROLLBACK');
        await client.end();
      }
    });
  },
);
