import { afterEach, expect, it, vi } from 'vitest';
import { insuranceRequest } from './client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://example.invalid/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn(async () => false),
}));
afterEach(() => vi.unstubAllGlobals());

it('shows the real normalized API error for a failed correction instead of the generic loading error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'اطلاعات درخواست بیمه معتبر نیست. · ایمیل بیمه‌شده',
            },
          }),
          { status: 400 },
        ),
    ),
  );
  await expect(insuranceRequest('draft', { method: 'PUT' })).rejects.toThrow(
    'ایمیل بیمه‌شده',
  );
});

it('preserves a legacy API error and handles non-JSON failures without masking successful replies', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'legacy reason' }), {
        status: 409,
      }),
    )
    .mockResolvedValueOnce(new Response('unavailable', { status: 502 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'synthetic' } }), {
        status: 200,
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(insuranceRequest('draft')).rejects.toThrow('legacy reason');
  await expect(insuranceRequest('draft')).rejects.toThrow(
    'اطلاعات بیمه دریافت نشد.',
  );
  await expect(insuranceRequest('draft')).resolves.toEqual({
    data: { id: 'synthetic' },
  });
});
