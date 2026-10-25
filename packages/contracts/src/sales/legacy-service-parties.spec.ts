import { describe, it, expect } from 'vitest';
import { readLegacyServiceParties } from './legacy-service-parties';
const services = [
  {
    clientKey: 'flight-outbound',
    kind: 'FLIGHT' as const,
    metadata: {
      legacyServicePartiesV2: JSON.stringify({
        'flight-outbound': { adults: 2, children: 1, infants: 1 },
      }),
    },
  },
];
describe('historical service party contract', () => {
  it('retains explicit age counts without person identities', () =>
    expect(readLegacyServiceParties(services)).toEqual({
      'flight-outbound': { adults: 2, children: 1, infants: 1 },
    }));
  it('does not change ordinary or customer-only V1 contracts', () => {
    expect(
      readLegacyServiceParties([
        {
          clientKey: 'legacy-contract',
          kind: 'OTHER',
          metadata: { legacyContractV1: true },
        },
      ]),
    ).toBeNull();
  });
  it.each([
    {},
    { 'flight-outbound': { adults: -1, children: 0, infants: 0 } },
    { 'flight-outbound': { adults: 1, children: 0.5, infants: 0 } },
    { 'flight-outbound': { adults: 0, children: 0, infants: 1 } },
    { 'flight-outbound': { adults: 1, children: 0, infants: 0, extra: true } },
  ])('rejects incomplete or invalid aggregate parties', (party) => {
    expect(() =>
      readLegacyServiceParties([
        {
          ...services[0]!,
          metadata: { legacyServicePartiesV2: JSON.stringify(party) },
        },
      ]),
    ).toThrow();
  });
});
