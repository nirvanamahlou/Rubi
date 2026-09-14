import { ConflictException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import { IamService } from './iam.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
};

function service(client: Record<string, unknown>) {
  return new IamService({ client } as never, {} as never, {} as never);
}

describe('IamService personal profile owner boundary', () => {
  it('updates identity, profile extension and audit atomically', async () => {
    const now = new Date('2026-09-12T18:00:00.000Z');
    const transaction = {
      user: {
        update: vi.fn().mockResolvedValue({
          id: actor.userId,
          displayName: 'کاربر نورا',
          email: 'person@example.com',
        }),
      },
      iamUserProfile: {
        upsert: vi.fn().mockResolvedValue({
          userId: actor.userId,
          phone: '09120000000',
          photoDocumentId: null,
          updatedAt: now,
        }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const run = vi.fn(async (operation: (tx: typeof transaction) => unknown) =>
      operation(transaction),
    );

    const result = await service({ $transaction: run }).updateOwnProfile(
      actor,
      {
        displayName: ' کاربر نورا ',
        email: 'PERSON@EXAMPLE.COM',
        phone: '09120000000',
        photoDocumentId: null,
      },
    );

    expect(run).toHaveBeenCalledOnce();
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: actor.userId },
        data: { displayName: 'کاربر نورا', email: 'person@example.com' },
      }),
    );
    expect(transaction.iamUserProfile.upsert).toHaveBeenCalledOnce();
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actor.userId,
        action: 'iam.profile.update',
      }),
    });
    expect(result.profile.phone).toBe('09120000000');
  });

  it('maps duplicate email failures to a stable conflict response', async () => {
    const run = vi.fn().mockRejectedValue({ code: 'P2002' });
    await expect(
      service({ $transaction: run }).updateOwnProfile(actor, {
        displayName: 'کاربر نورا',
        email: 'used@example.com',
        phone: null,
        photoDocumentId: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
