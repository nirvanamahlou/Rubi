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
