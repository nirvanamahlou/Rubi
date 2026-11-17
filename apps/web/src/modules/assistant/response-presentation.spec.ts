import { describe, expect, it } from 'vitest';
import {
  formatAssistantSources,
  persianAssistantTerms,
} from './response-presentation';

describe('public assistant labels', () => {
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
