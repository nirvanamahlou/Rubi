import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

describe.skipIf(process.env.SALES_BUYER_CONTACT_TEST !== '1')(
  'Sales buyer contact PostgreSQL compatibility',
  () => {
    it('retains legacy contracts and independently persists buyer contact', async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55479' ||
        url.pathname !== '/purchase_buyer_test'
      )
        throw new Error(
          'Only the disposable purchase_buyer_test database is allowed',
        );
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query('BEGIN');
        const id = randomUUID();
        const customer = randomUUID();
        await client.query(
          `INSERT INTO sales_contracts (id, contract_number, branch_id, owner_user_id, customer_id, payer_customer_id, customer_name_snapshot, trip_type, origin_id, destination_id, departure_date, create_idempotency_key, create_request_fingerprint, updated_at) VALUES ($1,$2,$3,$4,$5,$5,'Synthetic Buyer','ONE_WAY',$6,$7,'2026-10-08',$8,$9,NOW())`,
          [
            id,
            'T-' + id,
            randomUUID(),
            randomUUID(),
            customer,
            randomUUID(),
            randomUUID(),
            'test-' + id,
            'a'.repeat(64),
          ],
        );
        const legacy = (
          await client.query(
            'SELECT buyer_contact FROM sales_contracts WHERE id=$1',
            [id],
          )
        ).rows[0];
        expect(legacy.buyer_contact).toBeNull();
        const contact = {
          version: 1,
          keyVersion: 1,
          iv: 'synthetic-iv',
          tag: 'synthetic-tag',
          encrypted: 'synthetic-ciphertext',
        };
        await client.query(
          'UPDATE sales_contracts SET buyer_contact=$1::jsonb WHERE id=$2',
          [JSON.stringify(contact), id],
        );
        const saved = (
          await client.query(
            'SELECT buyer_contact, customer_id, payer_customer_id FROM sales_contracts WHERE id=$1',
            [id],
          )
        ).rows[0];
        expect(saved.buyer_contact).toEqual(contact);
        expect(saved.customer_id).toBe(customer);
        expect(saved.payer_customer_id).toBe(customer);
      } finally {
        await client.query('ROLLBACK');
        await client.end();
      }
    });
  },
);
