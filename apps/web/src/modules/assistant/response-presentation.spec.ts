import { describe, expect, it } from 'vitest';
import {
  assistantSourceRequest,
  formatAssistantSources,
  persianAssistantTerms,
} from './response-presentation';

describe('public assistant labels', () => {
  it('shows each observation detail only when explicitly requested', () => {
    const source = {
      sources: ['contracts'],
      observedAt: '2026-11-24T07:34:00Z',
    };
    const render = (q: string) =>
      formatAssistantSources([source], false, assistantSourceRequest(q));
    expect(render('پرفروش ترین هتل هارا که باهاشون قرارداد بستیمو بده')).toBe(
      '',
    );
    expect(render('منبع آشنایی مشتریان چیست؟')).toBe('');
    expect(render('منابع پاسخ را بده')).toBe('قراردادها');
    expect(render('ساعت مشاهده را بگو')).toBe('ساعت مشاهده: ۱۱:۰۴:۰۰');
    expect(render('تاریخ مشاهده را بگو')).toMatch(/^تاریخ مشاهده:[^\n]*$/);
  });
  it('localizes aggregation labels observed in live calculation replies', () => {
    expect(
      persianAssistantTerms(
        'total = COUNT(*) = count = SUM(amounts) = sum؛ 45 + 2 + 1 = 48',
      ),
    ).toBe(
      'مجموع = تعداد(*) = تعداد = جمع(مبالغ قرارداد) = جمع؛ 45 + 2 + 1 = 48',
    );
    expect(
      persianAssistantTerms('ACME Total REF-total-120 my_total_copy'),
    ).toBe('ACME Total REF-total-120 my_total_copy');
  });
  it('uses business source names and separates Tehran observation date/time', () => {
    const text = formatAssistantSources([
      {
        kind: 'panel-count-breakdown',
        sources: ['contracts'],
        observedAt: '2026-11-16T20:45:15Z',
      },
    ]);
    expect(text).toContain('آمار قراردادهای فروش و وضعیت رزرواسیون');
    expect(text).toContain('\nتاریخ مشاهده:');
    expect(text).toContain('\nساعت مشاهده: ۰۰:۱۵:۱۵');
    expect(text).not.toMatch(/[A-Za-z_]/);
  });
  it('never leaks raw unknown source IDs and keeps English localization available', () => {
    const source = {
      sources: ['amounts', 'payments', 'unknown_schema.secret'],
      observedAt: '2026-11-17T09:00:00Z',
    };
    const fa = formatAssistantSources([source]);
    expect(fa).toContain(
      'مبالغ قرارداد، پرداخت‌های ثبت‌شده، داده‌های مجاز سامانه',
    );
    expect(fa).not.toMatch(/[A-Za-z_]/);
    expect(formatAssistantSources([source], true)).toContain(
      'Observation time:',
    );
    expect(
      formatAssistantSources([{ ...source, observedAt: 'invalid' }]),
    ).toContain('زمان مشاهده ثبت نشده است');
  });
  it('replaces complete technical tokens without changing identifiers, names or arithmetic', () => {
    expect(
      persianAssistantTerms(
        'panel_non_cancelled + sales_cancelled = 40 + 2؛ ACME REF-USD-120 my_panel_non_cancelled_copy',
      ),
    ).toBe(
      'قراردادهای لغونشده در پنل + قراردادهای لغوشده در فروش = 40 + 2؛ ACME REF-USD-120 my_panel_non_cancelled_copy',
    );
  });
});
