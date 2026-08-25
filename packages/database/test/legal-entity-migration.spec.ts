import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260825123000_legal_entity_context/migration.sql',
  ),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('legal entity persistence migration', () => {
  it('is additive and creates the issuer, context, immutable snapshot, audit and issue tables', () => {
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE)\b/im);
    for (const table of [
      'legal_entities',
      'user_legal_entity_contexts',
      'legal_entity_branding_versions',
      'legal_entity_audit_events',
      'legal_entity_document_issues',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
  });

  it('enforces real issuer identity, context integrity, optimistic versions and immutable output metadata', () => {
    expect(migration).toContain('legal_entities_code_key');
    expect(migration).toContain('legal_entities_active_idx');
    expect(migration).toContain('user_legal_entity_contexts_mode_check');
    expect(migration).toContain('legal_entities_version_check');
    expect(migration).toContain(
      'legal_entity_branding_versions_legalEntityId_version_key',
    );
    for (const column of [
      'issuerLegalEntityId',
      'issuerCode',
      'issuerName',
      'brandingSnapshotVersion',
      'brandingSnapshot',
      'templateVersion',
      'actorUserId',
      'issuedAt',
      'documentType',
      'referenceEntityId',
      'fileHash',
      'reissueReason',
    ])
      expect(migration).toContain(`"${column}"`);
  });

  it('seeds only two real issuers idempotently and never persists ALL as an issuer', () => {
    expect(seed).toContain("code: 'NIYAYESH_SEIR_SAHAR'");
    expect(seed).toContain("code: 'JAHAN_BASTAN'");
    expect(seed).toContain('transaction.legalEntity.upsert');
    expect(seed).toContain('transaction.legalEntityBrandingVersion.upsert');
    expect(seed).not.toMatch(/code:\s*'ALL'/);
  });
});
