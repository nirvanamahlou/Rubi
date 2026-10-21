import { beforeEach, describe, it, expect, vi } from 'vitest';
import { GET } from '../../../app/sales/contracts/[id]/pdf/route';
import { printFixture } from './contract-print.fixture';
const mocks = vi.hoisted(() => ({ render: vi.fn(), fetch: vi.fn() }));
vi.mock('../server/contract-pdf', () => ({ renderContractPdf: mocks.render }));
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
});
