import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { SiteCommerceService } from './site-commerce.service';
// Dependencies are injected below; unit publication tests must not start the application graph.
vi.mock('../sales/sales.service', () => ({ SalesService: class {} }));
vi.mock('../sales/sales-output.service', () => ({
  SalesOutputService: class {},
}));
vi.mock('../reservations/travel-workflow.service', () => ({
  TravelWorkflowService: class {},
}));
vi.mock('../reservations/reservation-ticket-documents', () => ({
  ReservationTicketDocumentsService: class {},
}));
vi.mock('../finance/document-delivery/finance-delivery.module', () => ({
  FinanceDeliveryService: class {},
}));
vi.mock('../ticket-catalog/ticket-public.service', () => ({
  TicketPublicService: class {},
}));
vi.mock('../ticket-catalog/tour-public.service', () => ({
  TourPublicService: class {},
}));
vi.mock('../master-data/master-data.service', () => ({
  MasterDataService: class {},
}));
vi.mock('../package-pricing/package-tour-pricing.service', () => ({
  PackageTourPricingService: class {},
}));
vi.mock('../package-pricing/floating-tour-pricing.service', () => ({
  FloatingTourPricingService: class {},
}));
vi.mock('../documents/documents.service', () => ({
  DocumentsService: class {},
}));
const actor = {
  branchIds: ['branch-a'],
  permissions: ['ticket_catalog.manage'],
} as AuthenticatedActor;
function setup() {
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({
      nss: { branchId: 'branch-a' },
      'jahan-bastan': { branchId: 'branch-a', userId: 'jahan-service' },
      ghestiroo: { branchId: 'branch-a', userId: 'ghestiroo-service' },
    }),
  );
  const publication = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async ({ data }) => ({
      id: 'saved',
      version: 1,
      ...data,
    })),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const db = {
    client: {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'resource' }]),
      $transaction: <T>(callback: (tx: unknown) => T): T => callback(db.client),
      websitePublication: publication,
      websiteOrder: { findMany: vi.fn().mockResolvedValue([]) },
      websiteCatalogDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          branchId: 'branch-a',
          salePriceTargetId: 'target',
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  };
  const tickets = {
    documentSupply: vi.fn().mockResolvedValue({}),
    websiteOffer: vi.fn().mockResolvedValue({}),
  };
  const tours = {
    pricingDeparture: vi.fn().mockResolvedValue({
      startsOn: '2029-11-20',
      endsOn: '2029-11-27',
      package: { hotelIds: [] },
    }),
  };
  const floating = {
    websiteProduct: vi.fn().mockResolvedValue({
      package: { id: 'floating', name: 'Floating', details: { version: 1 } },
      version: 2,
      dated: [
        {
          startsOn: '2090-11-20',
          nights: 7,
          stays: [],
          prices: { double: [{ currency: 'EUR', amount: '300' }] },
        },
      ],
      monthly: null,
    }),
  };
  const references = {
    detail: vi.fn(),
    publishedHotelProfiles: vi.fn().mockResolvedValue([]),
    withProfilePublication: <T>(_record: unknown, callback: () => T): T =>
      callback(),
  };
  const logos = { preview: vi.fn() };
  const service = new SiteCommerceService(
    db as never,
    tickets as never,
    tours as never,
    {
      websitePublicationCandidates: vi
        .fn()
        .mockResolvedValue({ data: ['tour-a', 'id'] }),
    } as never,
    { cancelledWebsiteContracts: vi.fn().mockResolvedValue([]) } as never,
    {} as never,
    references as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    floating as never,
    undefined,
    undefined,
    logos as never,
  );
  return { service, publication, tickets, tours, floating, references, logos };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('site profile publication', () => {
  const publisher = {
    ...actor,
    permissions: [
      'ticket_catalog.manage',
      'master_data.read',
      'master_data.update',
    ],
  } as AuthenticatedActor;
  const secret = 'ghestiroo-profile-test-key-32-bytes';

  it('signs Ghestiroo hotel profiles with their country code and preserves the Jahan payload', async () => {
    const f = setup();
    vi.stubEnv('GHESTIROO_CATALOG_WEBHOOK_SECRET', secret);
    vi.stubEnv(
      'JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET',
      'jahan-profile-test-key-32-bytes-01',
    );
    f.references.detail.mockImplementation(async (kind: string) =>
      kind === 'hotels'
        ? {
            data: {
              name: 'Hotel',
              attributes: {
                identificationCode: 'HTL-AYT-01',
                countryId: 'country',
                countryName: 'Turkey',
                cityName: 'Antalya',
                starRating: 5,
              },
            },
          }
        : { data: { attributes: { iso2Code: 'tr' } } },
    );
    const fetcher = vi.fn(async () =>
      Response.json({
        identificationCode: 'HTL-AYT-01',
        slug: 'hotel-page',
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      f.service.publishHotelProfile('ghestiroo', 'hotel', publisher),
    ).resolves.toEqual({
      url: 'https://ghestiroo.ir/hotels/hotel-page/',
    });
    await expect(
      f.service.publishHotelProfile('jahan-bastan', 'hotel', publisher),
    ).resolves.toEqual({
      url: 'https://jahanbastan.ir/hotels/hotel-page/',
    });
    const [url, request] = fetcher.mock.calls[0] as unknown as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe('https://ghestiroo.ir/api/v1/erp/hotel-profile');
    expect(JSON.parse(request.body)).toMatchObject({
      site: 'ghestiroo',
      countryCode: 'TR',
    });
    expect(request.headers['x-erp-signature']).toBe(
      createHmac('sha256', secret)
        .update(request.headers['x-erp-timestamp'] + '.' + request.body)
        .digest('hex'),
    );
    const [, jahan] = fetcher.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(jahan.body)).not.toHaveProperty('countryCode');
  });

  it('sends stable destination identifiers and English aliases to Niayesh', async () => {
    const f = setup();
    vi.stubEnv('NSS_CATALOG_WEBHOOK_SECRET', secret);
    f.references.detail
      .mockResolvedValueOnce({
        data: {
          name: 'هتل نمونه',
          attributes: {
            identificationCode: 'HTL-AYT-001',
            cityId: 'city-id',
            countryId: 'country-id',
            cityName: 'آنتالیا',
            countryName: 'ترکیه',
          },
        },
      })
      .mockResolvedValueOnce({
        data: { id: 'city-id', attributes: { englishName: 'Antalya' } },
      })
      .mockResolvedValueOnce({
        data: { id: 'country-id', attributes: { englishName: 'Turkey' } },
      });
    const fetcher = vi.fn(async (_url: string, request: RequestInit) => {
      expect(JSON.parse(String(request.body))).toMatchObject({
        cityId: 'city-id',
        countryId: 'country-id',
        cityEnglishName: 'Antalya',
        countryEnglishName: 'Turkey',
        cityName: 'آنتالیا',
        countryName: 'ترکیه',
      });
      return Response.json({
        identificationCode: 'HTL-AYT-001',
        slug: 'hotel-page',
      });
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(
      f.service.publishHotelProfile('nss', 'hotel', {
        ...actor,
        permissions: [...actor.permissions, 'master_data.read'],
      }),
    ).resolves.toEqual({ url: 'https://niyayeshseir.ir/hotels/hotel-page/' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('publishes flag and city country codes only from an authorized branch', async () => {
    const f = setup();
    vi.stubEnv('GHESTIROO_CATALOG_WEBHOOK_SECRET', secret);
    f.references.detail
      .mockResolvedValueOnce({
        data: {
          name: 'Turkey',
          attributes: { iso2Code: 'TR', logoFileReference: 'flag' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          name: 'Antalya',
          attributes: { countryName: 'Turkey', countryCode: 'TR' },
        },
      });
    f.logos.preview.mockResolvedValue({
      stream: Readable.from([
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>',
        ),
      ]),
    });
    const fetcher = vi.fn(async (_url: string, request: RequestInit) => {
      const value = JSON.parse(String(request.body));
      expect(value.countryCode).toBe('TR');
      expect(value.site).toBe('ghestiroo');
      if (value.kind === 'countries')
        expect(Buffer.from(value.flag, 'base64').toString('ascii', 8, 12)).toBe(
          'WEBP',
        );
      else expect(value.countryName).toBe('Turkey');
      return Response.json({ slug: 'destination' });
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(
      f.service.publishGeography('ghestiroo', 'cities', 'city', {
        ...publisher,
        branchIds: ['other'],
      }),
    ).rejects.toThrow();
    await expect(
      f.service.publishGeography(
        'ghestiroo',
        'countries',
        'country',
        publisher,
      ),
    ).resolves.toEqual({
      url: 'https://ghestiroo.ir/destinations/',
    });
    await f.service.publishGeography('ghestiroo', 'cities', 'city', publisher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['MA', 'مالزی', 'MY'],
    ['SL', 'Slovenia', 'SI'],
    ['MA', 'Morocco', 'MA'],
    ['SL', 'Sierra Leone', 'SL'],
  ])(
    'maps the Ghestiroo country code %s for %s to %s',
    async (code, name, expected) => {
      const f = setup();
      vi.stubEnv('GHESTIROO_CATALOG_WEBHOOK_SECRET', secret);
      f.references.detail
        .mockResolvedValueOnce({
          data: {
            name: 'Hotel',
            attributes: { identificationCode: 'HTL-01', countryId: 'country' },
          },
        })
        .mockResolvedValueOnce({
          data: { name, attributes: { iso2Code: code } },
        })
        .mockResolvedValueOnce({
          data: {
            name: 'City',
            attributes: { countryName: name, countryCode: code },
          },
        })
        .mockResolvedValueOnce({
          data: { name, attributes: { iso2Code: code } },
        });
      const fetcher = vi.fn(async (_url: string, request: RequestInit) => {
        expect(JSON.parse(String(request.body)).countryCode).toBe(expected);
        return Response.json({
          identificationCode: 'HTL-01',
          slug: 'destination',
        });
      });
      vi.stubGlobal('fetch', fetcher);
      await f.service.publishHotelProfile('ghestiroo', 'hotel', publisher);
      await f.service.publishGeography(
        'ghestiroo',
        'cities',
        'city',
        publisher,
      );
      await f.service.publishGeography(
        'ghestiroo',
        'countries',
        'country',
        publisher,
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );
});

describe('website destination management', () => {
  it('requires an explicit destination action to authorize each Ghestiroo tour', async () => {
    const f = setup();
    const row = {
      id: 'legacy',
      kind: 'tour',
      resourceId: 'tour-a',
      version: 1,
      enabled: true,
      presentation: null,
    };
    f.publication.findMany.mockResolvedValueOnce([row]);
    const siteActor = { ...actor, userId: 'ghestiroo-service' };
    await expect(
      f.service.catalog('ghestiroo', siteActor, true),
    ).resolves.toMatchObject({
      data: [{ id: 'legacy', kind: 'tour', enabled: false }],
    });
    const result = await f.service.publish(
      'ghestiroo',
      'tour',
      'tour-a',
      {
        enabled: true,
        version: 0,
        branchId: 'branch-a',
        presentation: {
          title: 'Tour',
          description: '',
          commissionPercent: '0',
          previewOnly: true,
          publishHotelProfiles: true,
        },
      },
      actor,
    );
    expect(result.data).toMatchObject({
      siteCode: 'ghestiroo',
      resourceId: 'tour-a',
      enabled: true,
      salesStopped: true,
      presentation: {
        previewOnly: true,
        publishHotelProfiles: true,
        operatorApproved: true,
      },
    });
    expect(f.publication.create).toHaveBeenCalledTimes(1);
  });
  it('publishes a priced ticket only to Ghestiroo', async () => {
    const f = setup();
    const result = await f.service.publish(
      'ghestiroo',
      'ticket',
      'flight-a',
      { enabled: true, version: 0, branchId: 'branch-a' },
      actor,
    );
    expect(f.tickets.websiteOffer).toHaveBeenCalledWith(
      'flight-a',
      ['branch-a'],
      'target',
    );
    expect(result.data).toMatchObject({
      siteCode: 'ghestiroo',
      branchId: 'branch-a',
      resourceId: 'flight-a',
      enabled: true,
    });
    expect(f.publication.create).toHaveBeenCalledTimes(1);
    const siteActor = { ...actor, userId: 'ghestiroo-service' };
    await expect(
      f.service.catalog('ghestiroo', siteActor),
    ).resolves.toMatchObject({ version: 1, data: [] });
    expect(f.publication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          siteCode: 'ghestiroo',
          branchId: 'branch-a',
          kind: { in: ['ticket', 'tour'] },
        },
      }),
    );
    await expect(
      f.service.catalog('jahan-bastan', siteActor),
    ).rejects.toThrow();
  });

  it('publishes each floating period independently without requiring an inventory departure', async () => {
    const f = setup();
    for (const periodKey of ['dated:2090-11-20:7', 'dated:2090-11-27:7']) {
      const result = await f.service.publish(
        'nss',
        'floating-tour',
        'floating',
        { enabled: true, version: 0, branchId: 'branch-a', periodKey },
        actor,
      );
      expect(result.data).toMatchObject({
        kind: 'floating-tour',
        resourceId: 'floating',
        periodKey,
      });
      expect(f.floating.websiteProduct).toHaveBeenCalledWith(
        'floating',
        ['branch-a'],
        periodKey,
        true,
      );
    }
    expect(f.tours.pricingDeparture).not.toHaveBeenCalled();
    expect(f.publication.create).toHaveBeenCalledTimes(2);
    await expect(
      f.service.publish(
        'nss',
        'floating-tour',
        'floating',
        { enabled: true, version: 0 },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      f.service.publish(
        'nss',
        'tour',
        'id',
        { enabled: true, version: 0, periodKey: 'dated:2026-11-20:7' },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('exports the selected floating sales period and tombstones a removed period', async () => {
    const f = setup();
    const row = {
      id: 'publication',
      resourceId: 'floating',
      kind: 'floating-tour',
      enabled: true,
      version: 1,
      periodKey: 'dated:2090-11-20:7',
    };
    f.publication.findMany.mockResolvedValue([row] as never);
    const siteActor = { ...actor, userId: 'site' };
    vi.stubEnv(
      'SITE_COMMERCE_BINDINGS',
      JSON.stringify({ nss: { branchId: 'branch-a', userId: 'site' } }),
    );
    expect((await f.service.catalog('nss', siteActor)).data).toEqual([]);
    const result = await f.service.catalog('nss', siteActor, true);
    expect(result.data[0]).toMatchObject({
      kind: 'floating-tour',
      periodKey: row.periodKey,
      enabled: true,
      floatingTour: { version: 2 },
      previewOnly: true,
      salesStopped: true,
    });
    expect(result.data[0]).not.toHaveProperty('tour');
    const { BadRequestException } = await import('@nestjs/common');
    f.floating.websiteProduct.mockRejectedValueOnce(
      new BadRequestException('removed'),
    );
    expect(
      (await f.service.catalog('nss', siteActor, true)).data[0],
    ).toMatchObject({
      enabled: false,
      periodKey: row.periodKey,
    });
  });
  it.each(['nss', 'jahan-bastan', 'ghestiroo'])(
    'requires explicit confirmation for past floating departures on %s',
    async (site) => {
      const f = setup();
      f.floating.websiteProduct
        .mockResolvedValueOnce({
          dated: [{ startsOn: '2020-01-01' }],
        } as never)
        .mockResolvedValueOnce({
          dated: [{ startsOn: '2020-01-01' }],
        } as never);
      const input = {
        enabled: true,
        version: 0,
        branchId: 'branch-a',
        periodKey: 'dated:2020-01-01:7',
      };
      await expect(
        f.service.publish(site, 'floating-tour', 'resource', input, actor),
      ).rejects.toMatchObject({
        response: { code: 'PAST_TOUR_PUBLICATION_CONFIRMATION' },
      });
      expect(f.publication.create).not.toHaveBeenCalled();
      await expect(
        f.service.publish(
          site,
          'floating-tour',
          'resource',
          { ...input, confirmPastDeparture: true },
          actor,
        ),
      ).resolves.toMatchObject({
        data: {
          siteCode: site,
          enabled: true,
          presentation: { pastDepartureDate: '2020-01-01' },
        },
      });
    },
  );
  it('retains disconnected destinations per resource and branch without dispatching', async () => {
    const f = setup();
    const result = await f.service.publish(
      'jahan-bastan',
      'tour',
      'tour-a',
      { enabled: true, version: 0, branchId: 'branch-a' },
      actor,
    );
    expect(result.data).toMatchObject({
      siteCode: 'jahan-bastan',
      branchId: 'branch-a',
      resourceId: 'tour-a',
      enabled: true,
    });
    expect(f.tours.pricingDeparture).toHaveBeenCalledWith('tour-a', [
      'branch-a',
    ]);
  });
  it('preserves existing Niayesh binding and target-price validation', async () => {
    const f = setup();
    await f.service.publish(
      'nss',
      'ticket',
      'ticket-a',
      { enabled: true, version: 0 },
      actor,
    );
    expect(f.tickets.websiteOffer).toHaveBeenCalledWith(
      'ticket-a',
      ['branch-a'],
      'target',
    );
  });
  it('validates future-site ticket eligibility without using the Niayesh price target', async () => {
    const f = setup();
    await f.service.publish(
      'jahan-academy',
      'ticket',
      'ticket-a',
      { enabled: true, version: 0, branchId: 'branch-a' },
      actor,
    );
    expect(f.tickets.websiteOffer).toHaveBeenCalledWith(
      'ticket-a',
      ['branch-a'],
      undefined,
    );
  });
  it.each(['other', '__proto__'])('rejects unknown site %s', async (site) => {
    const f = setup();
    await expect(
      f.service.publication(site, 'tour', 'id', actor, 'branch-a'),
    ).rejects.toThrow();
    expect(f.publication.findFirst).not.toHaveBeenCalled();
  });
  it('rejects unauthorized branches and missing manage permission', async () => {
    const f = setup();
    for (const who of [actor, { ...actor, permissions: [] }])
      await expect(
        f.service.publish(
          'jahan-academy',
          'tour',
          'id',
          { enabled: true, version: 0, branchId: 'branch-b' },
          who,
        ),
      ).rejects.toThrow();
    await expect(
      f.service.publish(
        'nss',
        'tour',
        'id',
        { enabled: true, version: 0, branchId: 'branch-a' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow();
    expect(f.publication.create).not.toHaveBeenCalled();
  });
  it('does not allow changing a bound site branch even if actor has both branches', async () => {
    const f = setup();
    await expect(
      f.service.publication(
        'nss',
        'tour',
        'id',
        { ...actor, branchIds: ['branch-a', 'branch-b'] },
        'branch-b',
      ),
    ).rejects.toThrow();
  });
  it('preserves version conflict protection', async () => {
    const f = setup();
    f.publication.findUnique.mockResolvedValue({ version: 4 } as never);
    await expect(
      f.service.publish(
        'jahan-bastan',
        'tour',
        'id',
        { enabled: false, version: 3, branchId: 'branch-a' },
        actor,
      ),
    ).rejects.toThrow();
    expect(f.publication.create).not.toHaveBeenCalled();
  });
  it('does not expose disconnected-site catalogues through an unbound reader', async () => {
    const f = setup();
    await expect(f.service.catalog('jahan-bastan', actor)).rejects.toThrow();
  });
});

it('stores per-site tour edits on the publication rather than the canonical tour', async () => {
  const f = setup();
  const presentation = {
    title: 'Website only',
    description: 'Website description',
    commissionPercent: '5',
  };
  const result = await f.service.publish(
    'jahan-bastan',
    'tour',
    'tour-a',
    { enabled: false, version: 0, branchId: 'branch-a', presentation },
    actor,
  );
  expect(result.data).toMatchObject({ presentation, enabled: false });
  expect(f.tours.pricingDeparture).toHaveBeenCalledWith('tour-a', ['branch-a']);
});
