import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebsiteCatalogDispatcher } from './catalog-dispatcher';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function fixture(revision = 2n, deliveredRevision = 1n) {
  vi.stubEnv(
    'NSS_CATALOG_WEBHOOK_SECRET',
    'synthetic-test-secret-only-00000000000001',
  );
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({ nss: { branchId: 'branch', userId: 'service' } }),
  );
  const state = { revision, deliveredRevision, branchId: 'branch' };
  const table = {
    upsert: vi.fn(),
    findUniqueOrThrow: vi.fn().mockResolvedValue(state),
    updateMany: vi.fn(),
  };
  const commerce = {
    nextCatalogCapacityChange: vi.fn().mockResolvedValue(null),
    catalog: vi.fn().mockResolvedValue({ version: 1, data: [] }),
  };
  const sender = new WebsiteCatalogDispatcher(
    { client: { websiteCatalogDelivery: table } } as never,
    commerce as never,
  );
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ accepted: true, revision: Number(revision) }),
  });
  vi.stubGlobal('fetch', fetcher);
  return {
    sender,
    table,
    commerce,
    fetcher,
    tick: () => (sender as unknown as { tick(): Promise<void> }).tick(),
  };
}
describe('update-driven website catalog delivery', () => {
  it('does not read the catalog or contact the site when no source revision changed', async () => {
    const f = fixture(2n, 2n);
    try {
      await f.tick();
      expect(f.commerce.catalog).not.toHaveBeenCalled();
      expect(f.fetcher).not.toHaveBeenCalled();
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('sends a signed versioned snapshot and acknowledges only its captured revision', async () => {
    const f = fixture();
    try {
      await f.tick();
      const [url, request] = f.fetcher.mock.calls[0]!;
      expect(url).toBe('https://niyayeshseir.ir/api/v1/erp/catalog-delivery');
      expect(request.headers['x-erp-signature']).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.parse(request.body)).toMatchObject({
        site: 'nss',
        revision: 2,
        data: [],
      });
      expect(f.table.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveredRevision: 2n }),
        }),
      );
    } finally {
      f.sender.onModuleDestroy();
    }
  });
  it('keeps failed delivery pending for retry', async () => {
    const f = fixture();
    f.fetcher.mockRejectedValue(Error('offline'));
    try {
      await f.tick();
      expect(f.table.updateMany).not.toHaveBeenCalled();
    } finally {
      f.sender.onModuleDestroy();
    }
  });
});
