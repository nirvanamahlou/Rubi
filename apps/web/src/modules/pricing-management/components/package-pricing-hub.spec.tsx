import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PackagePricingHub } from './package-pricing-hub';

describe('package pricing hub', () => {
  it('offers separate pricing and generator cards', () => {
    const html = renderToStaticMarkup(<PackagePricingHub />);

    expect(html).toContain('مدیریت قیمت و پکیج‌ها');
    expect(html).toContain('مدیریت قیمت');
    expect(html).toContain('پک جنریتور');
    expect(html).toContain('href="/sales/pricing/management"');
    expect(html).toContain('href="/sales/pricing/generator"');
  });
});
