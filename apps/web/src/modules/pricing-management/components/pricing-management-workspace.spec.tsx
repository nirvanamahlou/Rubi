import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PricingManagementWorkspace } from './pricing-management-workspace';

describe('pricing management workspace', () => {
  it('renders daily owned-product pricing and real banner controls', () => {
    const html = renderToStaticMarkup(<PricingManagementWorkspace />);
    expect(html).toContain('مدیریت قیمت');
    expect(html).toContain('تورهای شرکت');
    expect(html).toContain('بلیت‌های ملکی');
    expect(html).toContain('قیمت جدید');
    expect(html).toContain('نمایش در بنر');
    expect(html).toContain('دریافت بنر PNG');
    expect(html).toContain('نسخه Preview');
    expect(html).not.toContain('ذخیره موفق قیمت عملیاتی');
  });
});
