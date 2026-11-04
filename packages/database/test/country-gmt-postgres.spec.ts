import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261021120000_country_gmt_offset/migration.sql',
  ),
  'utf8',
);
it('adds only nullable checked country GMT storage without a data backfill', () => {
  expect(migration).toContain('ADD COLUMN "gmtOffset" VARCHAR(6)');
  expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  expect(migration).toContain('IS NULL');
});
it.skipIf(process.env.COUNTRY_GMT_POSTGRES_TEST !== '1')(
  'preserves old countries and checks offset persistence/bounds in PostgreSQL',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !['/gmt_qa', '/nora_ci'].includes(url.pathname)
    )
      throw new Error('Disposable database required');
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(
        "CREATE TEMP TABLE master_countries (id integer PRIMARY KEY, name text NOT NULL); INSERT INTO master_countries VALUES (1, 'Original')",
      );
      await db.query(migration);
      expect((await db.query('SELECT * FROM master_countries')).rows).toEqual([
        { id: 1, name: 'Original', gmtOffset: null },
      ]);
      for (const offset of [
        '+03:30',
        '+05:45',
        '-09:30',
        '-12:00',
        '+14:00',
        '+00:00',
      ]) {
        await db.query(
          'UPDATE master_countries SET "gmtOffset"=$1 WHERE id=1',
          [offset],
        );
        expect(
          (
            await db.query(
              'SELECT "gmtOffset" FROM master_countries WHERE id=1',
            )
          ).rows[0].gmtOffset,
        ).toBe(offset);
      }
      for (const offset of [
        '+14:01',
        '-12:01',
        '+03:60',
        '03:30',
        '+25:00',
        '',
      ])
        await expect(
          db.query('UPDATE master_countries SET "gmtOffset"=$1 WHERE id=1', [
            offset,
          ]),
        ).rejects.toMatchObject({ code: '23514' });
      await db.query('UPDATE master_countries SET "gmtOffset"=NULL WHERE id=1');
      expect(
        (await db.query('SELECT "gmtOffset" FROM master_countries WHERE id=1'))
          .rows[0].gmtOffset,
      ).toBeNull();
    } finally {
      await db.end();
    }
  },
);
