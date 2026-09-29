import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchCombobox, searchOptions } from './search-combobox';
import { NativeSearchSelect } from './native-search-select';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './form-controls';
const options = Array.from({ length: 20 }, (_, i) => ({
  value: String(i),
  label: 'هتل ' + i,
  searchText: 'هتل ' + i + ' Hotel ' + i,
}));
describe('shared inline searchable selection', () => {
  it('shows six initial options and searches the entire list before limiting results', () => {
    expect(searchOptions(options, '')).toHaveLength(6);
    expect(searchOptions(options, 'Hotel 19').map((o) => o.value)).toEqual([
      '19',
    ]);
    expect(searchOptions(options, 'هتل')).toHaveLength(6);
  });
  it('matches text inside the displayed name even when separate search aliases exist', () => {
    const records = [
      {
        value: 'royal',
        label: 'هتل رویال گاردن',
        searchText: 'RHG Royal Garden Resort',
      },
    ];
    expect(
      searchOptions(records, 'گاردن').map((option) => option.value),
    ).toEqual(['royal']);
    expect(
      searchOptions(records, 'arden').map((option) => option.value),
    ).toEqual(['royal']);
    expect(
      searchOptions(records, 'oyal').map((option) => option.value),
    ).toEqual(['royal']);
    expect(searchOptions(records, 'ناموجود')).toEqual([]);
  });
  it('matches the middle of codes and case-insensitive aliases beyond the initial six', () => {
    const records = [
      ...options,
      { value: 'airline', label: 'ایرلاین منتخب', searchText: 'AB-4512-XY' },
    ];
    expect(
      searchOptions(records, '4512').map((option) => option.value),
    ).toEqual(['airline']);
    expect(
      searchOptions(records, 'otel 19').map((option) => option.value),
    ).toEqual(['19']);
    expect(
      searchOptions(records, 'ab-451').map((option) => option.value),
    ).toEqual(['airline']);
  });
  it('normalizes Arabic/Persian letters and keeps canonical IDs', () => {
    expect(
      searchOptions([{ value: 'canonical', label: 'کیش' }], 'كيش')[0]?.value,
    ).toBe('canonical');
  });
  it('uses the primary input and retains selected labels outside the first six', () => {
    const html = renderToStaticMarkup(
      <SearchCombobox
        label="هتل"
        value="19"
        options={options}
        onValueChange={() => undefined}
      />,
    );
    expect(html).toMatch(/<input[^>]+role="combobox"/);
    expect(html).toContain('value="هتل 19"');
    expect(html).not.toContain('<button');
  });
  it('preserves native form submission and selected labels', () => {
    const html = renderToStaticMarkup(
      <NativeSearchSelect
        name="hotelId"
        value="hotel"
        onChange={() => undefined}
      >
        <option value="">انتخاب</option>
        <optgroup label="هتل‌ها">
          <option value="hotel">هتل منتخب</option>
        </optgroup>
      </NativeSearchSelect>,
    );
    expect(html).toContain('name="hotelId"');
    expect(html).toContain('value="هتل منتخب"');
    expect(html).toContain('hidden=""');
  });
  it('adapts shared primitive consumers without a second search field', () => {
    const html = renderToStaticMarkup(
      <Select value="hotel" name="hotel">
        <SelectTrigger aria-label="هتل">
          <SelectValue placeholder="انتخاب هتل" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hotel">هتل منتخب</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(html).toMatch(/<input[^>]+role="combobox"/);
    expect(html).toContain('value="هتل منتخب"');
    expect(html).toContain('name="hotel"');
  });
});
