import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  companyFlightLegs,
  charterLoadCities,
  tehranLoadOrigin,
  disjointFlightLoadLegs,
  countryFlightLoadOffers,
  currentCompanyLoadOffers,
  validFlightLoadDates,
  canSearchFlightLoad,
  changeFlightLoadFilter,
  companyReturnLegs,
  flightLoadTotals,
  type FlightLoadFilter,
} from './flight-load';
const offer = (
  id: string,
  date: string,
  patch: Partial<TicketOfferV1> = {},
): TicketOfferV1 => ({
  id,
  version: 1,
  branchId: 'branch',
  originId: 'a',
  destinationId: 'b',
  departureAt: date + 'T10:00:00Z',
  arrivalAt: date + 'T12:00:00Z',
  carrierName: 'Air',
  serviceNumber: 'ABC4512',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 50,
  remainingCapacity: 43,
  allocatedCapacity: 5,
  reservedCapacity: 2,
  status: 'ACTIVE',
  supplyType: 'COMPANY',
  ...patch,
});
const filter: FlightLoadFilter = {
  from: '2099-10-01',
  to: '2099-10-30',
  origin: 'a',
  destination: 'b',
  carrier: '',
  number: '451',
  weekday: '',
  cabin: '',
};
describe('company flight load', () => {
  it('never puts an outbound or another forward leg in returns, even on the same day', () => {
    const out = offer('out', '2099-10-01');
    const forward = offer('other-out', '2099-10-01', {
      departureAt: '2099-10-01T14:00:00Z',
    });
    const back = offer('back', '2099-10-01', {
      originId: 'b',
      destinationId: 'a',
      departureAt: '2099-10-01T14:00:00Z',
      arrivalAt: '2099-10-01T16:00:00Z',
    });
    expect(
      companyFlightLegs([out, forward, back], filter).map((row) => row.id),
    ).toEqual(['out', 'other-out']);
    expect(
      companyReturnLegs([out, forward, back], out, false).map((row) => row.id),
    ).toEqual(['back']);
    expect(companyReturnLegs([out, forward, back], undefined, false)).toEqual(
      [],
    );
  });
  it('keeps historical legs while valid dates start today and exclude departed legs', () => {
    const rows = [
      offer('ended', '2099-10-01', { status: 'PAUSED' }),
      offer('ongoing', '2099-10-02'),
      offer('future', '2099-10-03'),
    ];
    const now = new Date('2099-10-02T11:00:00Z');
    expect(companyFlightLegs(rows, filter).map((row) => row.id)).toEqual([
      'ended',
      'ongoing',
      'future',
    ]);
    expect(currentCompanyLoadOffers(rows, now).map((row) => row.id)).toEqual([
      'future',
    ]);
    expect(validFlightLoadDates(rows, filter, now)).toEqual({
      from: '2099-10-02',
      to: '2099-10-03',
    });
  });

  it('requires both distinct endpoints even when dates are selected', () => {
    const blank = { ...filter, from: '', to: '', origin: '', destination: '' };
    expect(canSearchFlightLoad(blank)).toBe(false);
    expect(canSearchFlightLoad({ ...blank, destination: 'b' })).toBe(false);
    expect(canSearchFlightLoad({ ...filter, origin: '' })).toBe(false);
    expect(canSearchFlightLoad({ ...filter, destination: '' })).toBe(false);
    expect(canSearchFlightLoad({ ...filter, destination: 'a' })).toBe(false);
    expect(canSearchFlightLoad(filter)).toBe(true);
    expect(
      companyFlightLegs([offer('out', '2099-10-01')], {
        ...filter,
        origin: '',
      }),
    ).toEqual([]);
    const rows = [
      offer('latest', '2099-11-03'),
      offer('first', '2099-10-02'),
      offer('other', '2099-09-01', { destinationId: 'c' }),
      offer('external', '2099-01-01', { supplyType: 'API' }),
    ];
    expect(
      validFlightLoadDates(
        rows,
        { ...blank, destination: 'b' },
        new Date('2099-10-01T10:00:00Z'),
      ),
    ).toEqual({
      from: '2099-10-01',
      to: '2099-11-03',
    });
    expect(
      validFlightLoadDates(
        rows,
        { ...blank, origin: 'missing' },
        new Date('2099-10-01T10:00:00Z'),
      ),
    ).toEqual({ from: '2099-10-01', to: '' });
  });
  it('keeps the changed date and clears only the conflicting opposite bound', () => {
    expect(changeFlightLoadFilter(filter, 'from', '2099-11-04')).toMatchObject({
      from: '2099-11-04',
      to: '',
    });
    expect(changeFlightLoadFilter(filter, 'to', '2099-06-30')).toMatchObject({
      from: '',
      to: '2099-06-30',
    });
    expect(changeFlightLoadFilter(filter, 'to', '2099-10-15')).toMatchObject({
      from: '2099-10-01',
      to: '2099-10-15',
    });
  });
  it('shows unknown legacy reverse legs without changing their provenance', () => {
    const outbound = offer('old-out', '2099-10-01', {
      supplyType: null,
      returnMinDays: 2,
      returnMaxDays: 5,
    });
    const returning = offer('old-return', '2099-10-03', {
      supplyType: null,
      originId: 'b',
      destinationId: 'a',
    });
    expect(companyReturnLegs([returning], outbound, false)).toEqual([
      returning,
    ]);
    expect(returning.supplyType).toBeNull();
    expect(
      companyFlightLegs([outbound], { ...filter, from: '', to: '' }),
    ).toEqual([outbound]);
  });
  it('includes company and unknown legacy capacity, excludes explicit external supply, respects filters', () => {
    const rows = [
      offer('first', '2099-10-01'),
      offer('last', '2099-10-30'),
      offer('later', '2099-10-31'),
      offer('api', '2099-10-03', { supplyType: 'API' }),
      offer('floating', '2099-10-03', { supplyType: 'FLOATING' }),
      offer('legacy', '2099-10-03', { supplyType: null }),
    ];
    expect(companyFlightLegs(rows, filter).map((row) => row.id)).toEqual([
      'first',
      'legacy',
      'last',
    ]);
  });
  it('selects reverse legs within inclusive Min/Max beyond outbound filter end, branch and class', () => {
    const outbound = offer('out', '2099-10-30', {
      returnMinDays: 2,
      returnMaxDays: 15,
    });
    const back = (
      id: string,
      date: string,
      patch: Partial<TicketOfferV1> = {},
    ) => offer(id, date, { originId: 'b', destinationId: 'a', ...patch });
    const rows = [
      back('min', '2099-11-01'),
      back('max', '2099-11-14'),
      back('outside', '2099-11-15'),
      back('branch', '2099-11-02', { branchId: 'other' }),
      back('business', '2099-11-02', { cabinClassCode: 'BUSINESS' }),
      back('api', '2099-11-02', { supplyType: 'API' }),
    ];
    expect(
      companyReturnLegs(rows, outbound, true).map((row) => row.id),
    ).toEqual(['min', 'max']);
    expect(
      companyReturnLegs(rows, outbound, false).map((row) => row.id),
    ).toEqual(['min', 'business', 'max']);
    expect(companyReturnLegs(rows, undefined, false)).toEqual([]);
  });
  it('totals legs once and separates active allocation from held seats', () => {
    expect(
      flightLoadTotals([offer('a', '2099-10-01'), offer('b', '2099-10-02')]),
    ).toEqual({ total: 100, remaining: 86, sold: 10, reserved: 4 });
  });
  it('filters weekday in Tehran calendar rather than UTC date', () => {
    const row = offer('late', '2099-10-01', {
      departureAt: '2099-10-01T22:00:00Z',
    });
    const day = new Date('2099-10-02T00:00:00Z').getUTCDay().toString();
    expect(companyFlightLegs([row], { ...filter, weekday: day })).toHaveLength(
      1,
    );
  });
  it('filters destination country without excluding the selected flight reverse leg', () => {
    const out = offer('out', '2000-10-01');
    const back = offer('back', '2000-10-03', {
      originId: 'b',
      destinationId: 'a',
    });
    const refs = [
      {
        id: 'a',
        kind: 'city' as const,
        name: 'Origin',
        active: true,
        countryId: 'iran',
      },
      {
        id: 'b',
        kind: 'city' as const,
        name: 'Destination',
        active: true,
        countryId: 'turkey',
      },
    ];
    expect(countryFlightLoadOffers([out, back], refs, 'turkey')).toEqual([out]);
    expect(companyReturnLegs([out, back], out, false)).toEqual([back]);
    expect(countryFlightLoadOffers([out, back], refs, '')).toHaveLength(2);
  });
  it('uses today in Tehran even when UTC is still yesterday', () => {
    const rows = [offer('last', '2099-10-03')];
    expect(
      validFlightLoadDates(rows, filter, new Date('2099-10-01T22:00:00Z')),
    ).toEqual({ from: '2099-10-02', to: '2099-10-03' });
  });
});

it('filters both endpoint countries and reverses their roles for reverse searches', () => {
  const a = offer('out', '2099-10-01');
  const b = offer('back', '2099-10-08', { originId: 'b', destinationId: 'a' });
  const refs = [
    {
      kind: 'city' as const,
      id: 'a',
      name: 'A',
      countryId: 'ir',
      active: true,
    },
    {
      kind: 'city' as const,
      id: 'b',
      name: 'B',
      countryId: 'tr',
      active: true,
    },
  ];
  expect(countryFlightLoadOffers([a, b], refs, 'tr', 'ir')).toEqual([a]);
  expect(countryFlightLoadOffers([a, b], refs, 'ir', 'tr')).toEqual([b]);
  expect(disjointFlightLoadLegs([a, b], [b])).toEqual([a]);
  expect(companyReturnLegs([a, b], a, false, '')).toEqual([b]);
});

it('finds the same load through its second commercial destination without multiplying inventory', () => {
  const shared = offer('shared', '2099-10-03', {
    saleRoutes: [{ originId: 'a', destinationId: 'c' }],
  });
  const rows = companyFlightLegs([shared], { ...filter, destination: 'c' });
  expect(rows).toEqual([shared]);
  expect(flightLoadTotals(rows)).toEqual({
    total: 50,
    remaining: 43,
    sold: 5,
    reserved: 2,
  });
  expect(
    companyFlightLegs([shared], { ...filter, origin: 'c', destination: 'b' }),
  ).toEqual([]);
});

it('keeps past and paused charter destinations and sale routes, excludes external supply and unrelated origins', () => {
  const flights = [
    offer('old', '2020-01-01', {
      status: 'PAUSED',
      saleRoutes: [{ originId: 'a', destinationId: 'alias' }],
    }),
    offer('external', '2099-01-01', {
      supplyType: 'API',
      destinationId: 'external',
    }),
    offer('floating', '2099-01-01', {
      supplyType: 'FLOATING',
      destinationId: 'float',
    }),
    offer('elsewhere', '2099-01-01', { originId: 'c', destinationId: 'd' }),
  ];
  expect(
    charterLoadCities(flights, 'a', [
      { originId: 'a', destinationId: 'archived' },
      { originId: 'a', destinationId: 'b' },
    ]).destinations,
  ).toEqual(['b', 'alias', 'archived']);
  expect(
    tehranLoadOrigin([
      { kind: 'city', id: 'thr', name: 'تهران', active: true },
    ]),
  ).toBe('thr');
  expect(
    tehranLoadOrigin([
      { kind: 'city', id: 'thr', name: 'Tehran', active: true, code: 'THR' },
    ]),
  ).toBe('thr');
  expect(
    tehranLoadOrigin([
      { kind: 'city', id: 'wrong', name: 'تهران', active: false },
    ]),
  ).toBe('');
});

it('finds the same shared-capacity flight for each configured commercial destination without duplicating stock', () => {
  const flight = offer('shared', '2099-10-10', {
    saleRoutes: [
      { originId: 'a', destinationId: 'bodrum' },
      { originId: 'a', destinationId: 'izmir' },
    ],
  });
  for (const destination of ['b', 'bodrum', 'izmir']) {
    const rows = companyFlightLegs([flight], { ...filter, destination });
    expect(rows.map((row) => row.id)).toEqual(['shared']);
    expect(flightLoadTotals(rows)).toEqual({
      total: 50,
      remaining: 43,
      sold: 5,
      reserved: 2,
    });
  }
});
