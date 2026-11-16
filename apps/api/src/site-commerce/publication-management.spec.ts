import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';
const actor = {
  branchIds: ['branch-a'],
  permissions: ['ticket_catalog.manage'],
} as AuthenticatedActor;
function setup() {
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({ nss: { branchId: 'branch-a' } }),
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
      websitePublication: publication,
      websiteCatalogDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          branchId: 'branch-a',
          salePriceTargetId: 'target',
        }),
      },
    },
  };
  const tickets = {
    documentSupply: vi.fn().mockResolvedValue({}),
    websiteOffer: vi.fn().mockResolvedValue({}),
  };
  const tours = { pricingDeparture: vi.fn().mockResolvedValue({}) };
  const service = new SiteCommerceService(
    db as never,
    tickets as never,
    tours as never,
    {
      websitePublicationCandidates: vi
        .fn()
        .mockResolvedValue({ data: ['tour-a', 'id'] }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, publication, tickets, tours };
}
afterEach(() => vi.unstubAllEnvs());
describe('website destination management', () => {
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
      'ghestiroo',
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
