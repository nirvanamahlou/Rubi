import { afterEach, expect, it, vi } from 'vitest';
import { loadFlightContracts, downloadFlightContracts } from './flight-load';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('uses the exact offer identity and the same cancellation filter for listing and XLSX', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
  const report = { offerId: 'offer', data: [] },
    blob = new Blob(['xlsx']);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(report), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    .mockResolvedValueOnce(
      new Response(blob, {
        headers: {
          'content-type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  expect(await loadFlightContracts('offer', true, signal)).toEqual(report);
  expect(await downloadFlightContracts('offer', true, signal)).toBeInstanceOf(
    Blob,
  );
  expect(fetcher.mock.calls[0]![0]).toContain(
    '/sales/flight-load/offer/contracts?cancelled=true',
  );
  expect(fetcher.mock.calls[1]![0]).toContain(
    '/sales/flight-load/offer/contracts.xlsx?cancelled=true',
  );
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
});
it('surfaces access denial instead of an empty list or an HTML download', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Denied' }), { status: 403 }),
      ),
  );
  await expect(
    loadFlightContracts('offer', false, new AbortController().signal),
  ).rejects.toThrow('Denied');
});
