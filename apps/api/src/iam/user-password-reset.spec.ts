import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { verify } from 'argon2';
import { IamService } from './iam.service';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: 'session',
  permissions: ['iam.users.manage'] as never[],
  branchIds: [],
};
const targetId = '00000000-0000-4000-8000-000000000002';
const password = 'New-Synthetic-2026!';
function fixture() {
  const administrator = {
    status: 'ACTIVE',
    roles: [{ role: { code: 'administrator' } }],
  };
  const tx = {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          where.id === actor.userId ? administrator : { id: targetId },
        ),
      update: vi.fn(),
    },
    session: {
      findFirst: vi.fn().mockResolvedValue({ id: 'session' }),
      updateMany: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  };
  const client = {
    ...tx,
    $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)),
  };
  const service = new IamService({ client } as never, {} as never, {} as never);
  return { service, client, tx, administrator };
}
describe('administrator password reset', () => {
  it('hashes the new credential, revokes only target sessions and audits without credential data', async () => {
    const f = fixture();
    await f.service.resetUserPassword(targetId, password, actor, {
      ipAddress: '127.0.0.1',
    });
    const write = f.tx.user.update.mock.calls[0]![0];
    expect(write.where).toEqual({ id: targetId });
    expect(await verify(write.data.passwordHash, password)).toBe(true);
    expect(await verify(write.data.passwordHash, 'Old-Synthetic-2026!')).toBe(
      false,
    );
    expect(write.data.failedLoginAttempts).toBe(0);
    expect(write.data.lockedUntil).toBeNull();
    expect(f.tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      actor.userId,
      targetId,
    ]);
    expect(f.tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: targetId, status: { in: ['ACTIVE', 'ROTATED'] } },
        data: expect.objectContaining({
          status: 'REVOKED',
          revokedReason: 'administrator-password-reset',
        }),
      }),
    );
    expect(f.tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actor.userId,
        entityId: targetId,
        action: 'iam.user.password.reset',
        outcome: 'SUCCESS',
      }),
    });
    expect(JSON.stringify(f.tx.auditEvent.create.mock.calls)).not.toContain(
      password,
    );
    expect(JSON.stringify(f.tx.auditEvent.create.mock.calls)).not.toContain(
      write.data.passwordHash,
    );
  });
  it('rejects user-management permission without canonical administrator membership', async () => {
    const f = fixture();
    f.administrator.roles = [{ role: { code: 'personal-access-manager' } }];
    await expect(
      f.service.resetUserPassword(targetId, password, actor, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('rejects missing operation permission even for an administrator', async () => {
    const f = fixture();
    await expect(
      f.service.resetUserPassword(
        targetId,
        password,
        { ...actor, permissions: [] },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.user.update).not.toHaveBeenCalled();
  });
  it('rechecks active administrator membership inside the transaction', async () => {
    const f = fixture();
    f.tx.user.findUnique
      .mockResolvedValueOnce(f.administrator)
      .mockResolvedValueOnce({
        status: 'INACTIVE',
        roles: f.administrator.roles,
      });
    await expect(
      f.service.resetUserPassword(targetId, password, actor, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.user.update).not.toHaveBeenCalled();
  });
  it('rejects revoked or expired actor sessions without writing credentials', async () => {
    const f = fixture();
    f.tx.session.findFirst.mockResolvedValue(null);
    await expect(
      f.service.resetUserPassword(targetId, password, actor, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.tx.user.update).not.toHaveBeenCalled();
  });
  it('rejects a missing target and self reset', async () => {
    const f = fixture();
    await expect(
      f.service.resetUserPassword(actor.userId, password, actor, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    f.tx.user.findUnique.mockImplementation(async ({ where }) =>
      where.id === actor.userId ? f.administrator : null,
    );
    await expect(
      f.service.resetUserPassword(targetId, password, actor, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(f.tx.user.update).not.toHaveBeenCalled();
  });
  it.each([
    'weak',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoNumbersPassword!',
    'NoSymbolsPassword123',
  ])('rejects invalid password %s', async (invalid) => {
    const f = fixture();
    await expect(
      f.service.resetUserPassword(targetId, invalid, actor, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('propagates audit failure from the same password/revocation transaction', async () => {
    const f = fixture();
    f.tx.auditEvent.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(
      f.service.resetUserPassword(targetId, password, actor, {}),
    ).rejects.toThrow('audit unavailable');
    expect(f.client.$transaction).toHaveBeenCalledOnce();
  });
});
