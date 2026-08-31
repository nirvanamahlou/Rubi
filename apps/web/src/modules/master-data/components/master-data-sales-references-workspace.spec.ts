import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getMasterDataSection } from '../model/sections';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-sales-references-workspace.tsx',
  ),
  'utf8',
);

describe('sales references workspace', () => {
  it('keeps the four remaining tabs without a standalone profile section', () => {
    for (const label of [
      'نحوه آشنایی',
      'کانال فروش',
      'دلیل از دست رفتن',
      'Tag',
    ])
      expect(source).toContain(label);
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
    expect(source).not.toContain('profile-tab');
  });

  it('removes the three requested references and keeps tabs aligned with the hub', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('type SalesReferenceResource'),
    );
    const resources = [...tabs.matchAll(/resource: '([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(resources).toEqual(
      getMasterDataSection('sales-references')?.resources,
    );
    expect(resources).toHaveLength(4);
    for (const resource of ['lead-sources', 'customer-types', 'campaign-types'])
      expect(source).not.toContain(resource);
  });

  it('uses the exact four KPI names from the mockup', () => {
    for (const label of ['کل موارد', 'فعال', 'استفاده‌شده', 'نیازمند بازبینی'])
      expect(source).toContain(label);
  });

  it('keeps consumer usage behind public contracts', () => {
    expect(source).toContain('در انتظار قرارداد Aggregate');
    expect(source).toContain('Query مستقیم');
    expect(source).toContain("value: '—'");
    expect(source).not.toContain('customerApi');
  });
});
