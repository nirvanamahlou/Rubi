import { afterEach, describe, expect, it, vi } from 'vitest';
import { procurementApi, retryIdentity, commandAttempt } from './api';
import { emptyDraft } from './model';

const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
});
describe('Procurement failure and retry contract', () => {
  it('pins original command version and key across a background refetch after an ambiguous failure', () => {
    const original = {
      id: 'request',
      number: 'PR-1',
      version: 3,
      status: 'SOURCING' as const,
      requesterUserId: 'user',
      ownerUserId: null,
      createdAt: '',
      updatedAt: '',
      draft: emptyDraft(),
    };
    const body = {
      action: 'RECEIVE',
      orderId: 'order',
      lines: [{ itemId: 'line', quantity: '2' }],
    };
    const first = commandAttempt(null, original, body);
    const refreshed = { ...original, version: 4 };
    const retry = commandAttempt(first, refreshed, body);
    expect(retry.key).toBe(first.key);
    expect(retry.request.version).toBe(3);
    const changed = commandAttempt(first, refreshed, {
      ...body,
      reason: 'عملیات جدید',
    });
    expect(changed.key).not.toBe(first.key);
    expect(changed.request.version).toBe(3);
  });
  it('accepts an asynchronous export job without treating queued work as a completed file', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const job = {
      id: 'job',
      kind: 'REPORT',
      format: 'XLSX',
      status: 'QUEUED',
      result: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(job), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = {
      kind: 'REPORT',
      format: 'XLSX',
      branchId: 'branch',
      documentTypeId: 'type',
      categoryId: 'category',
      query: { dimension: 'currency' },
    };
    const result = await procurementApi.createExport(body, 'stable-job-key');
    expect(result.status).toBe('QUEUED');
    expect(result.result).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/procurement/exports'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'stable-job-key',
        }),
        body: JSON.stringify(body),
      }),
    );
  });
  it('preserves complete user input and reuses the same key after an ambiguous network failure', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const draft = {
      ...emptyDraft(),
      title: 'نیاز واقعی واحد',
      urgencyReason: 'فوریت ثبت‌شده',
      estimatedAmount: '123456789123456789.1234',
    };
    const before = structuredClone(draft);
    const initial = retryIdentity(null, draft);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'saved', draft }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(procurementApi.save(draft, initial.key)).rejects.toThrow(
      'اطلاعات فرم حفظ شده',
    );
    const retried = retryIdentity(initial, draft);
    await procurementApi.save(draft, retried.key);
    expect(draft).toEqual(before);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(fetchMock.mock.calls[1]?.[1]);
    expect(
      retryIdentity(initial, { ...draft, title: 'اصلاح شده' }).key,
    ).not.toBe(initial.key);
  });
  it('exposes a recoverable conflict without overwriting the submitted draft or expected version', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const draft = { ...emptyDraft(), title: 'ورودی ذخیره‌نشده' };
    const request = {
      id: 'request',
      number: 'PR-1',
      version: 3,
      status: 'DRAFT' as const,
      requesterUserId: 'user',
      ownerUserId: null,
      createdAt: '',
      updatedAt: '',
      draft,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'VERSION_CONFLICT' }), {
        status: 409,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      procurementApi.save(draft, 'retry-key', request),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('ورودی شما حفظ شد'),
    });
    expect(request.version).toBe(3);
    expect(draft.title).toBe('ورودی ذخیره‌نشده');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({
      expectedVersion: 3,
      draft,
    });
  });
  it('distinguishes forbidden access from an empty successful list', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    await expect(
      procurementApi.list(new URLSearchParams()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('sends the current version when permanently deleting a request', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const request = {
      id: 'request-delete',
      number: 'PR-1405-901',
      version: 7,
      status: 'DRAFT' as const,
      requesterUserId: 'user',
      ownerUserId: null,
      createdAt: '',
      updatedAt: '',
      draft: emptyDraft(),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: request.id,
          number: request.number,
          deleted: true,
        }),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(procurementApi.remove(request)).resolves.toMatchObject({
      deleted: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/procurement/requests/${request.id}`),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ expectedVersion: request.version }),
      }),
    );
  });
});
