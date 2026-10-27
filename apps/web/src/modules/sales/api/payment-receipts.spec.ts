import { beforeEach, expect, it, vi } from 'vitest';
import { paymentReceiptsApi } from './payment-receipts';
const h = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn() }));
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: h.fetch }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.example.test',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: h.refresh,
}));
beforeEach(() => {
  vi.clearAllMocks();
  h.fetch.mockResolvedValue(
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});
it('sends multipart directly to the authorized Sales contract/payment scope with no JSON header', async () => {
  const file = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' }),
    form = new FormData();
  form.set('file', file);
  await paymentReceiptsApi.upload('contract', 'payment', form);
  expect(h.fetch).toHaveBeenCalledWith(
    'https://api.example.test/sales/contracts/contract/payments/payment/receipts',
    expect.objectContaining({
      method: 'POST',
      body: form,
      credentials: 'include',
      cache: 'no-store',
    }),
  );
  expect(h.fetch.mock.calls[0]![1].headers).toBeUndefined();
});
it('downloads a binary receipt from its original contract/payment rather than the unrestricted document endpoint', async () => {
  h.fetch.mockResolvedValueOnce(
    new Response('%PDF', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }),
  );
  const result = await paymentReceiptsApi.download(
    'contract',
    'payment',
    'document',
  );
  expect(await result.blob.text()).toBe('%PDF');
  expect(h.fetch.mock.calls[0]![0]).toBe(
    'https://api.example.test/sales/contracts/contract/payments/payment/receipts/document/download',
  );
});
it('refreshes authentication once and preserves server permission errors', async () => {
  h.fetch
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Synthetic access denied' }), {
        status: 403,
      }),
    );
  h.refresh.mockResolvedValue(true);
  await expect(
    paymentReceiptsApi.list('contract', 'payment'),
  ).rejects.toMatchObject({ status: 403, message: 'Synthetic access denied' });
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(h.fetch).toHaveBeenCalledTimes(2);
});
