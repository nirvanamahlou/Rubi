import { describe, expect, it } from 'vitest';
import { restoreContractDraft } from './restore-contract-draft';
import { usesRoomDrivenGuests } from './contract-guest-stays';
import { guestStayColumns } from '../components/guest-stay-columns';

describe('new contract browser draft compatibility', () => {
  it('restores individual stay columns for a pre-feature flight/hotel draft', () => {
    const state = restoreContractDraft({ serviceKinds: ['FLIGHT', 'HOTEL'] });
    expect(usesRoomDrivenGuests(state)).toBe(true);
    expect(
      guestStayColumns(
        state,
        () => {},
        (key) => key,
      ).map((c) => c.title),
    ).toEqual([
      'چک‌این هتل',
      'چک‌اوت هتل',
      'اقامت متفاوت',
      'مبلغ اقامت متفاوت',
    ]);
  });

  it('preserves entered people, hotel dates and custom stay amounts', () => {
    const original = restoreContractDraft({
      serviceKinds: ['FLIGHT', 'HOTEL'],
    });
    original.hotel.checkIn = '2026-11-01';
    original.hotel.checkOut = '2026-11-08';
    original.passengers = [
      { customerId: 'synthetic-guest', displayName: 'Synthetic Guest' },
    ];
    original.passengerHotelPrices = {
      p0: [{ amount: '125', currencyCode: 'USD' }],
    };
    original.passengerHotelStays = {
      p0: { different: true, checkIn: '2026-11-02', checkOut: '2026-11-07' },
    };
    const restored = restoreContractDraft({
      ...original,
      roomDrivenGuests: false,
    });
    expect(restored.roomDrivenGuests).toBe(true);
    expect(restored.hotel).toEqual(original.hotel);
    expect(restored.passengers).toEqual(original.passengers);
    expect(restored.passengerHotelPrices).toEqual(
      original.passengerHotelPrices,
    );
    expect(restored.passengerHotelStays).toEqual(original.passengerHotelStays);
  });

  it('does not enable hotel guest columns for flight-only drafts', () => {
    expect(
      usesRoomDrivenGuests(restoreContractDraft({ serviceKinds: ['FLIGHT'] })),
    ).toBe(false);
  });
});
