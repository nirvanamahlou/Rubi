import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://trusted-api.test',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(true),
}));
import {
  downloadFinanceExport,
  exportQueryString,
} from './finance-export-actions';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('Finance output download integrity', () => {
  it('encodes source filters safely and omits empty parameters', () => {
    expect(
      new URLSearchParams(
        exportQueryString({ person: 'الف & ب', page: 2 }),
      ).get('person'),
    ).toBe('الف & ب');
    expect(exportQueryString({ person: '' })).toBe('');
  });
  it('never downloads an HTML error disguised as a PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>login</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    await expect(downloadFinanceExport({}, 'pdf')).rejects.toThrow(
      'فایل معتبر',
    );
  });
  it('rejects incorrect binary signatures even with the correct MIME type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-a-pdf', {
          headers: { 'Content-Type': 'application/pdf' },
        }),
      ),
    );
    await expect(downloadFinanceExport({}, 'pdf')).rejects.toThrow('نامعتبر');
  });
  it('refreshes only once after expiry and preserves permission failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({ message: 'دسترسی ممنوع' }, { status: 403 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadFinanceExport({}, 'xlsx')).rejects.toThrow(
      'دسترسی ممنوع',
    );
    expect(refreshAuthenticatedSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('downloads a genuine private XLSX using an object URL and removes the temporary link', async () => {
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal('window', { setTimeout: vi.fn() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-test');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x50, 0x4b, 3, 4, 0]), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await downloadFinanceExport(
      {
        scope: 'RECEIPT',
        historySource: 'OPERATIONAL',
        recordId: 'persisted-id',
      },
      'xlsx',
    );
    expect(anchor.download).toBe('finance-receipt.xlsx');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
    });
  });
});
