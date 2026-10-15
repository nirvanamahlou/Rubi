import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

it.skipIf(process.env.HOTEL_RATE_BROKER_TEST !== '1')(
  'preserves legacy rates and enforces registered broker integrity',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['/nora_ci', '/hotel_broker_test'].includes(url.pathname)
    )
      throw new Error('Only a local disposable test database is allowed');
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    const id = (n: number) =>
      `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    try {
      // Connection-local temporary tables shadow production names; no permanent writes.
      await db.query(`CREATE TEMP TABLE master_brokers(id UUID PRIMARY KEY);
      CREATE TEMP TABLE master_organizations(id UUID PRIMARY KEY);
      CREATE TEMP TABLE reservation_hotel_group_rates("batchId" UUID NOT NULL, "hotelId" UUID NOT NULL,
        "brokerId" UUID NOT NULL REFERENCES master_organizations(id), UNIQUE("batchId", "hotelId", "brokerId"));`);
      await db.query('INSERT INTO master_organizations VALUES ($1)', [id(1)]);
      await db.query('INSERT INTO master_brokers VALUES ($1)', [id(2)]);
      await db.query(
        'INSERT INTO reservation_hotel_group_rates VALUES ($1,$2,$3)',
        [id(3), id(4), id(1)],
      );
      await db.query(
        readFileSync(
          resolve(
            process.cwd(),
            'prisma/migrations/20261015120000_hotel_rate_registered_broker/migration.sql',
          ),
          'utf8',
        ),
      );
      expect(
        (
          await db.query(
            'SELECT "brokerId", "registeredBrokerId" FROM reservation_hotel_group_rates',
          )
        ).rows,
      ).toEqual([{ brokerId: id(1), registeredBrokerId: null }]);
      const insert =
        'INSERT INTO reservation_hotel_group_rates("batchId","hotelId","brokerId","registeredBrokerId") VALUES($1,$2,$3,$4)';
      await db.query(insert, [id(3), id(4), null, id(2)]);
      await expect(
        db.query(insert, [id(3), id(4), null, id(2)]),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        db.query(insert, [id(5), id(4), null, id(99)]),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        db.query(insert, [id(5), id(4), null, null]),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        db.query(insert, [id(5), id(4), id(1), id(2)]),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        db.query('DELETE FROM master_brokers WHERE id=$1', [id(2)]),
      ).rejects.toMatchObject({ code: '23001' });
    } finally {
      await db.end();
    }
  },
);
