import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  MasterDataDetailItem,
  MasterDataDetailSection,
} from './master-data-profile-details';
import { getReferenceFieldConfig } from '../model/reference-fields';

function geographySource() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/modules/master-data/components/master-data-geography-workspace.tsx',
    ),
    'utf8',
  );
}

function componentSource(fileName: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/modules/master-data/components', fileName),
    'utf8',
  );
}

describe('Master Data view and geography follow-up regressions', () => {
  it('renders zero and false as real values while reserving dash for empty data', () => {
    const html = renderToStaticMarkup(
      <MasterDataDetailSection title="آزمون">
        <MasterDataDetailItem label="صفر" value={0} />
        <MasterDataDetailItem label="خیر" value={false} />
        <MasterDataDetailItem label="خالی" value="" />
      </MasterDataDetailSection>,
    );
    expect(html).toContain('>0<');
    expect(html).toContain('>خیر<');
    expect(html).toContain('>—<');
  });

  it('renders long identifiers with explicit LTR direction and safe wrapping', () => {
    const value = 'https://documents.example.test/reference/'.repeat(8);
    const html = renderToStaticMarkup(
      <MasterDataDetailSection title="شناسه‌ها">
        <MasterDataDetailItem label="مرجع" ltr value={value} />
      </MasterDataDetailSection>,
    );
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('[overflow-wrap:anywhere]');
    expect(html).toContain(value);
  });

  it('keeps the city province selector scoped by the selected country', () => {
    expect(getReferenceFieldConfig('cities', 'regionId')).toEqual({
      target: 'regions',
      payload: 'id',
      scopeField: 'countryId',
    });
  });

  it('creates a province with locked country context beside city creation', () => {
    const source = geographySource();
    expect(source).toMatch(
      /target === 'regions'[\s\S]*setFormInitialValues\(\{ countryId: parent\.id \}\)[\s\S]*setLockedFormFields\(\['countryId'\]\)/,
    );
    expect(source).toMatch(
      /openRelatedCreate\('regions', country\)[\s\S]*افزودن\s*استان[\s\S]*openRelatedCreate\('cities', country\)/,
    );
    expect(source).toContain(
      "setFormParent({ kind: 'country', id: parent.id })",
    );
  });

  it('places the expanded country panel in the same table before later rows', () => {
    const source = geographySource();
    const firstRows = source.indexOf('.slice(');
    const inlinePanel = source.indexOf('aria-label={`شهرها و فرودگاه‌های');
    const remainingRows = source.indexOf(
      'records.some((record) => record.id === expandedCountryId)',
      inlinePanel,
    );
    const tableClose = source.indexOf('</table>', inlinePanel);
    expect(firstRows).toBeGreaterThan(-1);
    expect(inlinePanel).toBeGreaterThan(firstRows);
    expect(remainingRows).toBeGreaterThan(inlinePanel);
    expect(tableClose).toBeGreaterThan(remainingRows);
    expect(source).toMatch(
      /<td colSpan=\{columns\.length\}[\s\S]*aria-label=\{`شهرها و فرودگاه‌های/,
    );
  });

  it('fetches the selected airport by id and invalidates stale parent requests', () => {
    const source = geographySource();
    expect(source).toMatch(
      /masterDataApi\.detail\(\s*'airports',\s*selectedAirportId,?\s*\)/,
    );
    expect(source).toContain('request !== terminalParentRequest.current');
    expect(source).toContain('terminalParentRequest.current += 1');
    expect(source).toContain("openRelatedCreate('terminals', airport)");
  });

  it('routes every specialized read profile through the compact shared shell', () => {
    const specializedProfiles = [
      'master-data-accommodation-workspace.tsx',
      'master-data-finance-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
      'master-data-bank-profile.tsx',
    ];
    for (const fileName of specializedProfiles) {
      const profile = componentSource(fileName);
      expect(profile, fileName).toContain('<MasterDataProfileDialog');
      expect(profile, `${fileName}: identity`).toContain(
        '<MasterDataProfileIdentity',
      );
    }

    for (const fileName of [
      'master-data-transportation-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
    ]) {
      const profile = componentSource(fileName);
      expect(profile, `${fileName}: section`).toContain(
        '<MasterDataDetailSection',
      );
      expect(profile, `${fileName}: values`).toContain('<MasterDataDetailItem');
      expect(profile, `${fileName}: version`).toMatch(
        /label="نسخه"[\s\S]*selected\.version\.toLocaleString/,
      );
    }

    expect(componentSource('master-data-accommodation-workspace.tsx')).toMatch(
      /label="وضعیت فروش"[\s\S]*<StatusBadge record=\{selected\} saleable/,
    );

    const shell = componentSource('master-data-profile-dialog.tsx');
    expect(shell).toContain('overflow-x-hidden');
    expect(shell).not.toContain('[&_dl]');
    expect(shell).not.toContain('bg-gradient-to-l');
  });

  it('keeps terminal presentation fields removed and parent selection intact', () => {
    const terminal = componentSource('master-data-terminal-form.tsx');
    expect(terminal).not.toContain('gateCount');
    expect(terminal).not.toContain('iataCode');
    expect(terminal).not.toContain('icaoCode');
    expect(terminal).not.toContain('ianaTimezone');
    expect(terminal).not.toContain('label="فرودگاه"');
    expect(terminal).toContain(".detail('airports', airportId)");

    const geography = geographySource();
    expect(geography).toContain('title="انتخاب فرودگاه ترمینال"');
    expect(geography).toContain('id="terminal-parent-airport"');
    expect(geography).not.toContain("'آخرین تغییر', 'عملیات'");
  });
});
