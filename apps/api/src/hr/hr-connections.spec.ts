import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  HR_CONNECTION_TARGETS,
  type AuthenticatedActor,
} from '@rubi/contracts';
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
