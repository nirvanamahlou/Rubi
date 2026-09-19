import { describe, expect, it } from 'vitest';
import type { Reference } from '../model/catalog';
import { emptyInput } from '../model/preview';
import {
  buildAutomaticTicketTitle,
  createConnectedSegment,
  createReturnTicketDraft,
  inferWallTimeOffset,
} from './ticket-form';

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

describe('Combined ticket definition', () => {
  it('connects a new segment to the previous destination without sharing data', () => {
    const input = emptyInput('train');
    const first = input.segments[0]!;
    first.destinationCountryId = 'country-ir';
    first.destinationCityId = 'city-mhd';
    first.destinationTerminal = 'ایستگاه مشهد';
    first.arrivalZone = 'Asia/Tehran';

    const connected = createConnectedSegment(input);

    expect(connected).toMatchObject({
      originCountryId: 'country-ir',
      originCityId: 'city-mhd',
      originTerminal: 'ایستگاه مشهد',
      departureZone: 'Asia/Tehran',
      flightNumber: '',
      departureAt: '',
      arrivalAt: '',
    });
    connected.originCityId = 'changed';
    expect(first.destinationCityId).toBe('city-mhd');
  });

  it('uses the first origin and final destination in an automatic title', () => {
    const input = emptyInput();
    const first = input.segments[0]!;
    first.flightNumber = 'IR-100';
    first.originCityId = 'city-thr';
    first.destinationCityId = 'city-dxb';
    const second = createConnectedSegment(input);
    second.flightNumber = 'IR-200';
    second.destinationCityId = 'city-bkk';
    input.segments = [first, second];
    input.display = {
      operator: '',
      vehicle: '',
      origin: 'تهران',
      destination: 'بانکوک',
    };

    expect(buildAutomaticTicketTitle(input, [])).toBe(
      'IR-100 ترکیبی • تهران به بانکوک',
    );
  });
});

describe('Hidden ticket metadata', () => {
  it('builds the ticket name automatically from the flight and route', () => {
    const input = emptyInput();
    const segment = input.segments[0]!;
    segment.flightNumber = 'W5-1042';
    segment.originAirportId = 'airport-ika';
    segment.destinationAirportId = 'airport-ist';
    const references: Reference[] = [
      {
        id: 'airport-ika',
        kind: 'airport',
        code: 'IKA',
        name: 'امام خمینی',
        active: true,
      },
      {
        id: 'airport-ist',
        kind: 'airport',
        code: 'IST',
        name: 'استانبول',
        active: true,
      },
    ];

    expect(buildAutomaticTicketTitle(input, references)).toBe(
      'W5-1042 • IKA به IST',
    );
  });

  it('infers the airport offset without exposing a technical input', () => {
    expect(inferWallTimeOffset('2026-09-01T10:00', 'Asia/Tehran')).toBe(
      '+03:30',
    );
    expect(inferWallTimeOffset('2026-09-01T10:00', 'Europe/Istanbul')).toBe(
      '+03:00',
    );
  });

  it('rejects a daylight-saving gap with a user-facing message', () => {
    expect(() =>
      inferWallTimeOffset('2026-03-08T02:30', 'America/New_York'),
    ).toThrow('این ساعت در منطقه زمانی مسیر معتبر نیست');
  });
});
