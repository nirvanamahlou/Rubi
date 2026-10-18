import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

it.skipIf(process.env.IAM_USER_UNIT_TEST !== '1')(
  'preserves legacy profiles and enforces actual HR unit references',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['/nora_ci', '/iam_unit_test'].includes(url.pathname)
    )
      throw new Error(
        'Only a local disposable IAM unit test database is allowed',
      );
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      // Verify the deployed schema as well as the isolated legacy-to-new migration below.
      const constraints = await db.query(
        `SELECT c.confdeltype FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='iam_user_profiles' AND c.conname='iam_user_profiles_organization_unit_id_fkey'`,
      );
      expect(constraints.rows).toEqual([{ confdeltype: 'r' }]);
      const column = await db.query(
        `SELECT is_nullable, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='iam_user_profiles' AND column_name='organization_unit_id'`,
      );
      expect(column.rows).toEqual([{ is_nullable: 'YES', udt_name: 'uuid' }]);
      const index = await db.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='iam_user_profiles' AND indexname='iam_user_profiles_organization_unit_id_idx'`,
      );
      expect(index.rowCount).toBe(1);
      // Connection-local temporary tables shadow permanent names; no operational rows are touched.
      await db.query(
        `CREATE TEMP TABLE hr_records(id UUID PRIMARY KEY, name TEXT NOT NULL); CREATE TEMP TABLE iam_user_profiles(user_id UUID PRIMARY KEY, phone TEXT);`,
      );
      const userId = randomUUID(),
        unitId = randomUUID();
      await db.query(
        'INSERT INTO iam_user_profiles(user_id,phone) VALUES($1,$2)',
        [userId, 'synthetic-phone'],
      );
      await db.query(
        readFileSync(
          resolve(
            process.cwd(),
            'prisma/migrations/20261018110000_iam_user_organization_unit/migration.sql',
          ),
          'utf8',
        ),
      );
      expect(
        (
          await db.query(
            'SELECT organization_unit_id,phone FROM iam_user_profiles WHERE user_id=$1',
            [userId],
          )
        ).rows,
      ).toEqual([{ organization_unit_id: null, phone: 'synthetic-phone' }]);
      await db.query('INSERT INTO hr_records(id,name) VALUES($1,$2)', [
        unitId,
        'Synthetic Department',
      ]);
      await db.query(
        'UPDATE iam_user_profiles SET organization_unit_id=$1 WHERE user_id=$2',
        [unitId, userId],
      );
      expect(
        (
          await db.query(
            'SELECT organization_unit_id FROM iam_user_profiles WHERE user_id=$1',
            [userId],
          )
        ).rows[0].organization_unit_id,
      ).toBe(unitId);
      await expect(
        db.query(
          'INSERT INTO iam_user_profiles(user_id,organization_unit_id) VALUES($1,$2)',
          [randomUUID(), randomUUID()],
        ),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        db.query('DELETE FROM hr_records WHERE id=$1', [unitId]),
      ).rejects.toMatchObject({ code: '23001' });
      await db.query('UPDATE hr_records SET name=$1 WHERE id=$2', [
        'Renamed Department',
        unitId,
      ]);
      expect(
        (
          await db.query(
            'SELECT h.name FROM iam_user_profiles p JOIN hr_records h ON h.id=p.organization_unit_id WHERE p.user_id=$1',
            [userId],
          )
        ).rows[0].name,
      ).toBe('Renamed Department');
      await db.query(
        'UPDATE iam_user_profiles SET organization_unit_id=NULL WHERE user_id=$1',
        [userId],
      );
      await db.query('DELETE FROM hr_records WHERE id=$1', [unitId]);
      expect(
        (
          await db.query(
            'SELECT phone FROM iam_user_profiles WHERE user_id=$1',
            [userId],
          )
        ).rows[0].phone,
      ).toBe('synthetic-phone');
    } finally {
      await db.end();
    }
  },
);
