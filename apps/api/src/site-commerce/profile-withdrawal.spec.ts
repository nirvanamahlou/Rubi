import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { MasterDataRecord } from '@nora/contracts';
import {
  profileDeletionSites,
  withdrawProfileFromSite,
  withdrawWebsiteProfile,
} from './profile-withdrawal';

const record: MasterDataRecord = {
  id: 'be961690-3904-44d0-b29c-1f46f3fcb9fa',
  resource: 'hotels',
  name: 'هتل آزمایشی',
  code: 'HTL-AYT-999',
  status: 'active',
  version: 1,
  createdAt: '2026-11-23T00:00:00.000Z',
  updatedAt: '2026-11-23T00:00:00.000Z',
  attributes: { identificationCode: 'HTL-AYT-999' },
};
const secret = 'test-only-catalog-webhook-secret-12345';

function destinations(blocked = false) {
  vi.stubEnv('NSS_CATALOG_WEBHOOK_SECRET', secret);
  vi.stubEnv('JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET', secret);
  vi.stubEnv('GHESTIROO_CATALOG_WEBHOOK_SECRET', secret);
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    expect(headers.get('x-erp-signature')).toBe(
      createHmac('sha256', secret)
        .update(`${headers.get('x-erp-timestamp')}.${String(init.body)}`)
        .digest('hex'),
    );
    expect(JSON.parse(String(init.body)).identificationCode).toBe(
      'HTL-AYT-999',
    );
    return Response.json({
      linked: !url.includes('ghestiroo'),
      blocked: blocked && url.includes('jahanbastan'),
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('master data site withdrawal', () => {
  it('withdraws only from the chosen site, independently of the others', async () => {
    const fetch = destinations();
    await withdrawProfileFromSite('nss', record);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0]!;
    expect(new URL(url).hostname).toBe('niyayeshseir.ir');
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: 'withdraw',
      id: record.id,
    });
  });

  it('requires all sites and only contacts linked sites for withdrawal', async () => {
    const fetch = destinations();
    const sites = await profileDeletionSites(record);
    expect(sites).toEqual(['nss', 'jahan-bastan']);
    await expect(withdrawWebsiteProfile(record, ['nss'])).rejects.toMatchObject(
      {
        status: 409,
      },
    );
    expect(fetch.mock.calls).toHaveLength(6);
    await withdrawWebsiteProfile(record, sites);
    const withdrawals = fetch.mock.calls.filter(
      ([, init]) => JSON.parse(String(init.body)).action === 'withdraw',
    );
    expect(withdrawals.map(([url]) => new URL(url).hostname)).toEqual([
      'niyayeshseir.ir',
      'jahanbastan.ir',
    ]);
  });

  it('checks dependencies before withdrawing on any site', async () => {
    const fetch = destinations(true);
    await expect(
      withdrawWebsiteProfile(record, ['nss', 'jahan-bastan']),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetch.mock.calls).toHaveLength(3);
  });

  it('keeps a configured destination from being skipped if its signing key is unavailable', async () => {
    const fetch = destinations();
    vi.stubEnv('SITE_COMMERCE_BINDINGS', '{"nss":{"branchId":"site-branch"}}');
    vi.stubEnv('NSS_CATALOG_WEBHOOK_SECRET', '');
    await expect(withdrawWebsiteProfile(record, [])).rejects.toMatchObject({
      status: 503,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
