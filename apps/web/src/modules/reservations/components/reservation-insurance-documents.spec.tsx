import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  downloadInsurancePolicies,
  ReservationInsuranceDocuments,
  SalesInsuranceDocuments,
} from './reservation-insurance-documents';
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn(async () => false),
}));
afterEach(() => vi.unstubAllGlobals());
it('refreshes an expired session against the API origin and retries the PDF without reloading the page', async () => {
  vi.mocked(refreshAuthenticatedSession).mockResolvedValueOnce(
    {} as NonNullable<Awaited<ReturnType<typeof refreshAuthenticatedSession>>>,
  );
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(
      new Response('%PDF-synthetic', {
        headers: { 'content-type': 'application/pdf' },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const save = vi.fn();
  await downloadInsurancePolicies(
    'sales/contracts/contract/insurance',
    [{ id: 'policy' }],
    save,
  );
  expect(refreshAuthenticatedSession).toHaveBeenCalledWith('/api/v1');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenCalledTimes(1);
});
it.each([
  'reservations/requests/request/insurance',
  'sales/contracts/contract/insurance',
])(
  'downloads separate protected PDFs from %s without an archive',
  async (path) => {
    const fetcher = vi.fn(
      async () =>
        new Response('%PDF-synthetic', {
          headers: { 'content-type': 'application/pdf' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const save = vi.fn();
    await downloadInsurancePolicies(
      path,
      [{ id: 'first' }, { id: 'second' }],
      save,
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/' + path + '/pdf/first',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/' + path + '/pdf/second',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(save.mock.calls.map((call) => call[1])).toEqual([
      'sandbox-insurance-first.pdf',
      'sandbox-insurance-second.pdf',
    ]);
  },
);
it('does not save an error page or a denied response as a passenger PDF', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ message: 'Denied' }, { status: 403 })),
  );
  const save = vi.fn();
  await expect(
    downloadInsurancePolicies('path', [{ id: 'one' }], save),
  ).rejects.toThrow('Denied');
  expect(save).not.toHaveBeenCalled();
});
it('offers insurance in Sales and clearly identifies the sandbox in Reservations', () => {
  expect(
    renderToStaticMarkup(<SalesInsuranceDocuments contractId="contract" />),
  ).toContain('بیمه‌نامه');
  const html = renderToStaticMarkup(
    <ReservationInsuranceDocuments id="intake" />,
  );
  expect(html).toContain('بیمه‌نامهٔ واقعی مسافر نیست');
  expect(html).toContain('راهنمای اطلاعات لازم برای بیمه');
  expect(html).toContain('شماره گذرنامه');
  expect(html).not.toContain('مجوز مالی');
});
