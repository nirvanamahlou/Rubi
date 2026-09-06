import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));

describe('customer documents public API consumer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
  });

  it('lists only the exact customer source in its authorized branch and domain', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { customerDocumentsApi } =
      await import('./customer-documents-client');

    await customerDocumentsApi.listForCustomer({
      customerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    const url = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/api/v1/documents');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      domain: 'CUSTOMER_IDENTITY',
      branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sourceModule: 'customers',
      sourceEntityType: 'Customer',
      sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });

  it('uploads with cookies and does not force a content-type for FormData', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'document-id' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { customerDocumentsApi } =
      await import('./customer-documents-client');
    const form = new FormData();
    form.set('title', 'پاسپورت');

    await customerDocumentsApi.upload(form);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/documents/upload',
      expect.objectContaining({
        body: form,
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
      }),
    );
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).has('content-type')).toBe(false);
  });
});
