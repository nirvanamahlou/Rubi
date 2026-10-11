import { afterEach, describe, expect, it, vi } from 'vitest';
import { toursApi } from './tours';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn(async () => null),
}));
const input = {
  name: 'Edited tour',
  originId: 'origin',
  destinationId: 'destination',
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
};
afterEach(() => vi.unstubAllGlobals());
describe('tour edit client', () => {
  it('sends definition, branch and expected version to the package PATCH endpoint', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { ...input, id: 'tour', version: 3 } }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await toursApi.updatePackage('tour', input, 2, 'branch');
    expect(result.data.version).toBe(3);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/tours/packages/tour',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({ 'x-branch-id': 'branch' }),
        body: JSON.stringify({ ...input, expectedVersion: 2 }),
      }),
    );
  });
  it('sends a branch-scoped DELETE with the expected version', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'tour', deleted: true } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(toursApi.deletePackage('tour', 4, 'branch')).resolves.toEqual({
      data: { id: 'tour', deleted: true },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/tours/packages/tour',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        headers: expect.objectContaining({ 'x-branch-id': 'branch' }),
        body: JSON.stringify({ expectedVersion: 4 }),
      }),
    );
  });
  it('archives an offer with its optimistic version', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'offer' } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(toursApi.archiveOffer('offer', 7)).resolves.toEqual({
      data: { id: 'offer' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/offers/offer',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        body: JSON.stringify({ expectedVersion: 7 }),
      }),
    );
  });
  it('sends all load rows to the atomic batch archive endpoint', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { ids: ['one', 'two'] } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetch);
    await toursApi.archiveOfferBatch([
      { id: 'one', expectedVersion: 2 },
      { id: 'two', expectedVersion: 5 },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/offers/batch',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          items: [
            { id: 'one', expectedVersion: 2 },
            { id: 'two', expectedVersion: 5 },
          ],
        }),
      }),
    );
  });
  it('sends all edited load rows to the batch revision endpoint', async () => {
    const offer = {
      originId: 'origin',
      destinationId: 'destination',
      departureAt: '2099-01-01T08:00:00.000Z',
      arrivalAt: '2099-01-01T10:00:00.000Z',
      carrierName: 'Carrier',
      serviceNumber: '100',
      cabinClassCode: 'ECONOMY' as const,
      totalCapacity: 20,
    };
    const items = [{ id: 'one', expectedVersion: 2, offer }];
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { items: [{ id: 'one', version: 3 }] } }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await toursApi.reviseOfferBatch(items);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/offers/batch',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ items }),
      }),
    );
  });
  it('sends the current load and regenerated rows to the resize endpoint', async () => {
    const offer = {
      originId: 'origin',
      destinationId: 'destination',
      departureAt: '2099-01-01T08:00:00.000Z',
      arrivalAt: '2099-01-01T10:00:00.000Z',
      carrierName: 'Carrier',
      serviceNumber: '100',
      cabinClassCode: 'ECONOMY' as const,
      totalCapacity: 20,
    };
    const current = [{ id: 'one', expectedVersion: 2 }];
    const offers = [
      offer,
      { ...offer, departureAt: '2099-01-08T08:00:00.000Z' },
    ];
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              items: [],
              createdIds: ['two'],
              archivedIds: [],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await toursApi.resizeOfferBatch(current, offers);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/ticket-catalog/offers/batch/resize',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ current, offers }),
      }),
    );
  });
  it('surfaces a stale-version conflict to keep the editor open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'نسخه تور تغییر کرده است' }), {
            status: 409,
          }),
      ),
    );
    await expect(
      toursApi.updatePackage('tour', input, 2, 'branch'),
    ).rejects.toThrow('نسخه تور تغییر کرده است');
  });
  it('surfaces a branch/permission error without inventing a saved result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: 'مجوز ویرایش ندارید' } }),
            { status: 403 },
          ),
      ),
    );
    await expect(
      toursApi.updatePackage('tour', input, 2, 'branch'),
    ).rejects.toThrow('مجوز ویرایش ندارید');
  });
});
