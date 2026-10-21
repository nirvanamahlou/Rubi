import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HrRecordDto } from '@nora/contracts';
import { persianDateToIso } from './hr-dates';
import { hrStatusText, hrStatusTone } from './hr-presentation';
import { HrStatus } from './hr-controls';
import { sourceForRecord } from './hr-record-source';
import { jsx } from '@/i18n/jsx-runtime';
import { createElement } from 'react';
import { DisplayLocaleContext } from '@/i18n/locale-context';

describe('HR presentation boundaries', () => {
  it.each([
    ['فعال', 'success'],
    ['غیرفعال', 'danger'],
    ['در انتظار تأیید', 'warning'],
    ['پیش‌نویس', 'neutral'],
  ] as const)(
    'preserves localized %s status in every HR badge',
    (status, tone) => {
      const badge = jsx(HrStatus, { children: status });
      for (const language of ['fa', 'en'] as const) {
        const html = renderToStaticMarkup(
          createElement(
            DisplayLocaleContext.Provider,
            { value: language },
            badge,
          ),
        );
        expect(html).toContain(`data-tone="${tone}"`);
        expect(html).not.toContain('نامشخص');
        if (language === 'fa') expect(html).toContain(status);
        else expect(html).not.toMatch(/[\u0600-\u06ff]/);
      }
    },
  );

  it('does not label an inactive or pending record as successful', () => {
    expect(hrStatusTone('غیرفعال')).toBe('danger');
    expect(hrStatusTone('غیر فعال')).toBe('danger');
    expect(hrStatusTone('فعال')).toBe('success');
    expect(hrStatusTone('در انتظار تأیید')).toBe('warning');
    expect(hrStatusTone('در انتظار امضا')).toBe('warning');
    expect(hrStatusTone('نیازمند تکمیل')).toBe('warning');
    expect(hrStatusTone('نیازمند تأیید')).toBe('warning');
    expect(hrStatusTone('تأیید نشده')).toBe('warning');
    expect(hrStatusTone('تکمیل‌شده')).toBe('success');
    expect(hrStatusTone('پیش‌نویس')).toBe('neutral');
  });

  it('keeps malformed saved status values from crashing HR rendering', () => {
    expect(hrStatusText({ label: 'در انتظار تأیید' })).toBe('در انتظار تأیید');
    expect(hrStatusTone({ label: 'در انتظار تأیید' })).toBe('warning');
    expect(hrStatusText({ label: 3 })).toBe('نامشخص');
    expect(hrStatusTone({ label: 3 })).toBe('neutral');
    expect(hrStatusText(null)).toBe('نامشخص');
    expect(hrStatusTone(null)).toBe('neutral');
    expect(
      renderToStaticMarkup(HrStatus({ children: { label: 3 } })),
    ).toContain('نامشخص');
  });

  it('preserves ISO date-only values and converts localized Persian dates consistently', () => {
    expect(persianDateToIso('2026-09-08')).toBe('2026-09-08');
    expect(persianDateToIso('۱۴۰۵/۰۶/۱۷')).toBe('2026-09-08');
    expect(persianDateToIso('١٤٠٥/٠٦/١٧')).toBe('2026-09-08');
    expect(persianDateToIso('۱۴۰۵/۰۶/۱۷')).toBe('2026-09-08');
    expect(persianDateToIso('')).toBe('');
    expect(persianDateToIso('تاریخ نامعتبر')).toBe('تاریخ نامعتبر');
  });

  it('keeps automatic attendance records read-only after extracting navigation metadata', () => {
    const source = sourceForRecord({
      section: 'time',
      tab: 'attendance',
    } as HrRecordDto);
    expect(source.readOnly).toBe(true);
    expect(source.label).toBe('کارکرد روزانه');
    expect(
      sourceForRecord({
        section: 'lifecycle',
        tab: 'promotion',
      } as HrRecordDto),
    ).toMatchObject({
      section: 'lifecycle',
      tab: 'promotion',
      label: 'ارتقا',
      readOnly: false,
    });
  });
});
