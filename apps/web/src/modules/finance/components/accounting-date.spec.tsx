import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccountingDate } from './accounting-date';
const preference = vi.hoisted(() => ({ calendar: 'persian', language: 'fa' }));
vi.mock('@/components/system-preferences-provider', () => ({
  useSystemPreferences: () => preference,
}));
describe('Accounting date-only presentation', () => {
  it('shows fiscal boundaries in the selected Persian calendar and retains the exact stored ISO date', () => {
    preference.calendar = 'persian';
    preference.language = 'fa';
    const start = renderToStaticMarkup(<AccountingDate value="2026-03-21" />);
    const end = renderToStaticMarkup(<AccountingDate value="2027-03-20" />);
    expect(start).toContain('dateTime="2026-03-21"');
    expect(start).toContain('فروردین');
    expect(start).toContain('۱۴۰۵');
    expect(end).toContain('اسفند');
    expect(end).toContain('۱۴۰۵');
  });
  it('keeps Gregorian display available and never converts invalid dates to another financial day', () => {
    preference.calendar = 'gregorian';
    preference.language = 'en';
    const html = renderToStaticMarkup(<AccountingDate value="2026-03-21" />);
    expect(html).toContain('March');
    expect(html).toContain('2026');
    expect(renderToStaticMarkup(<AccountingDate value="2026-02-30" />)).toBe(
      '—',
    );
  });
});
