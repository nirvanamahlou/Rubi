import { describe, expect, it } from 'vitest';

import { settingsModules, systemTimezones } from './settings-catalog';
import {
  containsPersian,
  englishText,
  localizeOption,
  localizeSettingModules,
} from './system-management-locale';

describe('system management English localization', () => {
  it('keeps the finance module visible without any settings', () => {
    expect(
      settingsModules.find((module) => module.id === 'finance')?.groups,
    ).toEqual([]);
  });

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
      expect(
        () => new Intl.DateTimeFormat('en-US', { timeZone: zone }),
      ).not.toThrow();

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

  it('localizes role options and numeric units with meaningful English labels', () => {
    expect(englishText('روز', 'units')).toBe('days');
    expect(englishText('دقیقه', 'units')).toBe('minutes');
    expect(localizeOption('در انتظار تکمیل مدارک', 0)).toBe(
      'Awaiting documents',
    );
    expect(localizeOption('کمیته ارزیابی تأمین‌کنندگان', 0)).toBe(
      'Supplier evaluation committee',
    );
    expect(localizeOption('سرپرست خزانه‌داری', 0)).toBe('Treasury supervisor');
    expect(localizeOption('کمیته نرخ ارز', 0)).toBe('Exchange-rate committee');
  });

  it('offers several relevant recipients for every role-routing selector', () => {
    const roleSelector =
      /گیرنده|مسئول|مرجع|بازبین فایل|مراحل تأیید|تأیید الحاقیه|تأیید نرخ جدید|تأیید مرحله دوم|تأیید کاربر سازمان|تأیید مرخصی|تأیید اضافه‌کاری|تأیید مبانی پرداخت/;
    const fields = settingsModules.flatMap((settingsModule) =>
      settingsModule.groups.flatMap((group) =>
        group.fields.filter(
          (field) => field.type === 'select' && roleSelector.test(field.label),
        ),
      ),
    );

    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((field) =>
      expect(field.options?.length).toBeGreaterThanOrEqual(5),
    );
  });

  it('offers messaging apps as travel-document delivery channels', () => {
    const field = settingsModules
      .flatMap((settingsModule) => settingsModule.groups)
      .flatMap((group) => group.fields)
      .find((item) => item.label === 'کانال پیش‌فرض تحویل');

    expect(field?.options).toEqual([
      'داخل سامانه',
      'ایمیل',
      'واتساپ',
      'تلگرام',
    ]);
    expect(localizeOption('واتساپ', 0)).toBe('WhatsApp');
    expect(localizeOption('تلگرام', 0)).toBe('Telegram');
  });
});
