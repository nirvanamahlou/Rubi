import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-sales-references-workspace.tsx',
  ),
  'utf8',
);

describe('sales references workspace', () => {
  it('implements every mockup tab without a standalone profile section', () => {
    for (const label of [
      'نحوه آشنایی',
      'منبع سرنخ',
      'کانال فروش',
      'دلیل از دست رفتن',
      'نوع مشتری',
      'Tag',
      'نوع کمپین',
    ])
      expect(source).toContain(label);
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
    expect(source).not.toContain('profile-tab');
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
