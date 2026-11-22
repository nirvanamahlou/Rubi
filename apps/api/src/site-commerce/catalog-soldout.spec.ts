import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';
import { WebsiteCatalogDispatcher } from './catalog-dispatcher';
type Mock = ReturnType<typeof vi.fn>;
type Harness = {
  catalog: SiteCommerceService['catalog'];
  scoped: Mock;
  db: { client: { websitePublication: { findMany: Mock; updateMany: Mock } } };
  flight: Mock;
  ticketTarget: Mock;
  cancelledOrders: Mock;
};
const actor: AuthenticatedActor = {
  userId: 'synthetic-site',
  sessionId: 'synthetic-session',
  branchIds: ['branch'],
  permissions: [],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function fixture(capacity = 0, manual = false, enabled = true) {
  const row = {
    id: 'publication',
    kind: 'ticket',
    resourceId: 'offer',
    enabled,
    salesStopped: manual,
    version: 7,
    presentation: null,
  };
  const stock = { capacity };
  const service = Object.create(SiteCommerceService.prototype) as Harness;
  service.scoped = vi.fn().mockReturnValue(actor);
  service.db = {
    client: {
      websitePublication: {
        findMany: vi.fn().mockResolvedValue([row]),
        updateMany: vi.fn(),
      },
    },
  };
  service.flight = vi.fn().mockImplementation(async () => ({
    id: 'offer',
    remainingCapacity: stock.capacity,
  }));
  service.ticketTarget = vi.fn().mockResolvedValue('target');
  service.cancelledOrders = vi.fn().mockResolvedValue([]);
  return { service, row, stock };
}
function senderFixture() {
  const f = fixture();
  vi.stubEnv(
    'NSS_CATALOG_WEBHOOK_SECRET',
    'synthetic-nss-key-000000000000000000000001',
  );
  vi.stubEnv(
    'JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET',
    'synthetic-jahan-key-00000000000000000000002',
  );
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({
      nss: { branchId: 'branch', userId: actor.userId },
      'jahan-bastan': { branchId: 'branch', userId: actor.userId },
    }),
  );
  const states = {
    nss: {
      branchId: 'branch',
      revision: 2n,
      deliveredRevision: 1n,
      nextRefreshAt: null as Date | null,
    },
    'jahan-bastan': {
      branchId: 'branch',
      revision: 2n,
      deliveredRevision: 1n,
      nextRefreshAt: null as Date | null,
    },
  };
  const table = {
    upsert: vi.fn(),
    findUniqueOrThrow: vi
      .fn()
      .mockImplementation(
        async ({ where }: { where: { siteCode: keyof typeof states } }) =>
          states[where.siteCode],
      ),
    updateMany: vi.fn().mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { siteCode: keyof typeof states };
        data: {
          revision?: { increment: number };
          deliveredRevision?: bigint;
          nextRefreshAt?: Date | null;
        };
      }) => {
        const s = states[where.siteCode];
        if (data.revision) s.revision += BigInt(data.revision.increment);
        if (data.deliveredRevision)
          s.deliveredRevision = data.deliveredRevision;
        if ('nextRefreshAt' in data)
          s.nextRefreshAt = data.nextRefreshAt ?? null;
        return { count: 1 };
      },
    ),
  };
  const commerce = {
    catalog: vi
      .fn()
      .mockImplementation((site: string, a: AuthenticatedActor) =>
        f.service.catalog(site, a),
      ),
    nextCatalogCapacityChange: vi.fn().mockResolvedValue(null),
  };
  const sender = new WebsiteCatalogDispatcher(
    { client: { websiteCatalogDelivery: table } } as never,
    commerce as never,
  );
  const fetcher = vi
    .fn()
    .mockImplementation(
      async (
        _url: string,
        request: { body: string; headers: Record<string, string> },
      ) => ({
        ok: true,
        json: async () => ({
          accepted: true,
          revision: JSON.parse(request.body).revision,
        }),
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  return {
    ...f,
    states,
    table,
    fetcher,
    sender,
    tick: (site = 'nss') =>
      (sender as unknown as { tick(site: string): Promise<void> }).tick(site),
  };
}
describe('Automatic exhausted-ticket website stop', () => {
  it('keeps floating ticket prices visible but never advertises reservable stock', async () => {
    const f = fixture(20);
    f.service.flight.mockResolvedValue({
      id: 'offer',
      supplyType: 'FLOATING',
      remainingCapacity: 20,
      standaloneSalePrice: { amount: '1200000', currencyCode: 'IRR' },
    });
    expect((await f.service.catalog('nss', actor)).data[0]).toMatchObject({
      enabled: true,
      salesStopped: true,
      previewOnly: true,
      flight: {
        standaloneSalePrice: { amount: '1200000', currencyCode: 'IRR' },
      },
    });
    expect(f.row.salesStopped).toBe(false);
  });
  for (const capacity of [0, -1])
    it('projects an effective stop at capacity ' + capacity, async () => {
      const f = fixture(capacity);
      expect((await f.service.catalog('nss', actor)).data[0]).toMatchObject({
        enabled: true,
        salesStopped: true,
        capacityStopped: true,
        flight: { remainingCapacity: capacity },
      });
      expect(f.row).toMatchObject({
        enabled: true,
        salesStopped: false,
        version: 7,
      });
      expect(
        f.service.db.client.websitePublication.updateMany,
      ).not.toHaveBeenCalled();
    });
  it('retains the last available seat as sellable', async () => {
    const f = fixture(1);
    expect((await f.service.catalog('nss', actor)).data[0]).toMatchObject({
      salesStopped: false,
    });
  });
  it('reopens only derived stock stops when capacity is released', async () => {
    const f = fixture(0);
    await f.service.catalog('nss', actor);
    f.stock.capacity = 1;
    const p = (await f.service.catalog('nss', actor)).data[0];
    expect(p).toMatchObject({ salesStopped: false });
    expect(p).not.toHaveProperty('capacityStopped');
  });
  it('never clears manual stop on capacity release', async () => {
    const f = fixture(0, true);
    await f.service.catalog('nss', actor);
    f.stock.capacity = 2;
    expect((await f.service.catalog('nss', actor)).data[0]).toMatchObject({
      salesStopped: true,
    });
    expect(f.row.salesStopped).toBe(true);
  });
  it('never republishes a manually removed product', async () => {
    const f = fixture(0, false, false);
    expect((await f.service.catalog('nss', actor)).data[0]).toMatchObject({
      enabled: false,
    });
    expect(f.service.flight).not.toHaveBeenCalled();
  });
  it('sends signed stop snapshots independently to both existing site receivers', async () => {
    const f = senderFixture();
    try {
      await f.tick('nss');
      await f.tick('jahan-bastan');
      expect(f.fetcher).toHaveBeenCalledTimes(2);
      for (const [url, request] of f.fetcher.mock.calls) {
        const body = JSON.parse(request.body);
        expect(body.data[0]).toMatchObject({
          salesStopped: true,
          capacityStopped: true,
        });
        const secret =
          body.site === 'nss'
            ? process.env.NSS_CATALOG_WEBHOOK_SECRET!
            : process.env.JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET!;
        expect(request.headers['x-erp-signature']).toBe(
          createHmac('sha256', secret)
            .update(request.headers['x-erp-timestamp'] + '.' + request.body)
            .digest('hex'),
        );
        expect(url).toContain(
          body.site === 'nss' ? 'niyayeshseir.ir' : 'jahanbastan.ir',
        );
      }
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('keeps a rejected stop delivery pending for retry', async () => {
    const f = senderFixture();
    f.fetcher.mockRejectedValueOnce(Error('offline'));
    try {
      await f.tick();
      expect(f.states.nss.deliveredRevision).toBe(1n);
      await f.tick();
      expect(f.states.nss.deliveredRevision).toBe(2n);
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('sends restored availability in a newer capacity revision', async () => {
    const f = senderFixture();
    try {
      await f.tick();
      f.stock.capacity = 1;
      f.states.nss.revision = 3n;
      await f.tick();
      expect(JSON.parse(f.fetcher.mock.calls[1]![1].body)).toMatchObject({
        revision: 3,
        data: [{ salesStopped: false }],
      });
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('uses the existing scheduled refresh after a non-pinned hold expires', async () => {
    const f = senderFixture();
    f.stock.capacity = 1;
    f.states.nss.deliveredRevision = 2n;
    f.states.nss.nextRefreshAt = new Date(Date.now() - 1000);
    try {
      await f.tick();
      expect(JSON.parse(f.fetcher.mock.calls[0]![1].body)).toMatchObject({
        revision: 3,
        data: [{ salesStopped: false }],
      });
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('does not invent capacity release without a source change or scheduled expiry', async () => {
    const f = senderFixture();
    f.states.nss.deliveredRevision = 2n;
    try {
      await f.tick();
      expect(f.fetcher).not.toHaveBeenCalled();
    } finally {
      f.sender.onModuleDestroy();
    }
  });
});
