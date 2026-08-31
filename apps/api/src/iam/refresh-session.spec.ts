import { createHash } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { SessionStatus, UserStatus } from '@rubi/database';
import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';

import { IamService } from './iam.service';

describe('IAM refresh concurrency', () => {
  it('does not revoke the session family for a just-rotated matching token', async () => {
    const secret = 'shared-browser-refresh-secret';
    const session = {
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      familyId: '33333333-3333-4333-8333-333333333333',
      refreshTokenHash: createHash('sha256')
        .update(secret, 'utf8')
        .digest('hex'),
      status: SessionStatus.ROTATED,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      revokedReason: 'rotated',
      user: { status: UserStatus.ACTIVE },
    };
    const updateMany = vi.fn();
    const audit = vi.fn().mockResolvedValue({});
    const client = {
      session: {
        findUnique: vi.fn().mockResolvedValue(session),
        updateMany,
      },
      auditEvent: { create: audit },
    };
    const service = new IamService(
      { client } as unknown as DatabaseService,
      {} as JwtService,
    );

    const failure = await service
      .refresh(`${session.id}.${secret}`, {})
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ConflictException);
    expect((failure as ConflictException).getStatus()).toBe(409);
    expect(updateMany).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.refresh.concurrent' }),
      }),
    );
  });
});
