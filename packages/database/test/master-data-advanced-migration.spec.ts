import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260826143000_master_data_advanced_currency/migration.sql',
  ),
  'utf8',
);

describe('MASTER-003 advanced currency migration', () => {
  it('is additive and non-destructive', () => {
    expect(sql).toContain('CREATE TYPE "MasterCurrencyRateStatus"');
    expect(sql).toContain('ALTER TABLE "master_draft_exchange_rates"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('enforces positive decimal, distinct pair, valid period and non-authoritative rates', () => {
    expect(sql).toContain('master_exchange_rate_positive');
    expect(sql).toContain('master_exchange_rate_pair_distinct');
    expect(sql).toContain('master_exchange_rate_valid_period');
    expect(sql).toContain('master_exchange_rate_not_authoritative');
  });

  it('adds workflow audit metadata and a current-rate lookup index', () => {
    expect(sql).toContain(
      'master_draft_exchange_rates_pair_type_status_valid_idx',
    );
    expect(sql).toContain('"entityVersion" INTEGER');
    expect(sql).toContain('"reason" VARCHAR(500)');
  });
});
