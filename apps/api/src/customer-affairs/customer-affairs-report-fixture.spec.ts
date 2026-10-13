import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    '../../infrastructure/scripts/customer-affairs-report-data.mjs',
  ),
  'utf8',
);

describe('Customer Affairs report fixture', () => {
  it('uses the explicitly supplied local database without a hidden database override', () => {
    expect(source).not.toContain("url.pathname = '/nora_hr_current_20260908'");
    expect(source).toContain('createDatabaseClient(url.toString())');
  });

  it('links generated website tickets to both supported sites idempotently', () => {
    expect(source).toContain('customerAffairsSiteTicket.findUnique');
    expect(source).toContain('customerAffairsSiteTicket.create');
    expect(source).toContain("['jahanbastan', 'nystkt']");
    expect(source).toContain('if (index % 3 !== 2) return');
  });
});
