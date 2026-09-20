import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829190000_master_data_sales_references/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

describe('MASTER-003I-SALES-REFERENCES migration', () => {
  it('is additive and does not change Customers persistence', () => {
    expect(migration).not.toMatch(/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im);
    expect(migration).toContain('ALTER TABLE "master_acquaintance_methods"');
    expect(migration).not.toContain('ALTER TABLE "customers"');
  });

  it('creates the six missing sales reference catalogs', () => {
    for (const table of [
      'master_lead_sources',
      'master_sales_channels',
      'master_lost_reasons',
      'master_customer_types',
      'master_tags',
      'master_campaign_types',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(schema).toContain('model MasterSalesChannel');
    expect(schema).toContain('model MasterCampaignType');
  });

  it('enforces display order and Tag color at database level', () => {
    expect(migration.match(/display_order_check/g)).toHaveLength(7);
    expect(migration).toContain('master_tags_color_hex_check');
    expect(migration).toContain("'^#[0-9A-F]{6}$'");
  });
});
