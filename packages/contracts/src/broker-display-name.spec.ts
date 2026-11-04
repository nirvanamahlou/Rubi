import { expect, it } from 'vitest';
import { brokerEnglishDisplayName } from './broker-display-name';

it('always prefers the exact registered Latin name and preserves accents', () => {
  expect(
    brokerEnglishDisplayName({
      name: 'نام فارسی',
      englishName: '  Registered Travel  ',
    }),
  ).toBe('Registered Travel');
  expect(
    brokerEnglishDisplayName({
      name: 'نام فارسی',
      englishName: 'Türkiye Travel',
    }),
  ).toBe('Türkiye Travel');
  expect(brokerEnglishDisplayName({ name: 'Existing English' })).toBe(
    'Existing English',
  );
});
it('transcribes legacy Persian labels and spelled initials without persisting official names', () => {
  expect(brokerEnglishDisplayName({ name: 'جی تی اس' })).toBe('GTS');
  expect(brokerEnglishDisplayName({ name: 'دی تور' })).toBe('D Tour');
  expect(brokerEnglishDisplayName({ name: 'ا ت ج توریسم' })).toBe(
    'ATJ Tourism',
  );
  for (const name of [
    'کارگزار نمونه',
    'کارگزار ۱۲۳',
    'شرکت‌نمونه',
    'علي كريمي',
    'شرکت constructor',
    'شرکت toString',
  ])
    expect(
      brokerEnglishDisplayName({ name, englishName: 'نام فارسی' }),
    ).not.toMatch(/[\u0600-\u06ff]/u);
  const record = { name: 'نام فارسی', englishName: '' };
  brokerEnglishDisplayName(record);
  expect(record).toEqual({ name: 'نام فارسی', englishName: '' });
  expect(brokerEnglishDisplayName({ name: 'شرکت constructor' })).not.toContain(
    'function',
  );
});
