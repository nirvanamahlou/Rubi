import { createHmac } from 'node:crypto';
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
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      expect(f.table.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteCode: 'nss' }),
          data: { lastError: 'delivery_failed' },
        }),
      );
      expect(
        f.table.updateMany.mock.calls.some(
          ([change]) => 'deliveredRevision' in change.data,
        ),
      ).toBe(false);
    } finally {
      f.sender.onModuleDestroy();
    }
  });
});

describe('Ghestiroo flight delivery', () => {
  const key = 'ghestiroo-fixture-signing-key-000001';
  const jahan = 'jahan-fixture-signing-key-0000000001';

  function ghestirooFixture(secret = key, userId = 'ghestiroo-service') {
    const f = fixture();
    vi.stubEnv('GHESTIROO_CATALOG_WEBHOOK_SECRET', secret);
    vi.stubEnv('JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET', jahan);
    vi.stubEnv(
      'SITE_COMMERCE_BINDINGS',
      JSON.stringify({
        nss: { branchId: 'branch', userId: 'service' },
        'jahan-bastan': { branchId: 'branch', userId: 'jahan-service' },
        ghestiroo: { branchId: 'branch', userId },
      }),
    );
    const sender = f.sender as unknown as { tick(site: string): Promise<void> };
    return { ...f, tickGhestiroo: () => sender.tick('ghestiroo') };
  }

  it('signs the Ghestiroo revision and records only its receipt', async () => {
    const f = ghestirooFixture();
    try {
      await f.tickGhestiroo();
      expect(f.commerce.catalog).toHaveBeenCalledWith(
        'ghestiroo',
        expect.objectContaining({
          userId: 'ghestiroo-service',
          branchIds: ['branch'],
        }),
      );
      const [url, request] = f.fetcher.mock.calls[0]!;
      expect(url).toBe('https://ghestiroo.ir/api/v1/erp/catalog-delivery');
      expect(JSON.parse(request.body)).toEqual({
        site: 'ghestiroo',
        version: 1,
        revision: 2,
        data: [],
      });
      expect(request.headers['x-erp-signature']).toBe(
        createHmac('sha256', key)
          .update(request.headers['x-erp-timestamp'] + '.' + request.body)
          .digest('hex'),
      );
      expect(f.table.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteCode: 'ghestiroo' }),
          data: expect.objectContaining({ deliveredRevision: 2n }),
        }),
      );
    } finally {
      f.sender.onModuleDestroy();
    }
  });

  it.each([
    [jahan, 'ghestiroo-service'],
    [key, 'service'],
  ])('rejects a reused signing key or actor (%#)', async (secret, actor) => {
    const f = ghestirooFixture(secret, actor);
    try {
      await f.tickGhestiroo();
      expect(f.fetcher).not.toHaveBeenCalled();
      expect(f.commerce.catalog).not.toHaveBeenCalled();
    } finally {
      f.sender.onModuleDestroy();
    }
  });
});

it('acknowledges NSS while the other receiver is still pending', async () => {
  const f = fixture();
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({
      nss: { branchId: 'branch', userId: 'service' },
      'jahan-bastan': { branchId: 'branch', userId: 'jahan-service' },
    }),
  );
  vi.stubEnv(
    'JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET',
    'synthetic-jahan-only-secret-000000001',
  );
  let release!: () => void;
  const offline = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.fetcher.mockImplementation(async (url: string) => {
    if (url.startsWith('https://jahanbastan.ir/')) {
      await offline;
      throw Error('offline');
    }
    return { ok: true, json: async () => ({ accepted: true, revision: 2 }) };
  });
  const sender = f.sender as unknown as { tick(site: string): Promise<void> };
  const pending = sender.tick('jahan-bastan');
  try {
    await sender.tick('nss');
    expect(f.commerce.catalog).toHaveBeenCalledWith(
      'jahan-bastan',
      expect.objectContaining({ userId: 'jahan-service' }),
      true,
    );
    expect(f.table.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteCode: 'nss' }),
        data: expect.objectContaining({ deliveredRevision: 2n }),
      }),
    );
  } finally {
    release();
    await pending;
    f.sender.onModuleDestroy();
  }
  for (const [url, request] of f.fetcher.mock.calls) {
    const body = JSON.parse(request.body);
    const jahan = body.site === 'jahan-bastan';
    expect(new URL(url).origin).toBe(
      jahan ? 'https://jahanbastan.ir' : 'https://niyayeshseir.ir',
    );
    const secret = jahan
      ? process.env.JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET!
      : process.env.NSS_CATALOG_WEBHOOK_SECRET!;
    expect(request.headers['x-erp-signature']).toBe(
      createHmac('sha256', secret)
        .update(request.headers['x-erp-timestamp'] + '.' + request.body)
        .digest('hex'),
    );
  }
  expect(f.table.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ siteCode: 'jahan-bastan' }),
      data: { lastError: 'delivery_failed' },
    }),
  );
});
