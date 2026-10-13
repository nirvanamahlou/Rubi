import { describe, expect, it, vi } from 'vitest';
import { readTicketDocumentFacts } from './document-details';
const flight = {
  offerId: 'offer-1',
  originId: 'teh',
  destinationId: 'ayt',
  cabinClassCode: 'ECONOMY',
};
const details = {
  id: 'offer-1',
  originId: 'teh',
  destinationId: 'ayt',
  originAirportId: 'ika',
  destinationAirportId: 'ayt-airport',
  economyBaggageKg: '20.5',
  businessBaggageKg: '30',
};
const get = (patch = {}) =>
  vi.fn(async (path: string) =>
    Response.json({
      data: path.includes('document-details')
        ? { ...details, ...patch }
        : {
            code: path.includes('/ika') ? 'IKA' : 'AYT',
            name: 'Airport',
            attributes: {
              englishName: path.includes('/ika')
                ? 'Imam Khomeini International Airport'
                : 'Antalya Airport',
              cityId: path.includes('/ika') ? 'teh' : 'ayt',
            },
          },
    }),
  );
describe('saved ticket document facts', () => {
  it('reads selected airports and the correct class baggage without replacing saved route facts', async () => {
    const before = { ...flight };
    const facts = await readTicketDocumentFacts([flight], get());
    expect(facts['offer-1']).toEqual({
      originAirport: {
        code: 'IKA',
        name: 'Imam Khomeini International Airport',
      },
      destinationAirport: { code: 'AYT', name: 'Antalya Airport' },
      baggageKg: '20.5',
    });
    expect(flight).toEqual(before);
    expect(
      (
        await readTicketDocumentFacts(
          [{ ...flight, cabinClassCode: 'BUSINESS' }],
          get(),
        )
      )['offer-1']?.baggageKg,
    ).toBe('30');
    expect(
      (
        await readTicketDocumentFacts(
          [{ ...flight, businessOutput: true }],
          get(),
        )
      )['offer-1']?.baggageKg,
    ).toBe('30');
  });
  it('does not use another offer, changed route or unrelated airport to fill missing facts', async () => {
    expect(
      await readTicketDocumentFacts([flight], get({ id: 'other' })),
    ).toEqual({});
    expect(
      await readTicketDocumentFacts([flight], get({ originId: 'different' })),
    ).toEqual({});
    const source = vi.fn(async (path: string) =>
      Response.json({
        data: path.includes('document-details')
          ? details
          : { code: 'XYZ', name: 'Wrong', attributes: { cityId: 'other' } },
      }),
    );
    expect(
      (await readTicketDocumentFacts([flight], source))['offer-1']
        ?.originAirport,
    ).toBeUndefined();
  });
  it('does not guess missing legacy airport or first-class allowances', async () => {
    const facts = await readTicketDocumentFacts(
      [{ ...flight, cabinClassCode: 'FIRST' }],
      get({ originAirportId: null, destinationAirportId: null }),
    );
    expect(facts['offer-1']).toEqual({
      originAirport: undefined,
      destinationAirport: undefined,
      baggageKg: null,
    });
    expect(
      await readTicketDocumentFacts(
        [flight],
        async () => new Response('{}', { status: 403 }),
      ),
    ).toEqual({});
  });
});
