import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CALL_CENTER_SALES_EXPERT,
  CALL_CENTER_SALES_MANAGER,
  type AuthenticatedActor,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import type { DatabaseService } from '../database/database.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import type { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { CallCenterReadService } from './call-center-read.service';
import type { CallCenterWorkflowService } from './call-center-workflow.service';
import type { CallCenterService } from './call-center.service';
import type { CallCenterCrypto } from './call-center.crypto';
import { CallCenterSearchDto } from './call-center-search.dto';

const actor: AuthenticatedActor = {
  userId: '10000000-0000-4000-8000-000000000001',
  sessionId: 'synthetic-session',
  branchIds: ['10000000-0000-4000-8000-000000000002'],
  permissions: [...CALL_CENTER_SALES_EXPERT],
};

function fixture() {
  const aggregate = vi.fn(async () => ({
    _count: 0,
    _max: { updatedAt: null },
  }));
  const tx = {
    $queryRaw: vi.fn(async () => []),
    callCenterCall: {
      aggregate,
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
    },
    customerAffairsTicket: { aggregate },
    callCenterTelephonySession: { aggregate },
    customerAffairsAuditEvent: { aggregate },
    automationTask: { aggregate, count: vi.fn(async () => 0) },
    user: { findFirst: vi.fn(async () => ({ id: actor.userId })) },
    branch: {
      findMany: vi.fn(async () => actor.branchIds.map((id) => ({ id }))),
    },
  };
  const db = {
    client: {
      ...tx,
      $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
    },
  } as unknown as DatabaseService;
  const scope = vi.fn(() => actor.branchIds[0]);
  const sql = vi.fn(async () => Prisma.sql`TRUE`);
  const service = new CallCenterReadService(
    db,
    {
      scope,
      access: { sql, callWhere: vi.fn(async () => ({})) },
    } as unknown as CallCenterWorkflowService,
    {} as CallCenterService,
    { fingerprint: () => 'revision' } as unknown as CallCenterCrypto,
    {} as IamWorkbenchRequestDirectory,
  );
  return { service, directory: new IamCallCenterDirectory(db), scope, sql };
}

afterEach(() => vi.unstubAllEnvs());

describe('missed callback request capability', () => {
  it.each([
    ['expert', CALL_CENTER_SALES_EXPERT, false],
    ['manager', CALL_CENTER_SALES_MANAGER, true],
    [
      'team permission alone',
      ['customer_affairs.call_center.workflow.manage.team'],
      false,
    ],
  ] as const)(
    'returns %s capability from the effective actor',
    async (_name, permissions, expected) => {
      const { service, scope, sql } = fixture();
      const effective = {
        ...actor,
        permissions: [...permissions],
      } as AuthenticatedActor;
      const result = await service.missedCallbacks(
        effective,
        actor.branchIds[0],
        new CallCenterSearchDto(),
      );
      expect(result.meta.canCreateRequest).toBe(expected);
      expect(scope).toHaveBeenCalledWith(effective, actor.branchIds[0]);
      expect(sql).toHaveBeenCalledWith(
        effective,
        actor.branchIds[0],
        'contacts',
        expect.anything(),
        true,
      );
    },
  );

  it('uses verified global account enrichment while leaving browser permissions unchanged', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    vi.stubEnv('CALL_CENTER_GLOBAL_USER_IDS', actor.userId);
    const { service, directory } = fixture();
    expect(actor.permissions).not.toContain(
      'customer_affairs.call_center.workflow.manage.team',
    );
    const effective = await directory.callCenterActor(actor);
    const result = await service.missedCallbacks(
      effective,
      actor.branchIds[0],
      new CallCenterSearchDto(),
    );
    expect(result.meta.canCreateRequest).toBe(true);
    expect(actor.permissions).not.toContain(
      'customer_affairs.call_center.workflow.manage.team',
    );
  });
});
