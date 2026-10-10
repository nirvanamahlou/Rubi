import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  salesReferenceDisplayName,
  SearchableReference,
} from './searchable-reference';

describe('Sales searchable country/city reference', () => {
  it('renders a labelled themed combobox with the selected reference', () => {
    const markup = renderToStaticMarkup(
      <SearchableReference
        label="شهر مبدأ"
        value="tehran"
        options={[
          {
            id: 'tehran',
            resource: 'cities',
            name: 'تهران',
            code: 'THR',
            attributes: { countryId: 'ir' },
            status: 'active',
            version: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        onChange={() => undefined}
      />,
    );
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('value="تهران"');
    expect(markup).toContain('rounded-xl');
    expect(markup).toContain('h-10');
    expect(markup).toContain('شهر مبدأ');
  });
  it('disables city selection until a country is chosen', () => {
    const markup = renderToStaticMarkup(
      <SearchableReference
        label="شهر مقصد"
        value=""
        options={[]}
        disabled
        onChange={() => undefined}
      />,
    );
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('ابتدا کشور را انتخاب کنید');
  });

  it('keeps technical reference codes out of customer-facing labels', () => {
    expect(salesReferenceDisplayName({ name: 'رویال وینگز' })).toBe(
      'رویال وینگز',
    );
  });

  it('preserves English hotel labels and searches both names', () => {
    expect(
      salesReferenceDisplayName(
        { name: 'هتل منتخب', attributes: { englishName: 'Selected Hotel' } },
        true,
      ),
    ).toBe('Selected Hotel');
    expect(
      salesReferenceDisplayName(
        { name: 'هتل منتخب', attributes: { englishName: '' } },
        true,
      ),
    ).toBe('هتل منتخب');
  });
  it('uses the shared six-result searchable field for initial and filtered options', () => {
    const source = readFileSync(
      new URL('./searchable-reference.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('SearchCombobox');
    expect(source).not.toContain('برای نمایش گزینه‌ها');
  });
});
