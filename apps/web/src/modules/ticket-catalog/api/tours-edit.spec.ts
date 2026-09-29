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
