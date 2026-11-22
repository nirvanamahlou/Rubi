import { describe, expect, it, vi } from 'vitest';
import { assertWebsiteBookable, websitePriceOnly } from './price-only-policy';
import { SiteCommerceService } from './site-commerce.service';

describe('floating website price-only policy', () => {
  it('applies to every floating tour and floating standalone ticket, not inventory products', () => {
    expect(websitePriceOnly('floating-tour')).toBe(true);
    expect(websitePriceOnly('ticket', 'FLOATING')).toBe(true);
    for (const kind of ['tour', 'ticket']) {
      expect(websitePriceOnly(kind, 'COMPANY')).toBe(false);
      expect(() => assertWebsiteBookable(kind, 'COMPANY')).not.toThrow();
    }
  });
  it('rejects a floating hold before reaching the checkout service, including cached holds', async () => {
    const service = Object.create(SiteCommerceService.prototype);
    service.scoped = vi.fn().mockReturnValue({ branchIds: ['branch'] });
    service.checkoutHolds = { prepareFloating: vi.fn() };
    await expect(service.holdFloating('nss', 'order', {}, {})).rejects.toThrow(
      'رزرو اینترنتی ندارد',
    );
    expect(service.checkoutHolds.prepareFloating).not.toHaveBeenCalled();
  });
});
