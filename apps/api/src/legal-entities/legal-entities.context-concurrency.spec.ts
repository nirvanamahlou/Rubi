import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegalEntityContextMode } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';

import type { DatabaseService } from '../database/database.service';
import type { DocumentTemplatePolicyPort } from './document-template-policy.port';
import { LegalEntitiesService } from './legal-entities.service';

const actor: AuthenticatedActor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: 'session-1',
  permissions: ['legal-entity.read', 'legal-entity.switch'],
  branchIds: ['branch-1'],
};

const entity = {
  id: '00000000-0000-4000-8000-000000000010',
  code: 'NIYAYESH_SEIR_SAHAR',
  persianName: 'نیایش سیر سحر',
  latinName: null,
  tradeName: null,
  logoFileId: null,
  letterheadFileId: null,
  footerFileId: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  nationalId: null,
  registrationNumber: null,
  economicCode: null,
  paymentText: null,
  sealFileId: null,
  authorizedSignatureId: null,
  primaryColor: null,
  secondaryColor: null,
  legalFooterText: null,
  isActive: true,
  version: 1,
  brandingSnapshotVersion: 1,
  updatedAt: new Date('2026-08-25T00:00:00Z'),
};

interface ContextState {
  userId: string;
  mode: LegalEntityContextMode;
  legalEntityId: string | null;
  version: number;
  updatedAt: Date;
}

function harness(initial: ContextState | null = null) {
  let state = initial;
  const audit = vi.fn().mockResolvedValue({ id: 'audit-1' });
  const contextRow = () =>
    state
      ? {
          ...state,
          legalEntity: state.legalEntityId === entity.id ? entity : null,
        }
      : null;
  const contextRepository = {
    findUnique: vi.fn(async () => contextRow()),
    create: vi.fn(
      async (input: { data: Omit<ContextState, 'version' | 'updatedAt'> }) => {
        await Promise.resolve();
        if (state) throw { code: 'P2002' };
        state = {
          ...input.data,
          version: 1,
          updatedAt: new Date(),
        };
        return contextRow();
      },
    ),
    updateMany: vi.fn(
      async (input: {
        where: { userId: string; version: number };
        data: {
          mode: LegalEntityContextMode;
          legalEntityId: string | null;
        };
      }) => {
        if (
          !state ||
          state.userId !== input.where.userId ||
          state.version !== input.where.version
        )
          return { count: 0 };
        state = {
          ...state,
          mode: input.data.mode,
          legalEntityId: input.data.legalEntityId,
          version: state.version + 1,
          updatedAt: new Date(),
        };
        return { count: 1 };
      },
    ),
    findUniqueOrThrow: vi.fn(async () => {
      const row = contextRow();
      if (!row) throw new Error('missing context');
      return row;
    }),
  };
  const transaction = {
    userLegalEntityContext: contextRepository,
    legalEntityAuditEvent: { create: audit },
  };
  const client = {
    legalEntity: {
      findFirst: vi.fn().mockResolvedValue(entity),
    },
    userLegalEntityContext: contextRepository,
    $transaction: async <T>(
      callback: (value: typeof transaction) => Promise<T>,
    ): Promise<T> => callback(transaction),
  };
  const policies: DocumentTemplatePolicyPort = {
    resolve: vi.fn().mockResolvedValue(null),
  };
  return {
    service: new LegalEntitiesService(
      { client } as unknown as DatabaseService,
      policies,
    ),
    state: () => state,
    audit,
  };
}

describe('legal entity context optimistic concurrency', () => {
  it('returns a virtual initial context at version zero without persisting it', async () => {
    const test = harness();
    await expect(test.service.current(actor)).resolves.toMatchObject({
      data: { selection: 'NIYAYESH_SEIR_SAHAR', version: 0 },
    });
    expect(test.state()).toBeNull();
  });

  it('allows exactly one concurrent initial create and returns 409 for the loser', async () => {
    const test = harness();
    const results = await Promise.allSettled([
      test.service.switch('NIYAYESH_SEIR_SAHAR', 0, actor),
      test.service.switch('NIYAYESH_SEIR_SAHAR', 0, actor),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({ reason: expect.any(ConflictException) });
    expect(test.state()?.version).toBe(1);
    expect(test.audit).toHaveBeenCalledTimes(1);
  });

  it('allows one writer for the same existing version and increments exactly once', async () => {
    const test = harness({
      userId: actor.userId,
      mode: LegalEntityContextMode.SPECIFIC,
      legalEntityId: entity.id,
      version: 7,
      updatedAt: new Date(),
    });
    const results = await Promise.allSettled([
      test.service.switch('NIYAYESH_SEIR_SAHAR', 7, actor),
      test.service.switch('NIYAYESH_SEIR_SAHAR', 7, actor),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(test.state()?.version).toBe(8);
    expect(test.audit).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, negative and stale expected versions', async () => {
    const test = harness({
      userId: actor.userId,
      mode: LegalEntityContextMode.SPECIFIC,
      legalEntityId: entity.id,
      version: 2,
      updatedAt: new Date(),
    });
    await expect(
      test.service.switch(
        'NIYAYESH_SEIR_SAHAR',
        undefined as unknown as number,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      test.service.switch('NIYAYESH_SEIR_SAHAR', -1, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      test.service.switch('NIYAYESH_SEIR_SAHAR', 1, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(test.state()?.version).toBe(2);
  });
});
