import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SalesContractCreateRequest } from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { salesApi } from './client';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const input = {
  customerId: 'agency-customer',
  payerCustomerId: 'agency-customer',
  passengers: [{ customerId: 'traveler' }],
} as SalesContractCreateRequest;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function setup() {
  vi.mocked(refreshAuthenticatedSession).mockResolvedValue({
    user: { branches: [{ id: 'branch' }] },
  } as never);
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: { id: 'contract', version: 1 },
          meta: { idempotentReplay: false },
        }),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
describe('new agency contract request identity', () => {
  it('creates with secure random values when LAN HTTP lacks randomUUID', async () => {
    const fetch = setup();
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(42);
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    await salesApi.create(input);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/sales/contracts',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(input),
        headers: expect.objectContaining({
          'x-branch-id': 'branch',
          'idempotency-key': expect.stringMatching(uuid),
        }),
      }),
    );
  });
  it('retains a caller-supplied retry key without generating a new one', async () => {
    const fetch = setup(),
      randomUUID = vi.fn(() => 'unused');
    vi.stubGlobal('crypto', { randomUUID });
    await salesApi.create(input, 'same-submission-key');
    await salesApi.create(input, 'same-submission-key');
    expect(randomUUID).not.toHaveBeenCalled();
    for (const call of fetch.mock.calls)
      expect(call).toEqual([
        'http://localhost:4000/api/v1/sales/contracts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'idempotency-key': 'same-submission-key',
          }),
        }),
      ]);
  });
  it('still rejects missing branch scope before posting', async () => {
    const fetch = setup();
    vi.stubGlobal('crypto', undefined);
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue(null);
    await expect(salesApi.create(input)).rejects.toThrow('شعبه فعال');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the form fingerprint/retry guard while using the compatible generator', () => {
    const form = readFileSync(
      new URL('../components/sales-contract-form.tsx', import.meta.url),
      'utf8',
    );
    expect(form).not.toContain('crypto.randomUUID(');
    expect(form).toMatch(
      /if \(submission.current.fingerprint !== fingerprint\)\s*submission.current = \{ fingerprint, key: browserRandomUuid\(\) \};/,
    );
    expect(form).toContain('salesApi.create(payload, submission.current.key)');
  });
});
