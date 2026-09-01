import { describe, expect, it } from 'vitest';
import { emptyInput } from '../model/preview';
import { createReturnTicketDraft } from './ticket-form';

describe('Round-trip ticket definition', () => {
  it('creates an independent return draft with the outbound route reversed', () => {
    const outbound = emptyInput();
    const segment = outbound.segments[0]!;
    segment.originCountryId = 'country-ir';
    segment.originCityId = 'city-thr';
    segment.originAirportId = 'airport-ika';
    segment.destinationCountryId = 'country-tr';
    segment.destinationCityId = 'city-ist';
    segment.destinationAirportId = 'airport-ist';
    segment.departureZone = 'Asia/Tehran';
    segment.arrivalZone = 'Europe/Istanbul';

    const inbound = createReturnTicketDraft(outbound);
    const returnSegment = inbound.segments[0]!;

    expect(returnSegment).toMatchObject({
      originCountryId: 'country-tr',
      originCityId: 'city-ist',
      originAirportId: 'airport-ist',
      destinationCountryId: 'country-ir',
      destinationCityId: 'city-thr',
      destinationAirportId: 'airport-ika',
      departureZone: 'Europe/Istanbul',
      arrivalZone: 'Asia/Tehran',
      flightNumber: '',
      departureAt: '',
      arrivalAt: '',
    });
    expect(inbound.title).toBe('');
  });

  it('does not share mutable fare or segment objects with the outbound ticket', () => {
    const outbound = emptyInput();
    const inbound = createReturnTicketDraft(outbound);

    inbound.fare.purchase = '999';
    inbound.segments[0]!.flightNumber = 'RETURN-1';

    expect(outbound.fare.purchase).not.toBe('999');
    expect(outbound.segments[0]!.flightNumber).not.toBe('RETURN-1');
  });
});
