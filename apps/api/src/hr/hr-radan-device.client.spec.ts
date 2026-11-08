import { afterEach, describe, it, expect, vi } from 'vitest';
import { RadanDeviceClient } from './hr-radan-device.client';
afterEach(() => vi.unstubAllGlobals());
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
describe('Radan API pagination', () => {
  it('uses actual counts and zero-based pages even when Next is null and the page is shorter than limit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: 'synthetic' }))
      .mockResolvedValueOnce(
        json({
          data: { users: [{ id: 1 }, { id: 2 }] },
          meta: { total: 4, Next: null, total_in_page: 500 },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: { users: [{ id: 3 }, { id: 4 }] },
          meta: { total: 4, Next: null },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const client = new RadanDeviceClient(
      'http://127.0.0.1:3333',
      'test',
      'test',
    );
    await client.login();
    expect(await client.list('/V1/Users', 'users')).toHaveLength(4);
    expect(fetch.mock.calls[2]![0]).toContain('page=1');
    expect(fetch.mock.calls[1]![1].redirect).toBe('error');
  });
  it('rejects repeated pages rather than looping or duplicating data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () =>
          json({ data: { users: [{ id: 1 }] }, meta: { total: 4 } }),
        ),
    );
    await expect(
      new RadanDeviceClient('http://127.0.0.1:3333', 'test', 'test').list(
        '/V1/Users',
        'users',
      ),
    ).rejects.toThrow('Repeated');
  });
  it('rejects premature empty pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(json({ data: { users: [] }, meta: { total: 4 } })),
    );
    await expect(
      new RadanDeviceClient('http://127.0.0.1:3333', 'test', 'test').list(
        '/V1/Users',
        'users',
      ),
    ).rejects.toThrow('Incomplete');
  });
  it('refreshes token once and stops on a repeated unauthorized response', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: 'fresh' }))
      .mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal('fetch', fetch);
    await expect(
      new RadanDeviceClient('http://127.0.0.1:3333', 'test', 'test').list(
        '/V1/Users',
        'users',
      ),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('bounded newest-first reads', () => {
  it('stops only after crossing the inclusive source date boundary', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          data: {
            clockings: [
              { id: 1, datetime: '2026-11-08 09:15:00' },
              { id: 2, datetime: '2026-11-07 09:15:00' },
            ],
          },
          meta: { total: 1500 },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            clockings: [
              { id: 3, datetime: '2026-11-07 08:15:00' },
              { id: 4, datetime: '2026-11-06 09:15:00' },
            ],
          },
          meta: { total: 1500 },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(
      await new RadanDeviceClient('http://localhost', 'test', 'test').list(
        '/V1/Ta/Clockings',
        'clockings',
        '2026-11-07',
      ),
    ).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('falls back to a complete read when ordering is incompatible', async () => {
    const rows = [
      { id: 1, datetime: '2026-11-06 09:15:00' },
      { id: 2, datetime: '2026-11-08 09:15:00' },
    ];
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        json({ data: { clockings: rows }, meta: { total: 2 } }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(
      await new RadanDeviceClient('http://localhost', 'test', 'test').list(
        '/V1/Ta/Clockings',
        'clockings',
        '2026-11-07',
      ),
    ).toEqual(rows);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
