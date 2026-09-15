import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TourPricingWorkspace } from './tour-pricing-workspace';

describe('tour package pricing workspace', () => {
  it('shows real draft and publication actions under Sales, disabled until a tour is selected', () => {
    const html = renderToStaticMarkup(<TourPricingWorkspace />);
    expect(html).toContain('فروش و ارتباط با مشتری · ماژول مدیریت قیمت');
    expect(html).toContain('نوبت تور');
    expect(html).toContain('قیمت خرید هتل‌های تور');
    expect(html).toContain('پرواز بزرگسال');
    expect(html).toContain('پرواز کودک');
    expect(html).toContain('افزایش نرخ بیزینس');
    expect(html).toContain('کمیسیون');
    expect(html).toContain('ذخیره پیش‌نویس این بازه');
    expect(html).toContain('انتشار نسخهٔ قیمت پکیج');
    expect(html).toContain('disabled');
    expect(html).not.toContain('این پیش‌نویس را شما ویرایش کرده‌اید');
  });
});
