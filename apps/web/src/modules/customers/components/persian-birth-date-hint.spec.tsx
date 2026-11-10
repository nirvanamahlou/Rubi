import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PersianBirthDateHint,
  persianBirthDate,
} from './persian-birth-date-hint';

it.each([
  ['2000-03-20', '۱۳۷۹/۰۱/۰۱'],
  ['2024-03-20', '۱۴۰۳/۰۱/۰۱'],
  ['2000-02-29', '۱۳۷۸/۱۲/۱۰'],
])(
  'converts the civil date %s without a timezone day shift',
  (date, expected) => {
    expect(persianBirthDate(date)?.replace(/[\u200e\u200f]/g, '')).toBe(
      expected,
    );
  },
);
it.each([
  '',
  '2000-02-30',
  '2001-02-29',
  '2000-3-2',
  '2000/03/20',
  '2000-03-20T00:00:00Z',
])('hides incomplete or invalid input %s', (value) => {
  expect(persianBirthDate(value)).toBeNull();
  expect(renderToStaticMarkup(<PersianBirthDateHint value={value} />)).toBe('');
});
it('renders small secondary text while retaining the original ISO date', () => {
  const html = renderToStaticMarkup(
    <PersianBirthDateHint value="2000-03-20" />,
  );
  expect(html).toContain('text-[9px]');
  expect(html).toContain('dateTime="2000-03-20"');
  expect(html).toContain('۱۳۷۹/۰۱/۰۱');
});
