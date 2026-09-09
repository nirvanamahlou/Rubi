import { describe, expect, it } from 'vitest';
import type { HrRecordDto } from '@rubi/contracts';
import { persianDateToIso } from './hr-dates';
import { hrStatusTone } from './hr-presentation';
import { sourceForRecord } from './hr-record-source';

describe('HR presentation boundaries', () => {
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
