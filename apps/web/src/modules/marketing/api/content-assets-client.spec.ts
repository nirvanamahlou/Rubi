import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  marketingAssetStatusLabel,
  MarketingAssetScanBlockedError,
  marketingContentAssetsApi,
} from './content-assets-client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3101',
}));

describe('Marketing content assets client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the selected persisted page with the session cookie', async () => {
    const result = {
      data: [{ documentId: 'asset-26', title: 'Second page' }],
      meta: { page: 2, totalPages: 2, total: 26 },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(marketingContentAssetsApi.list(2)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3101/marketing/content/assets?page=2',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses scoped upload and download routes and preserves denial', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { documentId: 'id', scanStatus: 'PENDING_SCAN' },
          }),
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'فایل تا پایان اسکن قابل دریافت نیست.' }),
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('kind', 'brochure');
    await expect(marketingContentAssetsApi.upload(form)).resolves.toMatchObject(
      { scanStatus: 'PENDING_SCAN' },
    );
    await expect(marketingContentAssetsApi.download('id')).rejects.toThrow(
      'فایل تا پایان اسکن قابل دریافت نیست.',
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3101/marketing/content/assets',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:3101/marketing/content/assets/id/download',
    );
  });

  it('retains persisted terminal scan failure as a blocked asset', async () => {
    const persistedAsset = {
      documentId: 'id',
      title: 'Brochure',
      scanStatus: 'INFECTED',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'MARKETING_ASSET_SCAN_BLOCKED',
            message: 'فایل ثبت شد، اما اسکن امنیتی آن را مسدود کرد.',
            data: persistedAsset,
          }),
          { status: 409 },
        ),
      ),
    );
    const error = await marketingContentAssetsApi
      .upload(new FormData())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MarketingAssetScanBlockedError);
    expect(error).toMatchObject({ asset: persistedAsset });
    expect(marketingAssetStatusLabel('INFECTED')).toContain('آلوده');
    expect(marketingAssetStatusLabel('SCAN_FAILED')).toContain('ناموفق');
    expect(marketingAssetStatusLabel('QUARANTINED')).toContain('قرنطینه');
    expect(marketingAssetStatusLabel('PENDING_SCAN')).toBe('در انتظار اسکن');
  });
});
