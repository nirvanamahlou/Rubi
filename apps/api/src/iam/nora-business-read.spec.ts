import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { hasNoraGlobalBusinessRead } from './nora-business-read';

const danial = '00000000-0000-4000-8000-000000000001';
const demo = '00000000-0000-4000-8000-000000000002';
const config = {
  NORA_DANIAL_BUSINESS_READ_USER_ID: danial,
  NORA_DEMO_BUSINESS_READ_USER_ID: demo,
};
const actor = (userId: string) => ({
  userId,
  sessionId: 'session',
  branchIds: [],
  permissions: [],
});

describe('Nora organization-wide business-read grant', () => {
  it.each([
    [danial, 'danial'],
    [demo, 'demo'],
  ])(
    'requires the configured ID and active canonical account for %s',
    async (id, username) => {
      const findFirst = vi.fn().mockResolvedValue({ id });
      const db = { user: { findFirst } } as unknown as DatabaseClient;
      await expect(
        hasNoraGlobalBusinessRead(db, actor(id), config),
      ).resolves.toBe(true);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id, username, status: 'ACTIVE' },
        select: { id: true },
      });
      findFirst.mockResolvedValue(null);
      await expect(
        hasNoraGlobalBusinessRead(db, actor(id), config),
      ).resolves.toBe(false);
    },
  );

  it('ignores unconfigured, malformed and unrelated IDs without consulting users', async () => {
    const findFirst = vi.fn();
    const db = { user: { findFirst } } as unknown as DatabaseClient;
    await expect(
      hasNoraGlobalBusinessRead(db, actor(danial), {}),
    ).resolves.toBe(false);
    await expect(
      hasNoraGlobalBusinessRead(db, actor('danial'), {
        NORA_DANIAL_BUSINESS_READ_USER_ID: 'danial',
      }),
    ).resolves.toBe(false);
    await expect(
      hasNoraGlobalBusinessRead(
        db,
        actor('00000000-0000-4000-8000-000000000003'),
        config,
      ),
    ).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
