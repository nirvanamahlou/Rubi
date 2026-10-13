import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260901090000_documents_vertical_slice/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('DOCUMENTS-002 migration and reference seed', () => {
  it('creates an additive document, version, relation, audit and quarantine boundary', () => {
    for (const table of [
      'document_types',
      'document_categories',
      'documents',
      'document_versions',
      'document_relations',
      'document_audit_events',
      'document_quarantines',
      'document_processing_jobs',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);

    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).toContain('documents_generate_archive_code');
  });

  it('keeps binary content outside PostgreSQL and enforces immutable version identity', () => {
    expect(schema).toContain('storageObjectKey');
    expect(schema).not.toMatch(/(?:fileBytes|binaryData|base64Payload)\s+/);
    expect(migration).toContain(
      'document_versions_document_id_version_number_key',
    );
    expect(migration).toContain('document_versions_storage_object_key_key');
    expect(migration).toContain('document_versions_sha256_check');
    expect(migration).toContain('document_versions_size_check');
  });

  it('seeds only idempotent reference types, categories and separated roles', () => {
    expect(seed).toContain('transaction.documentType.upsert');
    expect(seed).toContain('transaction.documentCategory.upsert');
    expect(seed).toContain("code: 'archive_staff'");
    expect(seed).toContain("code: 'finance_staff'");
    expect(seed).toContain("code: 'hr_staff'");
    expect(seed).not.toContain('transaction.document.create');
    expect(seed).not.toContain('preview-document');
  });
});
