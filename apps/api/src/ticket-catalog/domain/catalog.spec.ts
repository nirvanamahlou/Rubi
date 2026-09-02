import { describe, expect, it } from 'vitest';
import {
  addMoney,
  applyAllocation,
  copyProduct,
  createProduct,
  decimal,
  inventoryTotals,
  reviseProduct,
  resizeInventory,
  transitionProduct,
  utc,
  validateProduct,
  wallTimeToUtc,
  type Inventory,
  type ProductInput,
  type Reference,
  type ReferenceResolver,
} from './catalog';

const now = '2026-08-31T00:00:00.000Z';
const refs: Reference[] = [
  {
    id: 'test-country',
    kind: 'country',
    name: 'Synthetic country',
    active: true,
  },
  {
    id: 'test-city-a',
    kind: 'city',
    name: 'Synthetic city A',
    active: true,
    countryId: 'test-country',
  },
  {
    id: 'test-city-b',
    kind: 'city',
    name: 'Synthetic city B',
    active: true,
    countryId: 'test-country',
  },
  {
    id: 'test-airline',
    kind: 'airline',
    name: 'Synthetic airline',
    active: true,
  },
  {
    id: 'test-aircraft',
    kind: 'aircraft',
    name: 'Synthetic aircraft',
    active: true,
  },
  {
    id: 'test-origin',
    kind: 'airport',
    name: 'Synthetic origin',
    active: true,
  },
  {
    id: 'test-destination',
    kind: 'airport',
    name: 'Synthetic destination',
    active: true,
  },
  {
    id: 'test-class',
    kind: 'flightClass',
    name: 'Synthetic class',
    active: true,
  },
  {
    id: 'test-baggage',
    kind: 'baggage',
    name: 'Synthetic baggage',
    active: true,
  },
  {
    id: 'test-currency',
    kind: 'currency',
    name: 'Synthetic currency',
    code: 'USD',
    active: true,
  },
];
const resolve: ReferenceResolver = (kind, id) =>
  refs.find((ref) => ref.kind === kind && ref.id === id);
function input(): ProductInput {
  return {
    title: 'Synthetic program',
    transport: 'flight',
    journeyRole: 'one-way',
    segments: [
      {
        airlineId: 'test-airline',
        aircraftId: 'test-aircraft',
        flightNumber: 'TEST-1',
        originCountryId: 'test-country',
        destinationCountryId: 'test-country',
        originCityId: 'test-city-a',
        destinationCityId: 'test-city-b',
        originAirportId: 'test-origin',
        destinationAirportId: 'test-destination',
        departureAt: '2026-09-03T22:30:00Z',
        arrivalAt: '2026-09-04T01:00:00Z',
        departureZone: 'Asia/Tehran',
        arrivalZone: 'UTC',
        originTerminal: '',
        destinationTerminal: '',
      },
    ],
    flightClassId: 'test-class',
    baggageId: 'test-baggage',
    supplyType: 'supplier',
    companyOwned: false,
    entryMethod: 'manual',
    totalCapacity: 10,
    rules: 'Synthetic rules',
    fare: {
      purchase: '0.10',
      fee: '0',
      commission: '0',
      currencyId: 'test-currency',
      currencyCode: 'USD',
      validFrom: now,
      validTo: '2026-09-03T22:30:00Z',
    },
  };
}
const inventory: Inventory = { total: 10, version: 0, allocations: [] };
const product = () =>
  createProduct('test-product', input(), resolve, now, 'test-actor');
describe('Decimal money proposal', () => {
  it('adds without float loss and preserves large integers', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.3');
    expect(addMoney('9007199254740993', '0.000001')).toBe(
      '9007199254740993.000001',
    );
    expect(decimal('1.230000')).toBe('1.23');
  });
  it.each([
    '-1',
    '1e3',
    'NaN',
    '',
    ' 1',
    '01',
    '1.',
    '1.0000001',
    '1000000000000000000',
    '۱۰۰',
  ])('rejects malformed amount %s', (value) =>
    expect(() => decimal(value)).toThrow(),
  );
  it('rejects arithmetic overflow', () =>
    expect(() => addMoney('999999999999999999', '1')).toThrow());
});
describe('UTC and wall clock validation', () => {
  it('accepts a ticket definition without schedule or fare validity dates', () => {
    const value = input();
    const unscheduled: ProductInput = {
      ...value,
      segments: [{ ...value.segments[0]!, departureAt: '', arrivalAt: '' }],
      fare: { ...value.fare, validFrom: '', validTo: '' },
    };
    expect(() => validateProduct(unscheduled, resolve, true)).not.toThrow();
    expect(() =>
      createProduct('unscheduled', unscheduled, resolve, now, 'test-actor'),
    ).not.toThrow();
  });
  it('rejects a partially entered schedule instead of requiring dates by default', () => {
    const value = input();
    expect(() =>
      validateProduct(
        {
          ...value,
          segments: [{ ...value.segments[0]!, arrivalAt: '' }],
        },
        resolve,
      ),
    ).toThrow('زمان حرکت و رسیدن باید با هم ثبت یا هر دو خالی باشند');
  });
  it('supports midnight crossings and explicit timezone conversion', () => {
    expect(() => validateProduct(input(), resolve, true)).not.toThrow();
    expect(wallTimeToUtc('2026-09-04T01:30', 'Asia/Tehran', '+03:30')).toBe(
      '2026-09-03T22:00:00.000Z',
    );
  });
  it.each([
    '2026-02-30T00:00:00Z',
    '2026-08-31T24:00:00Z',
    '2026-08-31',
    '2026-08-31T03:30:00+03:30',
  ])('rejects invalid UTC %s', (value) => expect(() => utc(value)).toThrow());
  it('rejects nonexistent DST times and requires the correct offset', () => {
    expect(() =>
      wallTimeToUtc('2026-03-08T02:30', 'America/New_York', '-05:00'),
    ).toThrow();
    expect(() =>
      wallTimeToUtc('2026-09-01T10:00', 'Asia/Tehran', '+00:00'),
    ).toThrow();
    expect(() => wallTimeToUtc('2026-02-30T10:00', 'UTC', '+00:00')).toThrow();
    expect(() =>
      wallTimeToUtc('2026-09-01T10:00', 'Invalid/Zone', '+00:00'),
    ).toThrow();
    expect(
      wallTimeToUtc('2026-11-01T01:30', 'America/New_York', '-04:00'),
    ).not.toBe(wallTimeToUtc('2026-11-01T01:30', 'America/New_York', '-05:00'));
  });
  it('rejects arrival before departure and inconsistent segments', () => {
    const value = input();
    expect(() =>
      validateProduct(
        { ...value, segments: [{ ...value.segments[0]!, arrivalAt: now }] },
        resolve,
      ),
    ).toThrow();
    expect(() =>
      validateProduct(
        { ...value, segments: [value.segments[0]!, value.segments[0]!] },
        resolve,
      ),
    ).toThrow();
  });
  it('supports a contiguous return segment', () => {
    const value = input();
    expect(() =>
      validateProduct(
        {
          ...value,
          segments: [
            value.segments[0]!,
            {
              ...value.segments[0]!,
              originCountryId: value.segments[0]!.destinationCountryId,
              originCityId: value.segments[0]!.destinationCityId,
              originAirportId: 'test-destination',
              destinationCountryId: value.segments[0]!.originCountryId,
              destinationCityId: value.segments[0]!.originCityId,
              destinationAirportId: 'test-origin',
              departureAt: '2026-09-06T10:00:00Z',
              arrivalAt: '2026-09-06T12:00:00Z',
            },
          ],
        },
        resolve,
        true,
      ),
    ).not.toThrow();
  });
});
describe('References and definition rules', () => {
  it('does not infer company ownership from manual entry', () =>
    expect(product().definition.companyOwned).toBe(false));
  it('rejects inconsistent ownership, currency and identical airports', () => {
    expect(() =>
      validateProduct({ ...input(), companyOwned: true }, resolve),
    ).toThrow();
    expect(() =>
      validateProduct(
        { ...input(), fare: { ...input().fare, currencyCode: 'EUR' } },
        resolve,
      ),
    ).toThrow();
    const value = input();
    expect(() =>
      validateProduct(
        {
          ...value,
          segments: [
            { ...value.segments[0]!, destinationAirportId: 'test-origin' },
          ],
        },
        resolve,
      ),
    ).toThrow();
  });
  it('permits missing references in draft, never invalid/inactive selected IDs', () => {
    const value = input();
    const partial = {
      ...value,
      segments: [{ ...value.segments[0]!, aircraftId: '' }],
    };
    expect(() => validateProduct(partial, resolve)).not.toThrow();
    expect(() => validateProduct(partial, resolve, true)).toThrow();
    expect(() => validateProduct(value, () => undefined)).toThrow();
    expect(() =>
      validateProduct(value, (kind, id) => {
        const ref = resolve(kind, id);
        return ref && { ...ref, active: false };
      }),
    ).toThrow();
  });
  it('rejects invalid price validity windows', () => {
    expect(() =>
      validateProduct(
        { ...input(), fare: { ...input().fare, validTo: now } },
        resolve,
      ),
    ).toThrow();
    expect(() =>
      validateProduct(
        {
          ...input(),
          fare: { ...input().fare, validTo: '2027-01-01T00:00:00Z' },
        },
        resolve,
      ),
    ).toThrow();
  });
});
describe('Rail and bus ticket definitions', () => {
  const landRefs: Reference[] = [
    ...refs,
    { id: 'rail-company', kind: 'railCompany', name: 'Rail', active: true },
    { id: 'train-type', kind: 'trainType', name: 'Train', active: true },
    { id: 'bus-company', kind: 'busCompany', name: 'Bus', active: true },
    { id: 'bus-type', kind: 'busType', name: 'Coach', active: true },
  ];
  const landResolve: ReferenceResolver = (kind, id) =>
    landRefs.find((ref) => ref.kind === kind && ref.id === id);
  function land(transport: 'train' | 'bus'): ProductInput {
    const value = input();
    return {
      ...value,
      transport,
      flightClassId: '',
      baggageId: '',
      segments: [
        {
          ...value.segments[0]!,
          airlineId: transport === 'train' ? 'rail-company' : 'bus-company',
          aircraftId: transport === 'train' ? 'train-type' : 'bus-type',
          originAirportId: '',
          destinationAirportId: '',
          originTerminal: transport === 'train' ? 'Station A' : 'Terminal A',
          destinationTerminal:
            transport === 'train' ? 'Station B' : 'Terminal B',
        },
      ],
    };
  }
  it.each(['train', 'bus'] as const)(
    'validates a ready %s ticket through its own Master Data references',
    (transport) =>
      expect(() =>
        validateProduct(land(transport), landResolve, true),
      ).not.toThrow(),
  );
  it('rejects a missing rail company and identical land cities', () => {
    const train = land('train');
    expect(() =>
      validateProduct(
        {
          ...train,
          segments: [{ ...train.segments[0]!, airlineId: '' }],
        },
        landResolve,
        true,
      ),
    ).toThrow();
    expect(() =>
      validateProduct(
        {
          ...train,
          segments: [
            {
              ...train.segments[0]!,
              destinationCityId: train.segments[0]!.originCityId,
            },
          ],
        },
        landResolve,
      ),
    ).toThrow('شهر مبدأ');
  });
});
describe('Inventory reducer (not database concurrency)', () => {
  it('confirms the same allocation without counting it twice', () => {
    const held = applyAllocation(
      inventory,
      { action: 'hold', allocationId: 'a', quantity: 6 },
      0,
    );
    const confirmed = applyAllocation(
      held,
      { action: 'confirm', allocationId: 'a' },
      1,
    );
    expect(inventoryTotals(confirmed)).toEqual({
      total: 10,
      held: 0,
      confirmed: 6,
      remaining: 4,
    });
    expect(inventoryTotals(held).held).toBe(6);
  });
  it('rejects oversell, stale version, duplicate ID and repeated confirm', () => {
    const held = applyAllocation(
      inventory,
      { action: 'hold', allocationId: 'a', quantity: 10 },
      0,
    );
    expect(() =>
      applyAllocation(
        held,
        { action: 'hold', allocationId: 'b', quantity: 1 },
        1,
      ),
    ).toThrow();
    expect(() =>
      applyAllocation(held, { action: 'confirm', allocationId: 'a' }, 0),
    ).toThrow();
    expect(() =>
      applyAllocation(
        held,
        { action: 'hold', allocationId: 'a', quantity: 1 },
        1,
      ),
    ).toThrow();
    const confirmed = applyAllocation(
      held,
      { action: 'confirm', allocationId: 'a' },
      1,
    );
    expect(() =>
      applyAllocation(confirmed, { action: 'confirm', allocationId: 'a' }, 2),
    ).toThrow();
    expect(() =>
      applyAllocation(confirmed, { action: 'release', allocationId: 'a' }, 2),
    ).toThrow();
  });
  it.each([-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid capacity %s',
    (value) => expect(() => resizeInventory(inventory, value, 0)).toThrow(),
  );
  it('releases only held capacity and prevents shrink below allocation', () => {
    const held = applyAllocation(
      inventory,
      { action: 'hold', allocationId: 'a', quantity: 6 },
      0,
    );
    expect(() => resizeInventory(held, 5, 1)).toThrow();
    expect(
      inventoryTotals(
        applyAllocation(held, { action: 'release', allocationId: 'a' }, 1),
      ).remaining,
    ).toBe(10);
    expect(() =>
      inventoryTotals({
        ...inventory,
        allocations: [
          { id: 'a', quantity: 1, state: 'held' },
          { id: 'a', quantity: 1, state: 'confirmed' },
        ],
      }),
    ).toThrow();
  });
});
describe('Versioning and lifecycle', () => {
  it('append-only prices and copy reset identity/history', () => {
    const old = product();
    const next = reviseProduct(
      old,
      { ...input(), fare: { ...input().fare, purchase: '5' } },
      1,
      resolve,
      now,
      'test',
      'new price',
      inventory,
    );
    expect(old.fares).toHaveLength(1);
    expect(next.definitions).toHaveLength(2);
    expect(next.definitions[0]?.definition.fare.purchase).toBe('0.10');
    expect(next.definitions[1]?.definition.fare.purchase).toBe('5');
    expect(next.fares.map((fare) => fare.purchase)).toEqual(['0.10', '5']);
    expect(copyProduct(next, 'test-copy', resolve, now, 'test')).toMatchObject({
      id: 'test-copy',
      version: 1,
      status: 'draft',
    });
    expect(
      copyProduct(next, 'test-copy', resolve, now, 'test').history,
    ).toHaveLength(1);
  });
  it('allows editing every status and prevents restoring cancelled programs', () => {
    const active = transitionProduct(
      product(),
      'active',
      1,
      resolve,
      now,
      'test',
      'activate',
      inventory,
    );
    expect(
      reviseProduct(
        active,
        input(),
        2,
        resolve,
        now,
        'test',
        'edit active',
        inventory,
      ),
    ).toMatchObject({ status: 'active', version: 3 });
    const paused = transitionProduct(
      active,
      'paused',
      2,
      resolve,
      now,
      'test',
      'pause',
      inventory,
    );
    expect(
      reviseProduct(
        paused,
        input(),
        3,
        resolve,
        now,
        'test',
        'edit paused',
        inventory,
      ),
    ).toMatchObject({ status: 'paused', version: 4 });
    const cancelled = transitionProduct(
      paused,
      'cancelled',
      3,
      resolve,
      now,
      'test',
      'cancel',
      inventory,
    );
    expect(
      reviseProduct(
        cancelled,
        input(),
        4,
        resolve,
        now,
        'test',
        'edit cancelled',
        inventory,
      ),
    ).toMatchObject({ status: 'cancelled', version: 5 });
    expect(() =>
      transitionProduct(
        cancelled,
        'active',
        4,
        resolve,
        now,
        'test',
        'restart',
        inventory,
      ),
    ).toThrow();
  });
  it('activates positive capacity even when the purchase fare validity has expired', () => {
    expect(
      transitionProduct(
        product(),
        'active',
        1,
        resolve,
        '2026-09-04T00:00:00.000Z',
        'test',
        'activate after fare validity',
        inventory,
      ),
    ).toMatchObject({ status: 'active', version: 2 });
  });
  it('rejects missing permissions elsewhere, references, stale writes and blank reason here', () => {
    expect(() =>
      transitionProduct(
        product(),
        'active',
        1,
        () => undefined,
        now,
        'test',
        'activate',
        inventory,
      ),
    ).toThrow();
    expect(() =>
      reviseProduct(
        product(),
        input(),
        0,
        resolve,
        now,
        'test',
        'edit',
        inventory,
      ),
    ).toThrow();
    expect(() =>
      transitionProduct(
        product(),
        'cancelled',
        1,
        resolve,
        now,
        'test',
        '',
        inventory,
      ),
    ).toThrow();
  });
  it('guards allocated cancellation/schedule changes and capacity snapshots', () => {
    const held = applyAllocation(
      inventory,
      { action: 'hold', allocationId: 'a', quantity: 2 },
      0,
    );
    expect(() =>
      transitionProduct(
        product(),
        'cancelled',
        1,
        resolve,
        now,
        'test',
        'cancel',
        held,
      ),
    ).toThrow();
    expect(() =>
      reviseProduct(
        product(),
        { ...input(), rules: 'changed rules' },
        1,
        resolve,
        now,
        'test',
        'edit',
        held,
      ),
    ).toThrow();
    expect(() =>
      reviseProduct(product(), input(), 1, resolve, now, 'test', 'edit', {
        ...inventory,
        total: 9,
      }),
    ).toThrow();
  });
});

describe('Sales-owned pricing and geography', () => {
  it('accepts purchase-only fares and rejects a legacy fixed sale price', () => {
    expect(() => validateProduct(input(), resolve)).not.toThrow();
    const legacy = { ...input(), fare: { ...input().fare, sale: '123' } };
    expect(() => validateProduct(legacy, resolve)).toThrow('قیمت فروش');
  });
  it('rejects a city outside its selected country even in a draft', () => {
    const value = input();
    const foreign: Reference = {
      id: 'foreign-country',
      kind: 'country',
      name: 'Synthetic foreign country',
      active: true,
    };
    const resolver: ReferenceResolver = (kind, id) =>
      kind === 'country' && id === foreign.id ? foreign : resolve(kind, id);
    expect(() =>
      validateProduct(
        {
          ...value,
          segments: [{ ...value.segments[0]!, originCountryId: foreign.id }],
        },
        resolver,
      ),
    ).toThrow('شهر باید');
  });
  it('does not use country/city selection as a substitute for missing airports', () => {
    const value = input();
    expect(() =>
      validateProduct(
        {
          ...value,
          segments: [{ ...value.segments[0]!, originAirportId: '' }],
        },
        resolve,
        true,
      ),
    ).toThrow();
  });
});
