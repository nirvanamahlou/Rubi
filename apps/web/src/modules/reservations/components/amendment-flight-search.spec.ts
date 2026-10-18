import { describe, expect, it } from 'vitest';
import type { SalesContractAmendmentV1 } from '@nora/contracts';
import {
  amendmentFlightDay,
  matchesSavedAmendmentFlight,
} from './amendment-flight-search';

const draft = {
  originId: 'tehran',
  destinationId: 'antalya',
  departureDate: '2026-10-01',
  returnNotBefore: null,
  services: [],
  ticketSelections: [
    {
      direction: 'OUTBOUND',
      offerId: 'old',
      originId: 'tehran',
      destinationId: 'antalya',
      departureAt: '2026-10-02T22:00:00Z',
      carrierNameSnapshot: 'Synthetic Air',
    },
    {
      direction: 'RETURN',
      offerId: 'back',
      originId: 'antalya',
      destinationId: 'tehran',
      departureAt: '2026-10-08T22:00:00Z',
      carrierNameSnapshot: 'Synthetic Air',
    },
  ],
} as unknown as SalesContractAmendmentV1;

describe('saved flight search during amendment', () => {
  it('uses the saved flight day in Tehran instead of the contract date or UTC day', () => {
    expect(amendmentFlightDay(draft, 'OUTBOUND')).toBe('2026-10-03');
    expect(amendmentFlightDay(draft, 'RETURN')).toBe('2026-10-09');
  });
  it('recognizes a retained past ticket even when it is absent from sellable inventory', () => {
    expect(matchesSavedAmendmentFlight(draft, 'OUTBOUND', '2026-10-03')).toBe(
      true,
    );
    expect(
      matchesSavedAmendmentFlight(
        draft,
        'RETURN',
        '2026-10-09',
        'Synthetic Air',
      ),
    ).toBe(true);
    expect(draft.ticketSelections?.[0]?.offerId).toBe('old');
  });
  it('does not claim that the saved ticket matches a changed date, route or airline', () => {
    expect(matchesSavedAmendmentFlight(draft, 'OUTBOUND', '2026-10-04')).toBe(
      false,
    );
    expect(
      matchesSavedAmendmentFlight(
        { ...draft, destinationId: 'other' },
        'OUTBOUND',
        '2026-10-03',
      ),
    ).toBe(false);
    expect(
      matchesSavedAmendmentFlight(draft, 'OUTBOUND', '2026-10-03', 'Other Air'),
    ).toBe(false);
  });
  it('does not reuse the outbound day for a missing return flight', () => {
    const withoutFlights = { ...draft, ticketSelections: [] };
    expect(amendmentFlightDay(withoutFlights, 'OUTBOUND')).toBe('2026-10-01');
    expect(amendmentFlightDay(withoutFlights, 'RETURN')).toBe('');
    expect(
      matchesSavedAmendmentFlight(withoutFlights, 'OUTBOUND', '2026-10-01'),
    ).toBe(false);
  });
});
