import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260907120000_documents_step_up_security/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

describe('DOCUMENTS-007 step-up security migration', () => {
  it('adds backward-compatible IAM and document policy fields', () => {
    expect(migration).toContain(
      'ADD COLUMN "requires_step_up_verification" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(migration).toContain(
      'ADD COLUMN "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0',
    );
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/iu);
  });

  it('stores only hashed, short-lived, one-time document grants', () => {
    expect(migration).toContain('CREATE TABLE "document_access_grants"');
    expect(migration).toContain('"token_hash" CHAR(64) NOT NULL');
    expect(migration).toContain('"expires_at" TIMESTAMPTZ(3) NOT NULL');
    expect(migration).toContain('"consumed_at" TIMESTAMPTZ(3)');
    expect(migration).toContain(
      'FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("actor_session_id") REFERENCES "iam_sessions"("id")',
    );
    expect(migration).not.toMatch(/(?:totp_code|raw_token|password)\s+/iu);
    expect(schema).toContain('tokenHash');
    expect(schema).not.toMatch(/(?:totpCode|rawToken)\s+/u);
  });
});
