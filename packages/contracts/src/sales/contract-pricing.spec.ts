import { describe, expect, it } from 'vitest';
import { servicePriceComponents } from './pricing';
import type { SalesServiceInput } from './index';

const service = (
  metadata: SalesServiceInput['metadata'],
): SalesServiceInput => ({
  clientKey: 'hotel',
  kind: 'HOTEL',
  titleSnapshot: 'Hotel',
  ...(metadata ? { metadata } : {}),
});
describe('contract total pricing opt-in', () => {
  it('keeps legacy records on the existing path', () => {
    expect(servicePriceComponents([service(undefined)])).toBeNull();
    expect(
      servicePriceComponents([service({ contractPackagePricingVersion: 1 })]),
    ).toBeNull();
  });
  it('rejects partial markers, unsupported versions and mixed service pricing', () => {
    expect(() =>
      servicePriceComponents([
        service({ contractPackagePricingVersion: 1 }),
        { ...service(undefined), clientKey: 'other' },
      ]),
    ).toThrow();
    expect(() =>
      servicePriceComponents([service({ contractPackagePricingVersion: 2 })]),
    ).toThrow();
    expect(() =>
      servicePriceComponents([
        { ...service({ contractPackagePricingVersion: 1 }), pricing: [] },
      ]),
    ).toThrow();
    expect(() =>
      servicePriceComponents([
        service({
          contractPackagePricingVersion: 1,
          passengerPackagePricingVersion: 1,
        }),
      ]),
    ).toThrow();
  });
});
