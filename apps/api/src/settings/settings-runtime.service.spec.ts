import { describe, expect, it, vi } from 'vitest';

import { SettingsRuntimeService } from './settings-runtime.service';

function setup(rows: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const service = new SettingsRuntimeService({
    client: { systemSetting: { findMany } },
  } as never);
  return { service, findMany };
}

describe('SettingsRuntimeService', () => {
  it('resolves the most specific active scope in the shared order', async () => {
    const { service, findMany } = setup([
      {
        scopeKey: 'GLOBAL',
        scope: 'GLOBAL',
        scopeId: null,
        activeVersion: 1,
        versions: [{ value: { first: 120 }, version: 1 }],
      },
      {
        scopeKey: 'BRANCH:branch-1',
        scope: 'BRANCH',
        scopeId: 'branch-1',
        activeVersion: 2,
        versions: [{ value: { first: 60 }, version: 2 }],
      },
    ]);

    await expect(
      service.resolve('affairs', 'sla', {
        branchId: 'branch-1',
      }),
    ).resolves.toEqual({
      value: { first: 60 },
      version: 2,
      scope: 'BRANCH',
      scopeId: 'branch-1',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scopeKey: {
            in: ['BRANCH:branch-1', 'GLOBAL'],
          },
        }),
      }),
    );
  });

  it('returns a safe fallback when no active setting is published', async () => {
    const { service } = setup([]);
    await expect(
      service.json('documents', 'upload', {}, { size: 20 }),
    ).resolves.toEqual({
      value: { size: 20 },
      version: 0,
      scope: 'GLOBAL',
      scopeId: null,
    });
  });
});
