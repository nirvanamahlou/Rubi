import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const profile = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-bank-profile.tsx',
  ),
  'utf8',
);
const finance = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-finance-workspace.tsx',
  ),
  'utf8',
);

describe('bank branch ownership in Master Data', () => {
  it('opens a bank profile instead of a standalone branches tab', () => {
    expect(finance).toContain('setSelectedBank(record)');
    expect(finance).toContain('<MasterDataBankProfile');
    expect(finance).not.toContain("key: 'branches'");
  });

  it('loads only branches of the selected bank and keeps pagination', () => {
    expect(profile).toContain("masterDataApi.list('bank-branches'");
    expect(profile).toContain('bankId: bank.id');
    expect(profile).toContain('pageSize: 25');
  });

  it('uses the branch form with its parent bank locked and persisted', () => {
    expect(profile).toContain('initialValues={{ bankId: bank.id }}');
    expect(profile).toContain("lockedFields={['bankId']}");
    expect(profile).toContain('values: { ...values, bankId: bank.id }');
    expect(profile).toContain("resource: 'bank-branches'");
  });
});
