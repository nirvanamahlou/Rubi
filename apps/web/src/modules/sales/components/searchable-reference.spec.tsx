import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchableReference } from './searchable-reference';

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
});
