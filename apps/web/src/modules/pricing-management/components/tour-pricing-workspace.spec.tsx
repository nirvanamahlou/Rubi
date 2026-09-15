import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TourPricingWorkspace } from './tour-pricing-workspace';

describe('tour package pricing workspace', () => {
  it('shows the purchase-to-sale workflow under Sales without fake publication', () => {
    const html = renderToStaticMarkup(<TourPricingWorkspace />);
    expect(html).toContain('فروش و ارتباط با مشتری · ماژول مدیریت قیمت');
    expect(html).toContain('نوبت تور');
    expect(html).toContain('قیمت خرید هتل‌های تور');
    expect(html).toContain('پرواز بزرگسال');
    expect(html).toContain('پرواز کودک');
    expect(html).toContain('افزایش نرخ بیزینس');
    expect(html).toContain('کمیسیون');
    expect(html).toContain('انتشار پس از دریافت نرخ خرید تأییدشده از مالی');
    expect(html).toContain('disabled');
    expect(html).not.toContain('با موفقیت منتشر شد');
  });
});
