import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTourTypeActorNames } from './tour-type-actors';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('tour actor names via public IAM', () => {
  it('retains only id and display name from the authorized endpoint', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 'test-user',
            displayName: 'کاربر آزمون',
            email: 'fixture@example.invalid',
            roles: [],
          },
        ],
      });
    vi.stubGlobal('fetch', fetcher);
    expect(await loadTourTypeActorNames()).toEqual({
      'test-user': 'کاربر آزمون',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/iam/users',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
  it.each([401, 403, 500])(
    'does not bypass permission or fail the tour list on HTTP %s',
    async (status) => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
      const json = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status, json }),
      );
      expect(await loadTourTypeActorNames()).toEqual({});
      expect(json).not.toHaveBeenCalled();
    },
  );
  it('tolerates missing configuration without making a request', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await loadTourTypeActorNames()).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });
});
