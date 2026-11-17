import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferencePicker } from './reference-picker';
import { describe, expect, it } from 'vitest';
import { ticketReferenceDisplayName } from './reference-picker';

describe('Ticket reference labels', () => {
  it('shows the human name without the internal reference code', () => {
    expect(ticketReferenceDisplayName({ name: 'بار مجاز ۳۰ کیلوگرم' })).toBe(
      'بار مجاز ۳۰ کیلوگرم',
    );
  });
});

it('requires a country before searching airports', () => {
  const html = renderToStaticMarkup(
    createElement(ReferencePicker, {
      id: 'independent-airport',
      label: 'Airport',
      resource: 'airports',
      value: undefined,
      onSelect: () => {},
    }),
  );
  expect(html).toContain('disabled=""');
  expect(html).toContain('ابتدا کشور را انتخاب کنید');
});

it('allows all airports in the country without requiring a commercial city', () => {
  const html = renderToStaticMarkup(
    createElement(ReferencePicker, {
      id: 'country-airport',
      label: 'Airport',
      resource: 'airports',
      countryId: 'country-ir',
      required: true,
      value: undefined,
      onSelect: () => {},
    }),
  );
  expect(html).not.toContain('disabled=""');
  expect(html).toContain('aria-required="true"');
  expect(html).not.toContain('ابتدا شهر را انتخاب کنید');
});
