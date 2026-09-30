import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
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

describe('Master Data view and geography follow-up regressions', () => {
  it('renders zero and false as real values while reserving dash for empty data', () => {
    const html = renderToStaticMarkup(
      createElement(
        MasterDataDetailSection,
        {
          title: 'آزمون',
        },
        [
          createElement(MasterDataDetailItem, {
            key: 'zero',
            label: 'صفر',
            value: 0,
          }),
          createElement(MasterDataDetailItem, {
            key: 'false',
            label: 'خیر',
            value: false,
          }),
          createElement(MasterDataDetailItem, {
            key: 'empty',
            label: 'خالی',
            value: '',
          }),
        ],
      ),
    );
    expect(html).toContain('>0<');
    expect(html).toContain('>خیر<');
    expect(html).toContain('>—<');
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
});
