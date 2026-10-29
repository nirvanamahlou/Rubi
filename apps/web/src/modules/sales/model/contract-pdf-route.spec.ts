import { beforeEach, describe, it, expect, vi } from 'vitest';
import { GET } from '../../../app/sales/contracts/[id]/pdf/route';
import { printFixture } from './contract-print.fixture';
const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  fetch: vi.fn(),
  prepare: vi.fn(),
  share: vi.fn(),
}));
vi.mock('../server/contract-pdf', () => ({
  renderContractPdf: mocks.render,
  prepareContractHtml: mocks.prepare,
}));
vi.mock('@/modules/travel-documents/server/public-document-store', () => ({
  createPublicDocument: mocks.share,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('node:fs/promises', () => ({
  readFile: async () => Buffer.from('logo'),
}));
const id = '10000000-0000-4000-8000-000000000001';
describe('Saved contract PDF download route', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockReset();
    mocks.render.mockReset();
    mocks.prepare.mockReset();
    mocks.share.mockReset();
  });
  it('rejects invalid ids before upstream or renderer access', async () => {
    const r = await GET(new Request('http://web.test'), {
      params: Promise.resolve({ id: '../other' }),
    });
    expect(r.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('retains upstream permission rejection and never renders', async () => {
    mocks.fetch.mockResolvedValue(new Response('', { status: 403 }));
    const r = await GET(new Request('http://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(r.status).toBe(403);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('downloads actual bytes with private attachment headers from saved output', async () => {
    // Route enrichment uses hotel-owned city references; authorization remains upstream.
    mocks.fetch.mockImplementation(async (url: string) =>
      url.includes('/sales/contracts/')
        ? Response.json({ data: printFixture })
        : new Response('', { status: 403 }),
    );
    mocks.render.mockResolvedValue(Buffer.from('%PDF-test'));
    const r = await GET(
      new Request('http://web.test', {
        headers: { cookie: 'nora_access=test-session' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toContain('attachment;');
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(await r.text()).toBe('%PDF-test');
    expect(mocks.render.mock.calls[0]?.[0]).toEqual(printFixture);
    expect(mocks.fetch.mock.calls[0]?.[1].headers.cookie).toBe(
      'nora_access=test-session',
    );
  });
  it('preserves the actual upstream confirmation or access explanation instead of a misleading generic download error', async () => {
    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: 'Synthetic scoped denial' } },
        { status: 403 },
      ),
    );
    const response = await GET(new Request('https://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: 'Synthetic scoped denial',
    });
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('enriches both hotel cities through their actual master records before PDF generation', async () => {
    const saved = structuredClone(printFixture);
    saved.contract.hotelSelection!.additionalStays = [
      {
        hotelId: 'second-hotel',
        hotelNameSnapshot: 'Second',
        cityId: 'stale',
        checkInDate: '2026-10-05',
        checkOutDate: '2026-10-08',
      },
    ];
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/output')) return Response.json({ data: saved });
      if (url.endsWith('/hotels/second-hotel'))
        return Response.json({
          data: {
            name: 'Second',
            attributes: { cityId: 'izmir', englishName: 'SECOND HOTEL' },
          },
        });
      if (url.endsWith('/cities/izmir'))
        return Response.json({
          data: { name: 'ازمیر', attributes: { englishName: 'IZMIR' } },
        });
      return new Response('', { status: 403 });
    });
    mocks.render.mockResolvedValue(Buffer.from('%PDF'));
    const response = await GET(new Request('https://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(mocks.render.mock.calls[0]![1].hotels['second-hotel']).toMatchObject(
      { name: 'SECOND HOTEL', city: 'IZMIR' },
    );
  });
  it('reports unavailable renderer without leaking internal errors', async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.includes('/sales/contracts/')
        ? Response.json({ data: printFixture })
        : new Response('', { status: 403 }),
    );
    mocks.render.mockRejectedValue(new Error('internal-path-secret'));
    const r = await GET(new Request('http://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('internal-path-secret');
  });
  it('uses consumer-scoped country references for international PDF dates', async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/output')) return Response.json({ data: printFixture });
      if (url.endsWith('/selections/sales/cities/tehran'))
        return Response.json({
          data: { name: 'Origin', attributes: { countryId: 'ir' } },
        });
      if (url.endsWith('/selections/sales/cities/antalya'))
        return Response.json({
          data: { name: 'Destination', attributes: { countryId: 'tr' } },
        });
      if (url.endsWith('/selections/sales/countries/ir'))
        return Response.json({ data: { code: 'IR', attributes: {} } });
      if (url.endsWith('/selections/sales/countries/tr'))
        return Response.json({ data: { code: 'TR', attributes: {} } });
      return new Response('', { status: 403 });
    });
    mocks.render.mockResolvedValue(Buffer.from('%PDF-test'));
    const r = await GET(new Request('http://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(r.status).toBe(200);
    expect(mocks.render.mock.calls[0]?.[1]).toMatchObject({
      international: true,
      names: { tehran: 'Origin', antalya: 'Destination' },
    });
    expect(
      mocks.fetch.mock.calls.every(
        ([url]) =>
          !String(url).includes('/master-data/') ||
          String(url).includes('/selections/sales/'),
      ),
    ).toBe(true);
  });
  it('publishes the latest authorized amended output for preview and PDF with the same QR', async () => {
    const saved = {
      ...printFixture,
      contract: { ...printFixture.contract, version: 9 },
    };
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('/output')
        ? Response.json({ data: saved })
        : new Response('', { status: 403 }),
    );
    const share = {
      url: 'https://example.test/d/' + 'a'.repeat(32),
      save: vi.fn(),
    };
    mocks.share.mockReturnValue(share);
    mocks.prepare.mockResolvedValue(
      '<!doctype html><html>amended version 9</html>',
    );
    mocks.render.mockResolvedValue(Buffer.from('%PDF-version9'));
    const preview = await GET(
      new Request('http://web.test?format=share', {
        headers: { cookie: 'nora_access=reader' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toEqual({
      url: share.url,
      html: '<!doctype html><html>amended version 9</html>',
    });
    expect(mocks.prepare).toHaveBeenCalledWith(
      saved,
      expect.objectContaining({ publicDocumentUrl: share.url }),
      'fa',
    );
    expect(share.save).toHaveBeenCalledWith(
      '<!doctype html><html>amended version 9</html>',
    );
    const pdf = await GET(
      new Request('http://web.test', {
        headers: { cookie: 'nora_access=reader' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(pdf.status).toBe(200);
    expect(await pdf.text()).toBe('%PDF-version9');
    expect(mocks.render).toHaveBeenCalledWith(
      saved,
      expect.objectContaining({ publicDocumentUrl: share.url }),
      'fa',
    );
  });
  it.each(['network', 'json', 'missing-data', 'missing-attributes'])(
    'renders the authorized contract when optional hotel references fail (%s)',
    async (failure) => {
      mocks.fetch.mockImplementation(async (url: string) => {
        if (url.endsWith('/output'))
          return Response.json({ data: printFixture });
        if (url.includes('/selections/sales/hotels/')) {
          if (failure === 'network') throw Error('Synthetic reference timeout');
          if (failure === 'json')
            return new Response('<unavailable>', { status: 200 });
          if (failure === 'missing-data') return Response.json({ data: null });
          return Response.json({ data: { name: 'Saved reference' } });
        }
        return new Response('', { status: 403 });
      });
      mocks.render.mockResolvedValue(Buffer.from('%PDF-authorized-contract'));
      const before = structuredClone(printFixture);
      const r = await GET(new Request('http://web.test'), {
        params: Promise.resolve({ id }),
      });
      expect(r.status).toBe(200);
      expect(await r.text()).toBe('%PDF-authorized-contract');
      expect(mocks.render.mock.calls[0]?.[0]).toEqual(before);
      expect(printFixture).toEqual(before);
    },
  );
  it('keeps a share preview available when optional references fail without invoking Chromium', async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/output')) return Response.json({ data: printFixture });
      throw Error('Synthetic optional reference failure');
    });
    const save = vi.fn();
    mocks.share.mockReturnValue({
      url: 'https://example.test/d/' + 'b'.repeat(32),
      save,
    });
    mocks.prepare.mockResolvedValue(
      '<!doctype html><html>authorized saved contract</html>',
    );
    const result = await GET(new Request('http://web.test?format=share'), {
      params: Promise.resolve({ id }),
    });
    expect(result.status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('still rejects unavailable canonical output rather than rendering guessed contract data', async () => {
    mocks.fetch.mockRejectedValue(Error('Synthetic canonical output failure'));
    const result = await GET(new Request('http://web.test'), {
      params: Promise.resolve({ id }),
    });
    expect(result.status).toBe(503);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });
});
