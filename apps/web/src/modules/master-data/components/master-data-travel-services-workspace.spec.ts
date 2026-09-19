import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getMasterDataSection } from '../model/sections';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-travel-services-workspace.tsx',
  ),
  'utf8',
);

describe('travel services workspace', () => {
  it('keeps the remaining mockup tabs and their exact KPI labels', () => {
    for (const label of [
      'لیدرها',
      'نوع تور',
      'نوع ترانسفر',
      'ویزا',
      'کل لیدرها',
      'مقصدها',
      'مدرک ناقص',
      'داخلی',
      'خارجی',
      'اختصاصی',
      'اشتراکی',
      'کشورها',
    ])
      expect(source).toContain(label);
  });

  it('removes CIP and bus navigation and keeps tabs aligned with the hub card', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('type TravelResource'),
    );
    const resources = [...tabs.matchAll(/resource: '([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(resources).toEqual(
      getMasterDataSection('tours-travel-services')?.resources,
    );
    expect(resources).toHaveLength(4);
    for (const resource of ['cip-services', 'bus-companies', 'bus-types'])
      expect(source).not.toContain(resource);
    expect(source).not.toContain('setAirports');
  });

  it('opens every profile from the list without a standalone profile tab', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const rules'),
    );
    expect(tabs).not.toContain('پروفایل');
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('uses backend summaries and never embeds mockup sample records', () => {
    expect(source).toContain('masterDataApi.travelServicesSummary()');
    expect(source).not.toContain('سارا احمدی');
    expect(source).not.toContain('Marhaba Elite');
    expect(source).not.toMatch(/value:\s*(?:86|74|48|41|26|23)\b/);
  });
});
