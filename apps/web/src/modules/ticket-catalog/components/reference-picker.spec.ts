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

it('allows an airport search without requiring a commercial city selection', () => {
  const html = renderToStaticMarkup(
    createElement(ReferencePicker, {
      id: 'independent-airport',
      label: 'Airport',
      resource: 'airports',
      value: undefined,
      onSelect: () => {},
    }),
  );
  expect(html).not.toContain('disabled=""');
  expect(html).not.toContain('ابتدا شهر را انتخاب کنید');
});
