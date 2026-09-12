import { describe, expect, it } from 'vitest';
import { formatPrice, priceBannerFileName } from './price-banner';

describe('price banner output', () => {
  it('formats price content without implicit currency conversion', () => {
    expect(formatPrice('485000000', 'IRR')).toContain('۴۸۵٬۰۰۰٬۰۰۰');
    expect(formatPrice('1250.5', 'USD')).toContain('USD');
  });

  it('creates a stable PNG filename for the selected day', () => {
    expect(priceBannerFileName('2026-09-12')).toBe(
      'niyayesh-price-banner-2026-09-12.png',
    );
  });
});
