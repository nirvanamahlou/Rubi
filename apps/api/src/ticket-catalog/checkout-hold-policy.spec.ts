import { describe, it, expect } from 'vitest';
import {
  checkoutSeatCount,
  checkoutQuoteFingerprint,
  checkoutHoldIsLive,
  assertCheckoutHoldReplay,
  CHECKOUT_HOLD_MS,
} from './checkout-hold-policy';
import { liveCapacityHolds } from './live-capacity-holds';
describe('payment capacity policy', () => {
  it('has exactly ten minutes and counts children but not seatless infants', () => {
    expect(CHECKOUT_HOLD_MS).toBe(600000);
    expect(checkoutSeatCount({ adults: 1, children: 2, infants: 3 })).toBe(3);
  });
  it.each([
    { adults: 0, children: 0, infants: 1 },
    { adults: -1, children: 2, infants: 0 },
    { adults: 1.5, children: 0, infants: 0 },
    { adults: 31, children: 0, infants: 0 },
  ])('rejects invalid seat demand %o', (counts) =>
    expect(() => checkoutSeatCount(counts)).toThrow(),
  );
  it('canonicalizes decimals but binds age composition and target', () => {
    const q = {
      amount: '1000',
      currencyCode: 'IRR',
      salePriceTargetId: 'website',
      passengerCounts: { adults: 1, children: 1, infants: 0 },
    };
    expect(checkoutQuoteFingerprint(q)).toBe(
      checkoutQuoteFingerprint({ ...q, amount: '1000.00' }),
    );
    expect(checkoutQuoteFingerprint(q)).not.toBe(
      checkoutQuoteFingerprint({
        ...q,
        passengerCounts: { adults: 2, children: 0, infants: 0 },
      }),
    );
  });
  it('expires a prepared lease exactly at deadline but preserves unknown bank outcome', () => {
    const now = new Date('2026-01-01T00:10:00Z'),
      h = { status: 'ACTIVE', expiresAt: now, paymentPendingAt: null };
    expect(checkoutHoldIsLive(h, now)).toBe(false);
    expect(
      checkoutHoldIsLive(
        { ...h, paymentPendingAt: new Date('2026-01-01') },
        now,
      ),
    ).toBe(true);
    expect(
      checkoutHoldIsLive(
        { ...h, status: 'RELEASED', paymentPendingAt: now },
        now,
      ),
    ).toBe(false);
    expect(liveCapacityHolds(now).OR).toHaveLength(2);
  });
  it('does not accept changed, missing or expired roundtrip holds', () => {
    const now = new Date(),
      holds = ['out', 'return'].map((offerId) => ({
        offerId,
        quantity: 2,
        status: 'ACTIVE',
        expiresAt: new Date(now.getTime() + 1000),
        paymentPendingAt: null,
      }));
    expect(() =>
      assertCheckoutHoldReplay(holds, ['out', 'return'], 2, now),
    ).not.toThrow();
    expect(() => assertCheckoutHoldReplay(holds, ['out'], 2, now)).toThrow();
    expect(() =>
      assertCheckoutHoldReplay(holds, ['out', 'return'], 3, now),
    ).toThrow();
    expect(() =>
      assertCheckoutHoldReplay(
        holds,
        ['out', 'return'],
        2,
        new Date(now.getTime() + 1001),
      ),
    ).toThrow();
  });
});
