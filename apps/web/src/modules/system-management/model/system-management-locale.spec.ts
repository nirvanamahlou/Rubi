import { describe, expect, it } from 'vitest';

import { settingsModules, systemTimezones } from './settings-catalog';
import {
  containsPersian,
  englishText,
  localizeOption,
  localizeSettingModules,
} from './system-management-locale';

describe('system management English localization', () => {
  it('does not expose Persian catalog text when English is active', () => {
    const modules = localizeSettingModules(settingsModules, 'en');

    for (const settingsModule of modules) {
      expect(containsPersian(settingsModule.title)).toBe(false);
      expect(containsPersian(settingsModule.category)).toBe(false);
      for (const group of settingsModule.groups) {
        expect(containsPersian(group.title)).toBe(false);
        group.rules.forEach((rule) =>
          expect(containsPersian(rule)).toBe(false),
        );
        for (const field of group.fields) {
          expect(containsPersian(field.label)).toBe(false);
          if (field.unit) expect(containsPersian(field.unit)).toBe(false);
          field.options?.forEach((option, index) =>
            expect(containsPersian(localizeOption(option, index))).toBe(false),
          );
          if (typeof field.value === 'string')
            expect(containsPersian(englishText(field.value))).toBe(false);
        }
      }
    }
  });

  it('offers the shared extended IANA time-zone list wherever a time zone is configured', () => {
    expect(systemTimezones.length).toBeGreaterThanOrEqual(25);
    expect(new Set(systemTimezones).size).toBe(systemTimezones.length);
    for (const zone of systemTimezones)
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone })).not.toThrow();

    const timeZoneFields = settingsModules.flatMap((settingsModule) =>
      settingsModule.groups.flatMap((group) =>
        group.fields.filter((field) =>
          ['timezone', 'zone'].includes(field.key),
        ),
      ),
    );
    expect(timeZoneFields.length).toBe(2);
    timeZoneFields.forEach((field) =>
      expect(field.options).toEqual([...systemTimezones]),
    );
  });

  it('localizes consent methods and numeric units with meaningful English labels', () => {
    expect(localizeOption('پیامک و کد تأیید', 0)).toBe(
      'SMS verification code',
    );
    expect(localizeOption('امضای الکترونیکی', 0)).toBe(
      'Electronic signature',
    );
    expect(englishText('روز', 'units')).toBe('days');
    expect(englishText('دقیقه', 'units')).toBe('minutes');
  });
});
