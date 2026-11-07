import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    __dirname,
    '../prisma/migrations/20261107120000_manifest_document_references/migration.sql',
  ),
  'utf8',
);

it.skipIf(process.env.CONTRACT_RECEIPT_POSTGRES_TEST !== '1')(
  'repairs missing manifest references and preserves existing policies, IDs and deactivation on replay',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['/receipt_qa', '/nora_ci'].includes(url.pathname)
    )
      throw new Error('Disposable database required');
    const db = new Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 15000,
    });
    await db.connect();
    try {
      await db.query(`
        CREATE TEMP TABLE document_categories (
          id uuid PRIMARY KEY, code text UNIQUE, name text, is_active boolean,
          created_at timestamptz, updated_at timestamptz
        );
        CREATE TEMP TABLE document_types (
          id uuid PRIMARY KEY, code text UNIQUE, name text, domain text,
          default_confidentiality text, allowed_mime_types text[],
          max_file_size_bytes bigint, requires_expiry boolean, is_active boolean,
          created_at timestamptz, updated_at timestamptz
        );
      `);
      await db.query(migration);
      const types = (await db.query('SELECT * FROM document_types')).rows;
      const categories = (await db.query('SELECT * FROM document_categories'))
        .rows;
      expect(types).toHaveLength(1);
      expect(categories).toHaveLength(1);
      expect(types[0]).toMatchObject({
        code: 'MANIFEST',
        domain: 'TRAVEL',
        default_confidentiality: 'INTERNAL',
        allowed_mime_types: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        max_file_size_bytes: '26214400',
        requires_expiry: false,
        is_active: true,
      });
      expect(categories[0]).toMatchObject({
        code: 'TRAVEL_RESERVATIONS',
        is_active: true,
      });
      await db.query(migration);
      expect((await db.query('SELECT * FROM document_types')).rows).toEqual(
        types,
      );
      expect(
        (await db.query('SELECT * FROM document_categories')).rows,
      ).toEqual(categories);
      await db.query(`
        UPDATE document_types SET name='Custom receipt', is_active=false,
          max_file_size_bytes=1024, allowed_mime_types=ARRAY['application/pdf'], requires_expiry=true;
        UPDATE document_categories SET name='Custom category', is_active=false;
      `);
      const customizedTypes = (await db.query('SELECT * FROM document_types'))
        .rows;
      const customizedCategories = (
        await db.query('SELECT * FROM document_categories')
      ).rows;
      await db.query(migration);
      expect((await db.query('SELECT * FROM document_types')).rows).toEqual(
        customizedTypes,
      );
      expect(
        (await db.query('SELECT * FROM document_categories')).rows,
      ).toEqual(customizedCategories);
      // Partial installations must also be repaired without changing the present row.
      await db.query('DELETE FROM document_categories');
      await db.query(migration);
      expect((await db.query('SELECT * FROM document_types')).rows).toEqual(
        customizedTypes,
      );
      expect(
        (await db.query('SELECT code FROM document_categories')).rows,
      ).toEqual([{ code: 'TRAVEL_RESERVATIONS' }]);
    } finally {
      await db.end();
    }
  },
  60000,
);
