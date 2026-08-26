import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { MasterCurrencyRateStatus } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { CurrencyRateService } from './currency-rate.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: ['master_data.currency_rate.approve'],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};

const draft = {
  id: '44444444-4444-4444-8444-444444444444',
  fromCurrencyId: '55555555-5555-4555-8555-555555555555',
  toCurrencyId: '66666666-6666-4666-8666-666666666666',
  rate: '600000',
  rateType: 'REFERENCE',
  source: 'review-test',
  observedAt: new Date('2026-08-26T00:00:00.000Z'),
  validFrom: new Date('2026-08-26T00:00:00.000Z'),
  validTo: null,
  status: MasterCurrencyRateStatus.DRAFT as MasterCurrencyRateStatus,
  version: 1,
  isAuthoritative: false,
  createdByUserId: '77777777-7777-4777-8777-777777777777',
};

function fixture(options?: {
  before?: typeof draft;
  changedCount?: number;
  afterStatus?: MasterCurrencyRateStatus;
}) {
  const after = {
    ...draft,
    status: options?.afterStatus ?? MasterCurrencyRateStatus.APPROVED,
    version: 2,
  };
  const tx = {
    masterDraftExchangeRate: {
      findUnique: vi.fn().mockResolvedValue(options?.before ?? draft),
      updateMany: vi.fn().mockResolvedValue({
        count: options?.changedCount ?? 1,
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(after),
    },
    masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    client: {
      $transaction: vi
        .fn()
        .mockImplementation((operation: (transaction: typeof tx) => unknown) =>
          operation(tx),
        ),
    },
  } as unknown as DatabaseService;
  return { service: new CurrencyRateService(database), tx };
}

describe('CurrencyRateService decisions', () => {
  it.each([
    ['approve', MasterCurrencyRateStatus.APPROVED],
    ['reject', MasterCurrencyRateStatus.REJECTED],
  ] as const)(
    'supports the dedicated %s command with an audit event',
    async (decision, status) => {
      const { service, tx } = fixture({ afterStatus: status });

      await expect(
        service.decide(draft.id, 1, 'review reason', decision, actor),
      ).resolves.toMatchObject({
        data: { id: draft.id, status, version: 2, isAuthoritative: false },
      });
      expect(tx.masterDraftExchangeRate.updateMany).toHaveBeenCalledWith({
        where: {
          id: draft.id,
          version: 1,
          status: MasterCurrencyRateStatus.DRAFT,
        },
        data: expect.objectContaining({ status, version: { increment: 1 } }),
      });
      expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: `master_data.currency_rate.${decision}`,
          resource: 'exchange-rates',
          entityId: draft.id,
          reason: 'review reason',
        }),
      });
    },
  );

  it('rejects a decision after the draft transition', async () => {
    const { service, tx } = fixture({
      before: { ...draft, status: MasterCurrencyRateStatus.APPROVED },
    });

    await expect(
      service.decide(draft.id, 1, 'again', 'reject', actor),
    ).rejects.toMatchObject({
      response: { code: 'CURRENCY_RATE_IMMUTABLE' },
      status: 409,
    });
    expect(tx.masterDraftExchangeRate.updateMany).not.toHaveBeenCalled();
  });

  it('enforces maker-checker separation', async () => {
    const maker = { ...actor, userId: draft.createdByUserId };
    const { service, tx } = fixture();

    await expect(
      service.decide(draft.id, 1, 'self approve', 'approve', maker),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.masterDraftExchangeRate.updateMany).not.toHaveBeenCalled();
  });

  it('returns a stable conflict when the atomic version claim loses', async () => {
    const { service, tx } = fixture({ changedCount: 0 });

    const operation = service.decide(
      draft.id,
      1,
      'concurrent',
      'approve',
      actor,
    );
    await expect(operation).rejects.toBeInstanceOf(ConflictException);
    await expect(operation).rejects.toMatchObject({
      response: { code: 'CONCURRENT_MODIFICATION' },
      status: 409,
    });
    expect(tx.masterDataAuditEvent.create).not.toHaveBeenCalled();
  });
});
