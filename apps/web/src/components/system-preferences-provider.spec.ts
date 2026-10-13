import { describe, expect, it } from 'vitest';

import { resolveSystemPreferences } from './system-preferences-provider';

describe('system display preferences', () => {
  it('maps persisted English and Gregorian settings to live application preferences', () => {
    expect(
      resolveSystemPreferences(
        {
          calendar: 'میلادی',
          language: 'English',
          money: 'تومان',
          numbers: 'لاتین',
        },
        { timezone: 'Asia/Dubai' },
      ),
    ).toEqual({
      calendar: 'gregorian',
      direction: 'ltr',
      language: 'en',
      locale: 'en-US',
      moneyUnit: 'TOMAN',
      numberingSystem: 'latn',
      timezone: 'Asia/Dubai',
    });
  });

  it('falls back safely when no settings have been stored', () => {
    expect(resolveSystemPreferences(undefined, undefined)).toMatchObject({
      calendar: 'persian',
      direction: 'rtl',
      language: 'fa',
      locale: 'fa-IR',
      moneyUnit: 'IRR',
      numberingSystem: 'arabext',
      timezone: 'Asia/Tehran',
    });
  });
});
