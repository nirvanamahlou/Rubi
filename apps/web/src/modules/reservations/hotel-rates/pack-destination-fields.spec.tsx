import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { PackDestinationFields } from './pack-destination-fields';
import { preferredPackDestination } from './pack-destinations';

const props = {
  countries: [{ id: 'country-real-id', name: 'ترکیه' }],
  cities: [
    { id: 'city-real-id', name: 'آنتالیا', countryId: 'country-real-id' },
  ],
  countryId: 'country-real-id',
  cityId: 'city-real-id',
  disabled: false,
  onCountryChange: vi.fn(),
  onCityChange: vi.fn(),
  onCitySearch: vi.fn(),
};
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
it('renders a compact single row with two visibly labelled themed selectors and actual directory names', () => {
  const html = renderToStaticMarkup(<PackDestinationFields {...props} />);
  expect(html).toContain('destinationRow');
  expect(html).toContain('انتخاب کشور و شهر');
  expect(html).toContain('<span>کشور</span>');
  expect(html).toContain('<span>شهر</span>');
  expect(html).toContain('ترکیه');
  expect(html).toContain('آنتالیا');
  expect(html).not.toContain('<select');
  expect(html).not.toContain('جست‌وجو و انتخاب…');
  expect(html).not.toContain('disabled=""');
});
it('uses distinct country/city placeholders, and disables city until country is selected', () => {
  const choices = nodes(
    PackDestinationFields({ ...props, countryId: '', cityId: '' }),
  ).filter((node) => node.type === SearchCombobox);
  expect(choices).toHaveLength(2);
  expect(choices[0]?.props.placeholder).toBe('انتخاب کشور');
  expect(choices[1]?.props.placeholder).toBe('ابتدا کشور را انتخاب کنید');
  expect(choices[0]?.props.disabled).toBe(false);
  expect(choices[1]?.props.disabled).toBe(true);
  (choices[0]!.props.onValueChange as (id: string) => void)('country-real-id');
  expect(props.onCountryChange).toHaveBeenCalledWith('country-real-id');
});
it('locks both destination identities while editing a saved pack or saving', () => {
  const choices = nodes(
    PackDestinationFields({ ...props, disabled: true }),
  ).filter((node) => node.type === SearchCombobox);
  expect(choices.every((node) => node.props.disabled === true)).toBe(true);
});
it('selects preferred destinations only by identities actually returned by Master Data, never invented IDs', () => {
  expect(preferredPackDestination(props.countries, 'country')).toBe(
    'country-real-id',
  );
  expect(preferredPackDestination(props.cities, 'city')).toBe('city-real-id');
  expect(
    preferredPackDestination([{ id: 'tr', name: 'Türkiye' }], 'country'),
  ).toBe('tr');
  expect(
    preferredPackDestination(
      [{ id: 'ayt', name: 'Other', englishName: 'Antalya' }],
      'city',
    ),
  ).toBe('ayt');
  expect(preferredPackDestination([], 'country')).toBe('');
  expect(preferredPackDestination([{ id: 'dubai', name: 'دبی' }], 'city')).toBe(
    '',
  );
});
