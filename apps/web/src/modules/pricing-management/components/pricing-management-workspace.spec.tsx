import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PricingManagementWorkspace } from './pricing-management-workspace';

describe('pricing management workspace', () => {
  it('renders the sales sub-section without synthetic prices or fake output success', () => {
    const html = renderToStaticMarkup(<PricingManagementWorkspace />);
    expect(html).toContain('مدیریت قیمت و پکیج‌ها');
    expect(html).toContain('فروش و ارتباط با مشتری');
    expect(html).toContain('ساخت پکیج');
    expect(html).toContain('بازه‌های قیمت');
    expect(html).toContain('قواعد قیمت');
    expect(html).toContain('پیش‌فاکتورها');
    expect(html).toContain('قالب‌های بنر');
    expect(html).toContain('خروجی‌ها');
    expect(html).toContain('ردپای تغییرات');
    expect(html).not.toContain('synthetic');
    expect(html).not.toContain('با موفقیت ساخته شد');
  });
});
