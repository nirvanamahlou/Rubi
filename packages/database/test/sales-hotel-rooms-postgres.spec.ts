import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { describe, it, expect } from 'vitest';
describe.skipIf(process.env.SALES_HOTEL_ROOMS_TEST !== '1')(
  'hotel room persistence in disposable PostgreSQL',
  () => {
    it('keeps canonical FKs, distinct rooms and ages, uniqueness and parent cascade', async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55483' ||
        url.pathname !== '/hotel_rooms_test'
      )
        throw new Error('Only disposable hotel_rooms_test is allowed');
      const db = new Client({ connectionString: url.toString() });
      await db.connect();
      const parent = '10000000-0000-4000-8000-000000000001';
      const double = '10000000-0000-4000-8000-000000000002';
      const single = '10000000-0000-4000-8000-000000000003';
      try {
        await db.query(
          'CREATE SCHEMA room_test; SET search_path TO room_test; CREATE TABLE sales_contract_hotel_selections(id UUID PRIMARY KEY); CREATE TABLE master_room_types(id UUID PRIMARY KEY)',
        );
        await db.query(
          readFileSync(
            resolve(
              process.cwd(),
              'prisma/migrations/20261014140000_sales_hotel_room_breakdown/migration.sql',
            ),
            'utf8',
          ),
        );
        await db.query(
          readFileSync(
            resolve(
              process.cwd(),
              'prisma/migrations/20261015100000_sales_hotel_room_agreed_price/migration.sql',
            ),
            'utf8',
          ),
        );
        await db.query(
          'INSERT INTO sales_contract_hotel_selections VALUES ($1)',
          [parent],
        );
        await db.query('INSERT INTO master_room_types VALUES ($1),($2)', [
          double,
          single,
        ]);
        const insert =
          'INSERT INTO sales_contract_hotel_rooms(hotel_selection_id,ordinal,room_type_id,room_type_name_snapshot,adults,child_ages) VALUES($1,$2,$3,$4,$5,$6)';
        await db.query(insert, [parent, 1, double, 'Double', 2, '[5]']);
        await db.query(insert, [parent, 2, single, 'Single', 1, '[]']);
        expect(
          (
            await db.query(
              'SELECT ordinal,adults,child_ages FROM sales_contract_hotel_rooms ORDER BY ordinal',
            )
          ).rows,
        ).toEqual([
          { ordinal: 1, adults: 2, child_ages: [5] },
          { ordinal: 2, adults: 1, child_ages: [] },
        ]);
        expect(
          (
            await db.query(
              'SELECT agreed_price FROM sales_contract_hotel_rooms',
            )
          ).rows.every((r) => r.agreed_price === null),
        ).toBe(true);
        await db.query(
          'UPDATE sales_contract_hotel_rooms SET agreed_price=$1 WHERE ordinal=1',
          [JSON.stringify({ amount: '100.1254', currencyCode: 'USD' })],
        );
        expect(
          (
            await db.query(
              'SELECT agreed_price FROM sales_contract_hotel_rooms WHERE ordinal=1',
            )
          ).rows[0].agreed_price,
        ).toEqual({ amount: '100.1254', currencyCode: 'USD' });
        await expect(
          db.query(insert, [parent, 1, single, 'Duplicate', 1, '[]']),
        ).rejects.toMatchObject({ code: '23505' });
        await expect(
          db.query(insert, [
            parent,
            3,
            '10000000-0000-4000-8000-000000000099',
            'Unknown',
            1,
            '[]',
          ]),
        ).rejects.toMatchObject({ code: '23503' });
        await expect(
          db.query('DELETE FROM master_room_types WHERE id=$1', [single]),
        ).rejects.toMatchObject({ code: '23001' });
        await expect(
          db.query(insert, [parent, 3, single, 'Invalid', 0, '[]']),
        ).rejects.toMatchObject({ code: '23514' });
        await db.query(
          'DELETE FROM sales_contract_hotel_selections WHERE id=$1',
          [parent],
        );
        expect(
          (await db.query('SELECT * FROM sales_contract_hotel_rooms')).rows,
        ).toEqual([]);
      } finally {
        await db.query(
          'SET search_path TO public; DROP SCHEMA IF EXISTS room_test CASCADE',
        );
        await db.end();
      }
    });
  },
);
