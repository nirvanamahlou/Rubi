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
    expect(html).toContain('مهر ۱۴۰۵');
    expect(html.match(/>—</g)).toHaveLength(4);
  });
});
