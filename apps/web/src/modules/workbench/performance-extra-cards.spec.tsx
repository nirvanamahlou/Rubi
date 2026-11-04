import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkbenchHrPerformanceV1 } from '@nora/contracts';
import { PerformanceExtraCards } from './workbench-performance';

describe('personal performance extra cards', () => {
  it('renders all six cards without presenting missing data as zero', () => {
    const html = renderToStaticMarkup(<PerformanceExtraCards hr={null} />);
    for (const label of [
      'تأخیر',
      'پورسانت',
      'بدهکاری',
      'بستانکاری',
      'اضافه‌کاری',
      'کسری کار',
    ])
      expect(html).toContain(label);
    expect(html.match(/>—</g)).toHaveLength(6);
  });
  it('formats measured minutes and zero while leaving unconnected financial amounts empty', () => {
    const hr = {
      monthlyAttendance: {
        period: 'مهر ۱۴۰۵',
        lateMinutes: 0,
        overtimeMinutes: 125,
      },
    } as WorkbenchHrPerformanceV1;
    const html = renderToStaticMarkup(<PerformanceExtraCards hr={hr} />);
    expect(html).toContain('۰ ساعت و ۰ دقیقه');
    expect(html).toContain('۲ ساعت و ۵ دقیقه');
    expect(html).not.toContain('مهر ۱۴۰۵');
    expect(html).not.toContain('به عملکرد متصل نشده');
    expect(html.match(/>—</g)).toHaveLength(4);
  });
});

it('renders measured own work deficit', () => {
  const hr = {
    monthlyAttendance: {
      period: 'آبان',
      lateMinutes: 5,
      overtimeMinutes: 30,
      deficitMinutes: 75,
    },
  } as WorkbenchHrPerformanceV1;
  const html = renderToStaticMarkup(<PerformanceExtraCards hr={hr} />);
  expect(html).toContain('۱ ساعت و ۱۵ دقیقه');
});

it('renders a read-only daily attendance table with source and unknown values', async () => {
  const { AttendanceHistory } = await import('./workbench-performance');
  const html = renderToStaticMarkup(
    <AttendanceHistory
      rows={[
        {
          date: '2026-10-29',
          firstIn: '09:15',
          lastOut: '14:00',
          registrationType: 'device',
          lateMinutes: 0,
          overtimeMinutes: null,
          deficitMinutes: 0,
        },
        {
          date: '2026-10-28',
          firstIn: '09:20',
          lastOut: null,
          registrationType: 'manual',
          lateMinutes: 5,
          overtimeMinutes: null,
          deficitMinutes: null,
        },
      ]}
    />,
  );
  expect(html).toContain('پنجشنبه');
  expect(html).toContain('انگشت');
  expect(html).toContain('دستی');
  expect(html).toContain('14:00');
  expect(html).toContain('کسری کار');
  expect(html).not.toMatch(/<input|<button|contenteditable/i);
});
