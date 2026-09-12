import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.local/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));
import { workbenchPersonalApi } from './workbench-personal-api';
import { normalizeWorkbenchTab } from './model';

afterEach(() => vi.unstubAllGlobals());
describe('performance client', () => {
  it('uses the authenticated no-cache self endpoint with a date range, not an employee ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ generatedAt: 'now' }),
        }),
    );
    expect(await workbenchPersonalApi.performance('90')).toEqual({
      generatedAt: 'now',
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.local/api/v1/workbench/performance?days=90',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(normalizeWorkbenchTab('performance')).toBe('performance');
  });
  it('reports authentication failure instead of displaying empty or cached figures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: 'نشست منقضی شده است' }),
        }),
    );
    await expect(workbenchPersonalApi.performance('30')).rejects.toThrow(
      'نشست منقضی شده است',
    );
  });
});
