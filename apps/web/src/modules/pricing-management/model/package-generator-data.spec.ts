import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { packageGeneratorData } from './package-generator-data';
import type {
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  PackageTourPublicationV1,
} from '@nora/contracts';

type BridgeData = {
  cards: Record<string, { label: string; value: string; unit: string }>;
  priceKeys: string[];
  groups: { prices: Record<string, unknown> }[];
};
type Bridge = {
  normalize: (data: unknown) => BridgeData;
  connect: (apply: (data: BridgeData) => void) => void;
};
const grid = {
  tour: {
    package: { name: 'Tour' },
    startsOn: '2026-10-01',
    endsOn: '2026-10-03',
  },
  nights: 2,
} as PackageTourCostGridV1;
const batch = {
  rows: [
    { id: 'yes', hotelName: 'Selected Hotel' },
    { id: 'no', hotelName: 'Unchecked Hotel' },
  ],
} as unknown as PackageTourHotelPurchaseBatchV1;
const publication = {
  id: 'publication',
  selectedHotelRateIds: ['yes'],
  roomPrices: ['single', 'double', 'doubleChild'].map((roomCode) => ({
    hotelRateId: 'yes',
    roomCode,
    roomTypeName: 'Standard',
    board: 'BB',
    hotelPurchase: 'secret-cost',
    netProfit: 'secret-profit',
    currencyAmounts: [
      { currencyCode: 'IRR', sale: '9007199254740993' },
      { currencyCode: 'USD', sale: '123.45' },
    ],
  })),
} as unknown as PackageTourPublicationV1;
describe('published package generator transfer', () => {
  it('includes checked hotels and exact per-person sale prices, excluding costs and profit', () => {
    const data = packageGeneratorData(grid, batch, publication);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.prices.child!.parts[0]?.amount).toBe(
      '9007199254740993',
    );
    const json = JSON.stringify(data);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('Unchecked');
    expect(json).not.toContain('profit');
    expect(json).not.toContain('purchase');
  });
  it('requires complete prices and existing selected hotel rows', () => {
    expect(() =>
      packageGeneratorData(grid, batch, { ...publication, roomPrices: [] }),
    ).toThrow();
    expect(() =>
      packageGeneratorData(grid, batch, {
        ...publication,
        selectedHotelRateIds: ['missing'],
      }),
    ).toThrow();
  });
  it('accepts only messages from the same-origin parent, strips extra properties and imports once per publication', () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const parent = { postMessage: vi.fn() },
      apply = vi.fn();
    const window: {
      parent?: typeof parent;
      location?: { origin: string };
      addEventListener?: (name: string, fn: (event: unknown) => void) => void;
      PackagePricingBridge?: Bridge;
    } = {
      parent,
      location: { origin: 'http://localhost:3100' },
      addEventListener: (name: string, fn: (event: unknown) => void) =>
        (listeners[name] = fn),
    };
    runInNewContext(
      readFileSync(
        resolve('public/package-generator/pricing-bridge.js'),
        'utf8',
      ),
      { window, console },
    );
    window.PackagePricingBridge!.connect(apply);
    const data = packageGeneratorData(grid, batch, publication);
    const event = {
      source: parent,
      origin: window.location!.origin,
      data: {
        type: 'rubi-package-pricing',
        data: { ...data, token: 'secret', purchase: 'secret' },
      },
    };
    listeners.message!({ ...event, origin: 'https://evil.example' });
    listeners.message!({ ...event, source: {} });
    expect(apply).not.toHaveBeenCalled();
    listeners.message!(event);
    listeners.message!(event);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(apply.mock.calls[0])).not.toContain('secret');
    expect(apply.mock.calls[0]![0].priceKeys).toEqual([
      'double',
      'single',
      'child',
    ]);
    listeners.load!({});
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: 'rubi-package-pricing-ready' },
      window.location!.origin,
    );
  });
  it('rejects invalid amounts and displays large multi-currency amounts without floating-point conversion', () => {
    const window: { PackagePricingBridge?: Bridge } = {};
    runInNewContext(
      readFileSync(
        resolve('public/package-generator/pricing-bridge.js'),
        'utf8',
      ),
      { window },
    );
    const data = packageGeneratorData(grid, batch, publication);
    const normalized = window.PackagePricingBridge!.normalize(data);
    const source = readFileSync(
      resolve('public/package-generator/app.js'),
      'utf8',
    );
    const fn = source.slice(
      source.indexOf('function priceText(c){'),
      source.indexOf('function moneyText(v)'),
    );
    const context: { priceText?: (value: unknown) => string } = {};
    runInNewContext(fn, context);
    expect(context.priceText!(normalized.groups[0]!.prices.double)).toBe(
      '9,007,199,254,740,993 IRR + 123.45 USD',
    );
    data.groups[0]!.prices.double!.parts[0]!.amount = '-1';
    expect(() => window.PackagePricingBridge!.normalize(data)).toThrow();
  });
});

it('hands off separate selected room types and exact one/two adult prices to the banner bridge without a fabricated child price', () => {
  const code = (roomTypeId: string, adults: number) =>
    JSON.stringify([2, roomTypeId, adults, [], 'BB']);
  const current = {
    ...publication,
    roomPrices: [
      {
        ...publication.roomPrices[0]!,
        roomCode: code('standard', 1),
        roomTypeName: 'Standard',
        currencyAmounts: [
          {
            currencyCode: 'EUR',
            sale: '100.00',
            purchase: 'secret',
            commission: '0',
            profit: 'secret',
          },
        ],
      },
      {
        ...publication.roomPrices[0]!,
        roomCode: code('standard', 2),
        roomTypeName: 'Standard',
        currencyAmounts: [
          {
            currencyCode: 'EUR',
            sale: '180.00',
            purchase: 'secret',
            commission: '0',
            profit: 'secret',
          },
        ],
      },
      {
        ...publication.roomPrices[0]!,
        roomCode: code('deluxe', 2),
        roomTypeName: 'Deluxe',
        currencyAmounts: [
          {
            currencyCode: 'EUR',
            sale: '300.00',
            purchase: 'secret',
            commission: '0',
            profit: 'secret',
          },
        ],
      },
    ],
  } as PackageTourPublicationV1;
  const data = packageGeneratorData(
    {
      ...grid,
      destinationName: 'آنتالیا',
      tour: {
        ...grid.tour,
        package: {
          ...grid.tour.package,
          details: { version: 1, description: 'Published services' },
        },
      },
    },
    batch,
    current,
  );
  expect(data.title).toBe('آنتالیا');
  expect('template' in data && data.template).toBe('antalya');
  expect(data.groups).toHaveLength(2);
  expect(data.groups[0]?.prices.double?.parts[0]?.amount).toBe('90.00');
  expect(data.groups[1]?.prices.double?.parts[0]?.amount).toBe('150.00');
  const window: { PackagePricingBridge?: Bridge } = {};
  runInNewContext(
    readFileSync(resolve('public/package-generator/pricing-bridge.js'), 'utf8'),
    { window, console },
  );
  const normalized = window.PackagePricingBridge!.normalize(data);
  expect(Array.from(normalized.priceKeys)).toEqual(['double', 'single']);
  expect(JSON.stringify(normalized)).not.toContain('secret');
  expect(JSON.stringify(normalized.groups)).not.toContain('child');
});

it('round trips published footer fields separately, without adding them to hotel prices', () => {
  const fields = [
    {
      id: 'adultFlight',
      title: 'قیمت پرواز',
      kind: 'adultFlight' as const,
      amount: '9007199254740993',
      currencyCode: 'IRR',
      mode: 'fixed' as const,
    },
    {
      id: 'childFlight',
      title: 'پرواز کودک',
      kind: 'childFlight' as const,
      amount: '50.25',
      currencyCode: 'EUR',
      mode: 'fixed' as const,
    },
    {
      id: 'business',
      title: 'افزایش بیزینس',
      kind: 'business' as const,
      amount: '100',
      currencyCode: 'USD',
      mode: 'fixed' as const,
    },
    {
      id: 'commission',
      title: 'کمیسیون',
      kind: 'commission' as const,
      amount: '7.5',
      currencyCode: 'IRR',
      mode: 'percent' as const,
    },
    {
      id: 'custom',
      title: 'خدمات ویژه',
      kind: 'custom' as const,
      amount: '25',
      currencyCode: 'AED',
      mode: 'fixed' as const,
    },
  ];
  const window: { PackagePricingBridge?: Bridge } = {};
  runInNewContext(
    readFileSync(resolve('public/package-generator/pricing-bridge.js'), 'utf8'),
    { window, console },
  );
  const data = packageGeneratorData(grid, batch, {
    ...publication,
    priceFields: fields,
  });
  const normalized = window.PackagePricingBridge!.normalize(data);
  expect(normalized.cards.adult).toEqual({
    label: 'قیمت پرواز',
    value: '9007199254740993',
    unit: 'ریال',
  });
  expect(normalized.cards.childFlight?.unit).toBe('€');
  expect(normalized.cards.business?.unit).toBe('$');
  expect(normalized.cards.commission).toEqual({
    label: 'کمیسیون',
    value: '7.5',
    unit: '٪',
  });
  expect(normalized.cards.source_card_custom?.unit).toBe('AED');
  expect(normalized.groups).toEqual(
    window.PackagePricingBridge!.normalize(
      packageGeneratorData(grid, batch, { ...publication, priceFields: [] }),
    ).groups,
  );
  const withoutBusiness = window.PackagePricingBridge!.normalize({
    ...data,
    priceFields: fields.filter((f) => f.kind !== 'business'),
  });
  expect(withoutBusiness.cards.business).toBeUndefined();
  const fixed = window.PackagePricingBridge!.normalize({
    ...data,
    priceFields: [{ ...fields[3], mode: 'fixed', amount: '120000' }],
  });
  expect(fixed.cards.commission?.unit).toBe('ریال');
  expect(() =>
    window.PackagePricingBridge!.normalize({
      ...data,
      priceFields: [{ ...fields[3], amount: '101' }],
    }),
  ).toThrow();
});
