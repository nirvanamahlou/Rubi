import { afterEach, describe, expect, it, vi } from 'vitest';

import { documentsApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe('documents API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined)
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
  });

  it('serializes server-side filters without ALL or empty values', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { page: 2, pageSize: 25, total: 0, totalPages: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await documentsApi.list({
      search: '',
      validity: 'ALL',
      domain: 'FINANCE',
      scanStatus: 'CLEAN',
      createdFrom: '2026-08-01',
      personalView: 'UPLOADED',
      page: 2,
      pageSize: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/documents?domain=FINANCE&scanStatus=CLEAN&createdFrom=2026-08-01&personalView=UPLOADED&page=2&pageSize=25',
      ),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('validity=ALL');
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('search=');
  });

  it('uploads FormData without forcing an unsafe content-type boundary', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'document-id' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('title', 'سند واقعی');

    await documentsApi.upload(form);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/documents/upload'),
      expect.objectContaining({ method: 'POST', body: form }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers['content-type']).toBeUndefined();
  });

  it('loads an authenticated image preview with the sensitive-read reason and abort signal', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['image-bytes'], { type: 'image/jpeg' }), {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-disposition': 'inline; filename="photo.jpg"',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const response = await documentsApi.preview(
      'document-id',
      'بررسی پرونده',
      controller.signal,
    );

    expect(response.blob.type).toBe('image/jpeg');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/documents/document-id/preview'),
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: expect.objectContaining({
          'x-sensitive-read-reason': encodeURIComponent('بررسی پرونده'),
        }),
      }),
    );
  });
});
