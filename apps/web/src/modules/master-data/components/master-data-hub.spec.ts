import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-hub.tsx',
  ),
  'utf8',
);

describe('MasterDataHub contract', () => {
  it('renders the shared section catalog as navigable cards', () => {
    expect(hubSource).toContain('masterDataSections.map');
    expect(hubSource).toContain('href={`/master-data/${section.slug}`}');
    expect(hubSource).toContain('aria-label={`ورود به بخش ${section.title}`}');
  });

  it('keeps the card grid responsive and keyboard focus visible', () => {
    expect(hubSource).toContain('sm:grid-cols-2');
    expect(hubSource).toContain('xl:grid-cols-4');
    expect(hubSource).toContain('focus-visible:ring-2');
  });

  it('keeps hover feedback without drawing an underline', () => {
    expect(hubSource).toContain('group-hover:-translate-y-1');
    expect(hubSource).not.toContain('group-hover:scale-x-100');
  });

  it('shows the consolidated navigation without the internal work label', () => {
    expect(hubSource).not.toContain('eyebrow="MASTER-003 · PC-B"');
    expect(hubSource).toContain("'ارزها و تاریخچه نرخ'");
    expect(hubSource).toContain("'شهرها و استان‌ها'");
    expect(hubSource).not.toContain("'اطلاعات تماس'");
  });
});
