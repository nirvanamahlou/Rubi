import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  HR_CONNECTION_TARGETS,
  type AuthenticatedActor,
} from '@nora/contracts';
import {
  assertHrConnectionTransition,
  canSendHrConnection,
  hrReceivingTargets,
  HrConnectionsService,
} from './hr-connections.service';
import type { DatabaseService } from '../database/database.service';
const actor = (
  permissions: AuthenticatedActor['permissions'],
): AuthenticatedActor => ({
  userId: 'u',
  sessionId: 's',
  branchIds: ['b'],
  permissions,
});
describe('HR referral authorization and lifecycle', () => {
  it('rejects impossible dates and caller-supplied execution claims before persistence', async () => {
    const service = new HrConnectionsService({} as DatabaseService);
    const sender = actor(['hr.manage', 'hr.approve', 'hr.sensitive']);
    const input = {
      target: 'finance',
      sourceId: '00000000-0000-4000-8000-000000000001',
      sourceVersion: 1,
      title: 'Review',
      message: 'Synthetic',
      dueAt: '2099-02-30T12:00:00Z',
    };
    await expect(service.create(input, 'test-key-001', sender)).rejects.toThrow(
      'مهلت',
    );
    await expect(
      service.create({ ...input, paid: true }, 'test-key-002', sender),
    ).rejects.toThrow('ناشناخته');
  });
  it('requires explicit sharing authority and never derives receiving access from HR management', () => {
    expect(canSendHrConnection(actor(['hr.manage', 'hr.approve']))).toBe(false);
    const sender = actor(['hr.manage', 'hr.approve', 'hr.sensitive']);
    expect(canSendHrConnection(sender)).toBe(true);
    expect(hrReceivingTargets(sender)).toEqual([]);
    expect(
      hrReceivingTargets(actor(['hr.connections.finance.receive'])),
    ).toEqual(['finance']);
  });
  it.each(HR_CONNECTION_TARGETS)(
    'scopes the receiving permission to %s',
    (target) => {
      expect(
        hrReceivingTargets(actor([`hr.connections.${target}.receive`])),
      ).toEqual([target]);
    },
  );
  it('requires review before answering and prevents reopening or pretending to pay', () => {
    expect(() =>
      assertHrConnectionTransition('SUBMITTED', 'IN_REVIEW'),
    ).not.toThrow();
    expect(() =>
      assertHrConnectionTransition('IN_REVIEW', 'ANSWERED'),
    ).not.toThrow();
    for (const [before, after] of [
      ['SUBMITTED', 'ANSWERED'],
      ['ANSWERED', 'IN_REVIEW'],
      ['REJECTED', 'ANSWERED'],
      ['IN_REVIEW', 'PAID'],
    ]) {
      expect(() => assertHrConnectionTransition(before!, after!)).toThrow();
    }
  });
});

describe('Finance referral projection', () => {
  const recipient = actor(['hr.connections.finance.receive']);
  const referral = {
    id: 'referral',
    code: 'HR-1',
    branchId: 'b',
    tab: 'finance',
    status: 'IN_REVIEW',
    version: 1,
    createdAt: new Date('2026-11-10T00:00:00Z'),
    employee: { userId: 'employee' },
    data: {
      title: 'Shared title',
      message: 'Shared message',
      employeeLabel: 'Employee',
      requesterUserId: 'sender',
      dueAt: '2026-11-11T00:00:00Z',
      response: null,
    },
  };

  function fixture(rows: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(rows);
    const create = vi.fn().mockResolvedValue({});
    const service = new HrConnectionsService({
      client: { hrRecord: { findMany }, hrAuditEvent: { create } },
    } as unknown as DatabaseService);
    return { service, findMany, create };
  }

  it('loads only the scoped finance projection and preserves response eligibility', async () => {
    const { service, findMany, create } = fixture([
      referral,
      { ...referral, data: { ...referral.data, requesterUserId: 'u' } },
      { ...referral, employee: { userId: 'u' } },
      { ...referral, status: 'ANSWERED' },
    ]);
    const items = await service.readFinanceInbox(recipient);

    expect(items.map((item) => item.canRespond)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(items[0]).toMatchObject({ id: 'referral', title: 'Shared title' });
    expect(items[0]).not.toHaveProperty('history');
    expect(findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              section: 'connections',
              branchId: { in: ['b'] },
              deletedAt: null,
              tab: { in: ['finance'] },
            },
            { tab: 'finance' },
          ],
        },
        select: expect.objectContaining({
          employee: { select: { userId: true } },
        }),
      }),
    );
    expect(findMany.mock.calls[0]?.[0].select).not.toHaveProperty(
      'auditEvents',
    );
    expect(create).toHaveBeenCalledExactlyOnceWith({
      data: {
        branchId: 'b',
        actorId: 'u',
        action: 'connection.list.read',
        changes: { target: 'finance', count: 4, page: 1 },
      },
    });
  });

  it('rejects unauthorized or incomplete reads before writing the audit event', async () => {
    const { service, findMany, create } = fixture(Array(25_001).fill(referral));
    await expect(service.readFinanceInbox(actor([]))).rejects.toMatchObject({
      status: 403,
    });
    expect(findMany).not.toHaveBeenCalled();
    await expect(service.readFinanceInbox(recipient)).rejects.toMatchObject({
      status: 409,
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('HR inbox forwarding', () => {
  const source = {
    id: 'request',
    branchId: 'b',
    version: 1,
    code: 'HR-1',
    title: 'Synthetic',
    native: false,
  };
  const sender = actor(['hr.manage', 'hr.approve', 'hr.sensitive']);

  it('denies forwarding outside the source branch or without sharing authority', async () => {
    const service = new HrConnectionsService({} as DatabaseService);
    await expect(
      service.forwardInbox(source, {}, '', actor(['hr.manage'])),
    ).rejects.toThrow('مجوز');
    await expect(
      service.forwardInbox({ ...source, branchId: 'other' }, {}, '', sender),
    ).rejects.toThrow('مجوز');
  });

  it('queries personal referrals by both recipient and allowed branch', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new HrConnectionsService({
      client: { hrRecord: { findMany } },
    } as unknown as DatabaseService);
    await expect(service.inboxForwardedToUser(actor([]))).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: ['b'] },
          data: { path: ['recipientUserId'], equals: 'u' },
        }),
      }),
    );
  });
});
