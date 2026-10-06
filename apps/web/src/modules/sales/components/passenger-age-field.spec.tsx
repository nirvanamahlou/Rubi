import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PassengerAgeField, passengerAgeOptions } from './passenger-age-field';

describe('themed passenger age field', () => {
  it('renders a larger shared themed combobox instead of a native select', () => {
    const html = renderToStaticMarkup(
      <PassengerAgeField label="سن کودک ۱" value={6} onChange={() => {}} />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-search-select="true"');
    expect(html).toContain('h-12');
    expect(html).toContain('text-base');
    expect(html).toContain('bg-surface');
    expect(html).toContain('aria-label="سن کودک ۱"');
    expect(html).toContain('۶ تا کمتر از ۷ سال');
    expect(html).not.toContain('<select');
  });
  it('preserves missing age separately from infant zero', () => {
    const missing = renderToStaticMarkup(
      <PassengerAgeField label="سن کودک" value={null} onChange={() => {}} />,
    );
    const zero = renderToStaticMarkup(
      <PassengerAgeField
        label="سن نوزاد"
        infant
        value={0}
        onChange={() => {}}
      />,
    );
    expect(missing).toContain('value="انتخاب سن"');
    expect(zero).toContain('value="کمتر از ۱ سال"');
  });
  it('keeps canonical child ages 2..11 and infant ages 0..1 plus explicit clear', () => {
    expect(passengerAgeOptions(false).map((option) => option.value)).toEqual([
      '',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
    ]);
    expect(passengerAgeOptions(true).map((option) => option.value)).toEqual([
      '',
      '0',
      '1',
    ]);
  });
});
