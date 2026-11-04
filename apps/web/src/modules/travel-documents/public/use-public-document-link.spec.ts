import { afterEach, expect, it, vi } from 'vitest';
import { readPublicDocumentLink } from './use-public-document-link';
afterEach(() => vi.unstubAllGlobals());
it('permits legacy rendering only when hosting is explicitly disabled', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: 'PUBLIC_DOCUMENTS_DISABLED' }, { status: 503 }),
      ),
  );
  expect((await readPublicDocumentLink('/saved/pdf?format=share')).status).toBe(
    'disabled',
  );
});
it.each([401, 403, 409, 503])(
  'never silently substitutes a pending QR after HTTP %s',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: 'unavailable' }, { status }),
        ),
    );
    await expect(
      readPublicDocumentLink('/saved/pdf?format=share'),
    ).rejects.toThrow('unavailable');
  },
);
it('uses only credentialed canonical GET data and propagates cancellation', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      url: 'https://example.test/d/' + 'a'.repeat(32),
      html: '<!doctype html><html>saved</html>',
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  expect(
    (await readPublicDocumentLink('/saved/pdf?format=share', controller.signal))
      .status,
  ).toBe('ready');
  expect(fetcher).toHaveBeenCalledWith('/saved/pdf?format=share', {
    credentials: 'include',
    cache: 'no-store',
    signal: controller.signal,
  });
});
it('shows the canonical authorized-route error without substituting draft content', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: 'برای خروجی، یک شرکت مشخص را انتخاب کنید.' },
          { status: 409 },
        ),
      ),
  );
  await expect(
    readPublicDocumentLink('/saved/pdf?format=share'),
  ).rejects.toThrow('برای خروجی، یک شرکت مشخص را انتخاب کنید.');
});
