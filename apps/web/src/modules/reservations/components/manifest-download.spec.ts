import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  manifestRequestKey,
  requestManifestDownload,
} from './manifest-download';
afterEach(() => vi.unstubAllGlobals());
const input = {
  offerId: 'offer',
  fromDate: '2026-10-01',
  toDate: '2026-10-01',
  includePreviouslyExported: false,
};
const fileResponse = () =>
  new Response(new Uint8Array([80, 75, 3, 4]), {
    headers: {
      'X-Nora-Manifest-Contracts': '1',
      'X-Nora-Manifest-Passengers': '2',
    },
  });
describe('manifest download', () => {
  it('works on HTTP LAN origins without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    expect(manifestRequestKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  it('keeps an HTTP-compatible request key when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(manifestRequestKey()).toMatch(/^manifest-/);
  });
  it('uses separate stable keys when new-only falls back to all approved contracts', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'برای این بلیط قرارداد جدید قابل خروجی وجود ندارد.',
            },
          }),
          { status: 400 },
        ),
      )
      .mockImplementation(async () => fileResponse());
    const keys = new Map<string, string>();
    const result = await requestManifestDownload(input, request, keys);
    expect(result.file.size).toBe(4);
    expect(result.retriedWithAll).toBe(true);
    expect(result.contracts).toBe('1');
    const first = request.mock.calls[0]![1];
    const second = request.mock.calls[1]![1];
    expect(JSON.parse(first.body).includePreviouslyExported).toBe(false);
    expect(JSON.parse(second.body).includePreviouslyExported).toBe(true);
    expect(first.headers['Idempotency-Key']).not.toBe(
      second.headers['Idempotency-Key'],
    );
    await requestManifestDownload(
      { ...input, includePreviouslyExported: true },
      request,
      keys,
    );
    expect(request.mock.calls[2]![1].headers['Idempotency-Key']).toBe(
      second.headers['Idempotency-Key'],
    );
  });
  it('never retries a finance rejection as an all-contract export', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'تأیید مالی انجام نشده است.' } }),
          { status: 400 },
        ),
      );
    await expect(
      requestManifestDownload(input, request, new Map()),
    ).rejects.toThrow('تأیید مالی');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects an empty success response instead of pretending to download', async () => {
    await expect(
      requestManifestDownload(
        input,
        vi.fn().mockResolvedValue(new Response()),
        new Map(),
      ),
    ).rejects.toThrow('خالی');
  });
});
