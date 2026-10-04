import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(
    resolve(process.cwd(), `src/modules/master-data/components/${name}`),
    'utf8',
  );

describe('Master Data review KPI replacements', () => {
  it.each([
    [
      'master-data-accommodation-workspace.tsx',
      ['زنجیره غیرفعال', 'سرویس‌ها', 'هتل ترکیبی غیرفعال'],
    ],
    ['master-data-finance-workspace.tsx', ['بانک غیرفعال']],
    ['master-data-suppliers-workspace.tsx', ['دارای خدمات', 'دارای تماس اصلی']],
    ['master-data-travel-services-workspace.tsx', ['دارای راهنمای مدارک']],
    ['master-data-transportation-workspace.tsx', ['کلاس غیرفعال']],
  ] as const)('binds approved labels in %s', (file, labels) => {
    const source = read(file);
    for (const label of labels)
      expect(source).toMatch(new RegExp(`(?:label|fourthLabel): '${label}'`));
  });

  it('binds the remaining five complement cards to guarded global aggregates', () => {
    const sources = [
      read('master-data-accommodation-workspace.tsx'),
      read('master-data-finance-workspace.tsx'),
      read('master-data-suppliers-workspace.tsx'),
      read('master-data-travel-services-workspace.tsx'),
    ].join('\n');
    expect(sources.match(/masterDataComplementKpi\(/g)).toHaveLength(5);
    expect(sources).toContain('latestResponse.meta.total');
    expect(sources).toContain('summary?.visaServices.incompleteGuidance');
    expect(sources).toContain('summaryRequestRef.current');
  });

  it('leaves no visible review/completion labels in Master Data workspaces', () => {
    const source = [
      'master-data-accommodation-workspace.tsx',
      'master-data-finance-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-transportation-workspace.tsx',
    ]
      .map(read)
      .join('\n');
    expect(source).not.toMatch(
      /label:\s*['`](?:نیازمند (?:تکمیل|بازبینی)|مدرک ناقص)/,
    );
  });
});
