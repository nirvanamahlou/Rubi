import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DatePicker } from './date-picker';

it('allows a Gregorian default without changing the Persian default for other callers', () => {
  const gregorian = renderToStaticMarkup(
    createElement(DatePicker, {
      defaultCalendarSystem: 'gregorian',
      gregorianEnglish: true,
    }),
  );
  const existing = renderToStaticMarkup(createElement(DatePicker, {}));
  expect(gregorian).toContain('Select date');
  expect(existing).toContain('انتخاب تاریخ');
  expect(existing).not.toContain('Select date');
});
