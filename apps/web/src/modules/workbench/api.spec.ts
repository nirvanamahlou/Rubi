import type { LoginResponse } from '@rubi/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notificationsApi,
  notifyNotificationFeedChanged,
} from '@/modules/notifications/api/client';
import { ProfileUnauthorizedError } from '@/modules/profile/api/client';
import { loadWorkbenchHome, markWorkbenchNotificationRead } from './api';

vi.mock('@/modules/notifications/api/client', () => ({
  notificationsApi: { list: vi.fn(), markRead: vi.fn() },
  notifyNotificationFeedChanged: vi.fn(),
}));
const identity: LoginResponse = {
  user: {
    id: 'user-1',
    username: 'test-user',
    displayName: 'کاربر آزمون',
    email: null,
    branches: [],
    permissions: ['documents.metadata.read'],
  },
};
function dependencies() {
  return {
    identity: vi.fn().mockResolvedValue(identity),
    notifications: vi
      .fn()
      .mockResolvedValue({ data: [], meta: { unreadCount: 7, limit: 50 } }),
    documents: vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, total: 12, totalPages: 2 },
    }),
  };
}
describe('native workbench owner services', () => {
  beforeEach(() => vi.clearAllMocks());
  it('does not request personal data without an authenticated identity', async () => {
    const deps = dependencies();
    deps.identity.mockResolvedValue(null);
    await expect(loadWorkbenchHome(deps)).rejects.toBeInstanceOf(
      ProfileUnauthorizedError,
    );
    expect(deps.notifications).not.toHaveBeenCalled();
    expect(deps.documents).not.toHaveBeenCalled();
  });
  it('uses server-scoped personal files and actual notification counts', async () => {
    const deps = dependencies();
    const result = await loadWorkbenchHome(deps);
    expect(deps.notifications).toHaveBeenCalledWith(50);
    expect(deps.documents).toHaveBeenCalledWith({
      personalView: 'OWNED',
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(result.notifications).toMatchObject({
      status: 'ready',
      data: { meta: { unreadCount: 7 } },
    });
    expect(result.documents).toMatchObject({
      status: 'ready',
      data: { meta: { total: 12 } },
    });
  });
  it('does not request files without document permission', async () => {
    const deps = dependencies();
    deps.identity.mockResolvedValue({
      user: { ...identity.user, permissions: [] },
    });
    expect((await loadWorkbenchHome(deps)).documents).toEqual({
      status: 'forbidden',
    });
    expect(deps.documents).not.toHaveBeenCalled();
  });
  it('preserves an owner failure instead of reporting an empty collection', async () => {
    const deps = dependencies();
    deps.notifications.mockRejectedValue(new Error('offline'));
    const result = await loadWorkbenchHome(deps);
    expect(result.notifications).toEqual({
      status: 'error',
      message: 'offline',
    });
    expect(result.documents.status).toBe('ready');
  });
  it('keeps a forbidden file response distinct from missing files', async () => {
    const deps = dependencies();
    deps.documents.mockRejectedValue({ status: 403 });
    expect((await loadWorkbenchHome(deps)).documents).toEqual({
      status: 'forbidden',
    });
  });
  it('only announces read-state changes after a successful owner mutation', async () => {
    vi.mocked(notificationsApi.markRead).mockRejectedValueOnce(
      new Error('denied'),
    );
    await expect(
      markWorkbenchNotificationRead('notification-1'),
    ).rejects.toThrow('denied');
    expect(notifyNotificationFeedChanged).not.toHaveBeenCalled();
    vi.mocked(notificationsApi.markRead).mockResolvedValueOnce({
      data: { updatedCount: 1 },
    });
    await markWorkbenchNotificationRead('notification-1');
    expect(notificationsApi.markRead).toHaveBeenCalledWith('notification-1');
    expect(notifyNotificationFeedChanged).toHaveBeenCalledOnce();
  });
});
