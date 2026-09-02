import type { JwtService } from '@nestjs/jwt';
import type { DatabaseService } from '../database/database.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IamService } from './iam.service';

const { passwordHash } = vi.hoisted(() => ({ passwordHash: vi.fn() }));

vi.mock('argon2', () => ({
  hash: passwordHash,
  verify: vi.fn(),
}));

describe('administrator bootstrap safety', () => {
  beforeEach(() => {
    passwordHash.mockReset();
  });

  it('does not hash or overwrite credentials for an existing administrator', async () => {
    const existing = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'nirvana',
    };
    const client = {
      role: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-id' }) },
      branch: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'branch-id' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(existing),
        upsert: vi.fn(),
      },
      userRole: { upsert: vi.fn().mockResolvedValue({}) },
      userBranch: { upsert: vi.fn().mockResolvedValue({}) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new IamService(
      { client } as unknown as DatabaseService,
      {} as JwtService,
    );

    await expect(
      service.bootstrapAdministrator(
        'Nirvana',
        undefined,
        'Different-Password-2026!',
        'Nirvana',
      ),
    ).resolves.toBe(existing.id);

    expect(passwordHash).not.toHaveBeenCalled();
    expect(client.user.upsert).not.toHaveBeenCalled();
    expect(client.userRole.upsert).toHaveBeenCalledOnce();
    expect(client.userBranch.upsert).toHaveBeenCalledOnce();
  });
});
