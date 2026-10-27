import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

it.skipIf(process.env.HOTEL_RATE_BROKER_TEST !== '1')(
  'enforces additive composite contract stay foreign keys, dates, order and cascade',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['/nora_ci', '/hotel_broker_test'].includes(url.pathname)
    )
      throw new Error('Only a local disposable test database is allowed');
    const db = new Client({ connectionString: url.toString() });
    const schema = `composite_stays_${randomUUID().replaceAll('-', '')}`;
    await db.connect();
    try {
      await db.query('BEGIN');
      await db.query(`CREATE SCHEMA "${schema}"`);
      await db.query(`SET LOCAL search_path TO "${schema}", public`);
      await db.query(
        'CREATE TABLE sales_contract_hotel_selections(id UUID PRIMARY KEY); CREATE TABLE master_hotels(id UUID PRIMARY KEY); CREATE TABLE master_cities(id UUID PRIMARY KEY)',
      );
      await db.query(
        readFileSync(
          resolve(
            process.cwd(),
            'prisma/migrations/20261026120000_composite_contract_hotel_stays/migration.sql',
          ),
          'utf8',
        ),
      );
      const selection = randomUUID(),
        hotel = randomUUID(),
        city = randomUUID();
      await db.query('INSERT INTO sales_contract_hotel_selections VALUES($1)', [
        selection,
      ]);
      await db.query('INSERT INTO master_hotels VALUES($1)', [hotel]);
      await db.query('INSERT INTO master_cities VALUES($1)', [city]);
      const insert =
        'INSERT INTO sales_contract_hotel_stays(hotel_selection_id, ordinal, hotel_id, city_id, hotel_name_snapshot, check_in_date, check_out_date) VALUES($1,$2,$3,$4,$5,$6,$7)';
      const values = [
        selection,
        2,
        hotel,
        city,
        'Hotel, Two',
        '2099-01-03',
        '2099-01-06',
      ];
      await db.query(insert, values);
      async function rejects(sql: string, params: unknown[], code: string) {
        await db.query('SAVEPOINT invalid_case');
        await expect(db.query(sql, params)).rejects.toMatchObject({ code });
        await db.query('ROLLBACK TO SAVEPOINT invalid_case');
      }
      await rejects(insert, values, '23505');
      await rejects(
        insert,
        [
          selection,
          3,
          randomUUID(),
          city,
          'Missing',
          '2099-01-06',
          '2099-01-08',
        ],
        '23503',
      );
      await rejects(
        insert,
        [selection, 3, hotel, city, 'Reversed', '2099-01-06', '2099-01-05'],
        '23514',
      );
      await rejects(
        insert,
        [selection, 51, hotel, city, 'Limit', '2099-01-06', '2099-01-08'],
        '23514',
      );
      await rejects('DELETE FROM master_hotels WHERE id=$1', [hotel], '23001');
      await db.query('CREATE TABLE master_room_types(id UUID PRIMARY KEY)');
      await db.query(
        readFileSync(
          resolve(
            process.cwd(),
            'prisma/migrations/20261027120000_sales_hotel_stay_rooms/migration.sql',
          ),
          'utf8',
        ),
      );
      const roomType = randomUUID();
      await db.query('INSERT INTO master_room_types VALUES ($1)', [roomType]);
      const stay = (await db.query('SELECT id FROM sales_contract_hotel_stays'))
        .rows[0].id;
      const roomInsert =
        'INSERT INTO sales_contract_hotel_stay_rooms(stay_id,ordinal,room_type_id,room_type_name_snapshot,adults,child_ages) VALUES($1,$2,$3,$4,$5,$6)';
      await db.query(roomInsert, [stay, 1, roomType, 'Suite', 2, '[4,9]']);
      await db.query(
        readFileSync(
          resolve(
            process.cwd(),
            'prisma/migrations/20261027130000_sales_hotel_stay_room_category/migration.sql',
          ),
          'utf8',
        ),
      );
      expect(
        (
          await db.query(
            'SELECT room_category FROM sales_contract_hotel_stay_rooms',
          )
        ).rows,
      ).toEqual([{ room_category: null }]);
      await db.query(
        'UPDATE sales_contract_hotel_stay_rooms SET room_category=$1',
        ['DOUBLE_EXTRA'],
      );
      await rejects(
        'UPDATE sales_contract_hotel_stay_rooms SET room_category=$1',
        ['UNKNOWN'],
        '23514',
      );
      expect(
        (
          await db.query(
            'SELECT room_category FROM sales_contract_hotel_stay_rooms',
          )
        ).rows,
      ).toEqual([{ room_category: 'DOUBLE_EXTRA' }]);
      await rejects(
        roomInsert,
        [stay, 1, roomType, 'Duplicate', 1, '[]'],
        '23505',
      );
      await rejects(
        roomInsert,
        [stay, 2, randomUUID(), 'Missing', 1, '[]'],
        '23503',
      );
      await rejects(
        roomInsert,
        [stay, 2, roomType, 'Invalid', 0, '[]'],
        '23514',
      );
      await rejects(
        'DELETE FROM master_room_types WHERE id=$1',
        [roomType],
        '23001',
      );
      expect(
        (
          await db.query(
            'SELECT adults, child_ages FROM sales_contract_hotel_stay_rooms',
          )
        ).rows,
      ).toEqual([{ adults: 2, child_ages: [4, 9] }]);
      expect(
        (
          await db.query(
            'SELECT ordinal, hotel_name_snapshot FROM sales_contract_hotel_stays ORDER BY ordinal',
          )
        ).rows,
      ).toEqual([{ ordinal: 2, hotel_name_snapshot: 'Hotel, Two' }]);
      await db.query(
        'DELETE FROM sales_contract_hotel_selections WHERE id=$1',
        [selection],
      );
      expect(
        (await db.query('SELECT * FROM sales_contract_hotel_stays')).rowCount,
      ).toBe(0);
      expect(
        (await db.query('SELECT * FROM sales_contract_hotel_stay_rooms'))
          .rowCount,
      ).toBe(0);
    } finally {
      await db.query('ROLLBACK');
      await db.end();
    }
  },
);

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
