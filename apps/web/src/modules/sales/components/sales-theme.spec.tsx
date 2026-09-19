import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesDashboardMetrics } from './sales-workspace';
import { SalesThemedSelect } from './sales-themed-select';
describe('Sales theme consistency', () => {
  it('renders the app combobox trigger, including an all/empty choice', () => {
    const html = renderToStaticMarkup(
      <SalesThemedSelect
        label="وضعیت تسویه"
        value=""
        onValueChange={vi.fn()}
        options={[
          { value: '', label: 'همه وضعیت‌های تسویه' },
          { value: 'SETTLED', label: 'تسویه شده' },
        ]}
      />,
    );
    expect(html).toMatch(/<button[^>]*role="combobox"/);
    expect(html).toContain('همه وضعیت‌های تسویه');
    expect(html).toContain('aria-label="وضعیت تسویه"');
    expect(html).toContain('rounded-xl');
  });
  it('supports disabled and required selectors without replacing their semantics', () => {
    const html = renderToStaticMarkup(
      <SalesThemedSelect
        label="بانک"
        value=""
        options={[{ value: '', label: 'انتخاب بانک' }]}
        onValueChange={vi.fn()}
        required
        disabled
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('انتخاب بانک');
  });
  it('matches customer gradient cards and retains the authoritative Sales values', () => {
    const html = renderToStaticMarkup(
      <SalesDashboardMetrics
        dashboard={{
          todayContracts: 12,
          activeContracts: 24,
          unpaidContracts: 3,
          partiallySettledContracts: 4,
          rialSales: '9007199254740993.25',
        }}
      />,
    );
    for (const tone of ['blue', 'cyan', 'amber', 'emerald']) {
      expect(html).toContain(`border-${tone}-300/60`);
      expect(html).toContain(`dark:via-${tone}-950/40`);
    }
    expect(html).toContain('شاخص‌های فروش');
    expect(html).toContain('text-3xl font-black');
    expect(html).toContain('۱۲');
    expect(html).toContain('۲۴');
    expect(html).toContain('۷');
    expect(html).toContain('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۲۵ ریال');
    expect(html).not.toContain('مطابق فیلتر');
  });
});
