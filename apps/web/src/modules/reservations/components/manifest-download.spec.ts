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
  it('keeps new-only strict and uses separate stable keys for an explicit all export', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'برای این بلیط قرارداد جدید قابل خروجی وجود ندارد.',
          }),
          { status: 400 },
        ),
      )
      .mockImplementation(async () => fileResponse());
    const keys = new Map<string, string>();
    await expect(requestManifestDownload(input, request, keys)).rejects.toThrow(
      'قرارداد جدید',
    );
    expect(request).toHaveBeenCalledTimes(1);
    const result = await requestManifestDownload(
      { ...input, includePreviouslyExported: true },
      request,
      keys,
    );
    expect(result.file.size).toBe(4);
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

it('sends an explicit template override and isolates its retry key from default and other templates', async () => {
  const request = vi.fn(async (path: string, init: RequestInit) => {
    expect(path).toContain('.xlsx');
    expect(init.method).toBe('POST');
    return fileResponse();
  });
  const keys = new Map<string, string>();
  for (const manifestTemplateId of [
    undefined,
    'template-a',
    'template-a',
    'template-b',
  ])
    await requestManifestDownload(
      { ...input, ...(manifestTemplateId ? { manifestTemplateId } : {}) },
      request,
      keys,
    );
  expect(
    JSON.parse(String(request.mock.calls[1]![1].body)).manifestTemplateId,
  ).toBe('template-a');
  const values = request.mock.calls.map(
    (call) => (call[1].headers as Record<string, string>)['Idempotency-Key'],
  );
  expect(values[1]).toBe(values[2]);
  expect(values[0]).not.toBe(values[1]);
  expect(values[3]).not.toBe(values[1]);
});

it('sends independent builtin selections, stable format-specific keys, and keeps the XLSM extension', async () => {
  const request = vi.fn(
    async () =>
      new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: {
          'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        },
      }),
  );
  const keys = new Map<string, string>();
  const output = await requestManifestDownload(
    { ...input, builtinTemplate: 'DEFAULT_MANIFEST' },
    request,
    keys,
  );
  await requestManifestDownload(
    { ...input, builtinTemplate: 'REPORT' },
    request,
    keys,
  );
  await requestManifestDownload(
    { ...input, builtinTemplate: 'DEFAULT_MANIFEST' },
    request,
    keys,
  );
  expect(output.fileExtension).toBe('xlsm');
  const calls = request.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(String(calls[0]![1].body)).builtinTemplate).toBe(
    'DEFAULT_MANIFEST',
  );
  expect(JSON.parse(String(calls[1]![1].body)).builtinTemplate).toBe('REPORT');
  const key = (i: number) =>
    (calls[i]![1].headers as Record<string, string>)['Idempotency-Key'];
  expect(key(0)).not.toBe(key(1));
  expect(key(0)).toBe(key(2));
});
