import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

it.skipIf(process.env.IAM_USER_UNIT_TEST !== '1')(
  'backfills real branches and all existing memberships idempotently without changing primary scopes or issuer branding',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['/nora_ci', '/iam_unit_test'].includes(url.pathname)
    )
      throw new Error('Disposable local database required');
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      // Temporary tables shadow permanent names: no shared or operational records are changed.
      await db.query(`
      CREATE TEMP TABLE branches (LIKE public.branches INCLUDING ALL);
      CREATE TEMP TABLE iam_users (id UUID PRIMARY KEY, status TEXT);
      CREATE TEMP TABLE iam_user_branches (LIKE public.iam_user_branches INCLUDING ALL);
      CREATE TEMP TABLE iam_audit_events (LIKE public.iam_audit_events INCLUDING ALL);
      CREATE TEMP TABLE legal_entities (LIKE public.legal_entities INCLUDING ALL);
      INSERT INTO branches (id,code,name,"updatedAt") VALUES
        ('00000000-0000-4000-8000-000000000001','HQ','دفتر مرکزی',now()),
        ('00000000-0000-4000-8000-000000000002','CUSTOM','شعبه سفارشی',now()),
        ('00000000-0000-4000-8000-000000000003','OLD_ACADEMY','جهان آکادمی',now());
      INSERT INTO iam_users VALUES ('00000000-0000-4000-8000-000000000010','ACTIVE'),('00000000-0000-4000-8000-000000000011','INACTIVE');
      INSERT INTO iam_user_branches ("userId","branchId","isPrimary") VALUES ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000002',true);
      INSERT INTO legal_entities (id,code,"persianName","updatedAt","brandingSnapshotVersion",version,"nationalId") VALUES ('00000000-0000-4000-8000-000000000020','JAHAN_BASTAN','Existing official name',now(),7,9,'synthetic-preserve');
    `);
      const sql = readFileSync(
        resolve(
          process.cwd(),
          'prisma/migrations/20261019110000_five_company_branches/migration.sql',
        ),
        'utf8',
      );
      await db.query(sql);
      expect(
        (await db.query('SELECT count(*)::int AS n FROM branches')).rows[0].n,
      ).toBe(6);
      expect(
        (await db.query('SELECT count(*)::int AS n FROM iam_user_branches'))
          .rows[0].n,
      ).toBe(11);
      expect(
        (await db.query(`SELECT id FROM branches WHERE code='JAHAN_ACADEMIA'`))
          .rows[0].id,
      ).toBe('00000000-0000-4000-8000-000000000003');
      expect(
        (
          await db.query(
            `SELECT ub."userId",b.code FROM iam_user_branches ub JOIN branches b ON b.id=ub."branchId" WHERE ub."isPrimary" ORDER BY ub."userId"`,
          )
        ).rows,
      ).toEqual([
        { userId: '00000000-0000-4000-8000-000000000010', code: 'CUSTOM' },
        { userId: '00000000-0000-4000-8000-000000000011', code: 'HQ' },
      ]);
      expect(
        (
          await db.query(
            `SELECT "persianName",version,"brandingSnapshotVersion","nationalId" FROM legal_entities WHERE code='JAHAN_BASTAN'`,
          )
        ).rows[0],
      ).toEqual({
        persianName: 'Existing official name',
        version: 9,
        brandingSnapshotVersion: 7,
        nationalId: 'synthetic-preserve',
      });
      expect(
        (await db.query('SELECT count(*)::int AS n FROM legal_entities'))
          .rows[0].n,
      ).toBe(4);
      expect(
        (await db.query('SELECT count(*)::int AS n FROM iam_audit_events'))
          .rows[0].n,
      ).toBe(2);
      await db.query(sql);
      expect(
        (await db.query('SELECT count(*)::int AS n FROM iam_user_branches'))
          .rows[0].n,
      ).toBe(11);
      expect(
        (await db.query('SELECT count(*)::int AS n FROM iam_audit_events'))
          .rows[0].n,
      ).toBe(2);
    } finally {
      await db.end();
    }
  },
);
