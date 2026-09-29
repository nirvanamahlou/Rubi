import { describe, expect, it } from 'vitest';
import {
  exportScanSnapshotText,
  formatProcurementDate,
  formatProcurementRecordValue,
} from './presentation';

describe('Procurement record presentation', () => {
  it('renders record timestamps as a Persian date and explicit Tehran time', () => {
    const value = formatProcurementRecordValue(
      'createdAt',
      '2026-09-13T13:48:06.866Z',
    );
    expect(value).toContain('۲۲ شهریور ۱۴۰۵');
    expect(value).toContain('۱۷:۱۸');
    expect(value).toContain('تهران');
    expect(value).not.toContain('2026-09-13T');
  });
  it('uses Tehran calendar day at the UTC date boundary and does not parse IDs or ordinary text', () => {
    expect(formatProcurementDate('2026-09-13T22:00:00.000Z')).toContain(
      '۲۳ شهریور ۱۴۰۵',
    );
    expect(formatProcurementRecordValue('id', '2026-09-13T22:00:00.000Z')).toBe(
      '2026-09-13T22:00:00.000Z',
    );
    expect(formatProcurementRecordValue('description', '2026-09-13')).toBe(
      '2026-09-13',
    );
    expect(formatProcurementDate('2026-02-30')).toBe('—');
  });
  it('describes archived scan snapshots without asserting the current scan state', () => {
    for (const status of ['PENDING', 'CLEAN']) {
      const text = exportScanSnapshotText(status);
      expect(text).toContain('وضعیت اولیه اسکن هنگام ثبت خروجی');
      expect(text).toContain('وضعیت جاری و دریافت فایل را در اسناد بررسی کنید');
      expect(text).not.toContain('هنوز');
    }
  });
});
