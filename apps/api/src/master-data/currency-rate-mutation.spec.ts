import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { CurrencyRateService } from './currency-rate.service';
import {
  CurrencyRateUpdateDto,
  CurrencyRateVersionDto,
} from './currency-rate.dto';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [
    'master_data.update',
    'master_data.delete',
    'master_data.currency_rate.create',
  ],
};
const id = '44444444-4444-4444-8444-444444444444';
const before = {
  id,
  fromCurrencyId: 'usd',
  toCurrencyId: 'irr',
  rate: '270000',
  source: 'manual',
  observedAt: new Date(),
  validFrom: new Date(),
  validTo: null,
  rateType: 'BUY',
  status: 'APPROVED',
  isActive: true,
  isAuthoritative: false,
  version: 1,
};
function setup(options: { inactive?: boolean; count?: number } = {}) {
  const after = { ...before, version: 2 };
  const tx = {
    masterDraftExchangeRate: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ ...before, isActive: !options.inactive }),
      updateMany: vi.fn().mockImplementation(async ({ data }) => {
        Object.assign(after, data, { version: 2 });
        return { count: options.count ?? 1 };
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(after),
    },
    masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn().mockImplementation((fn) => fn(tx));
  return {
    tx,
    transaction,
    service: new CurrencyRateService({
      client: { $transaction: transaction },
    } as unknown as DatabaseService),
  };
}
describe('reference rate mutations', () => {
  it('updates exact amount with CAS and immutable actor/branch audit without modifying pair/status/time', async () => {
    const { service, tx } = setup();
    await service.mutate(
      id,
      { expectedVersion: 1, rate: '280000.1234567890' },
      'update',
      actor,
    );
    expect(tx.masterDraftExchangeRate.updateMany).toHaveBeenCalledWith({
      where: { id, version: 1, isActive: true, isAuthoritative: false },
      data: {
        rate: '280000.1234567890',
        updatedByUserId: actor.userId,
        version: { increment: 1 },
      },
    });
    expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'master_data.update',
        actorUserId: actor.userId,
        actorBranchId: actor.branchIds[0],
        beforeSnapshot: expect.objectContaining({ rate: '270000' }),
        afterSnapshot: expect.objectContaining({ rate: '280000.1234567890' }),
      }),
    });
  });
  it('logically deletes instead of destroying history', async () => {
    const { service, tx } = setup();
    const result = await service.mutate(
      id,
      { expectedVersion: 1 },
      'delete',
      actor,
    );
    expect(result.data).toMatchObject({
      isActive: false,
      isAuthoritative: false,
      rate: '270000',
    });
    expect(tx.masterDraftExchangeRate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          deactivatedByUserId: actor.userId,
          deactivatedAt: expect.any(Date),
          version: { increment: 1 },
        }),
      }),
    );
    expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'master_data.delete' }),
    });
  });
  it.each(['0', '-1', '1e4', '1.12345678901', '100000000000000'])(
    'rejects invalid amount %s before any query',
    async (rate) => {
      const { service, transaction } = setup();
      await expect(
        service.mutate(id, { expectedVersion: 1, rate }, 'update', actor),
      ).rejects.toMatchObject({ status: 400 });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it('rejects missing permissions, foreign branches, invalid IDs and versions', async () => {
    const { service, transaction } = setup();
    await expect(
      service.mutate(id, { expectedVersion: 1 }, 'delete', {
        ...actor,
        permissions: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.mutate(id, { expectedVersion: 1 }, 'delete', actor, 'other'),
    ).rejects.toMatchObject({ status: 403 });
    for (const version of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER])
      await expect(
        service.mutate(id, { expectedVersion: version }, 'delete', actor),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.mutate('bad', { expectedVersion: 1 }, 'delete', actor),
    ).rejects.toMatchObject({ status: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('preserves manual resource and field restrictions', async () => {
    const { service, tx } = setup();
    await expect(
      service.mutate(id, { expectedVersion: 1, rate: '280000' }, 'update', {
        ...actor,
        permissions: [
          ...actor.permissions,
          'ui.deny.master-data.resource.exchange-rates',
        ],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.mutate(id, { expectedVersion: 1, rate: '280000' }, 'update', {
        ...actor,
        permissions: [
          ...actor.permissions,
          'ui.deny.field.master-data.exchange-rates.rate',
        ],
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.masterDraftExchangeRate.updateMany).not.toHaveBeenCalled();
  });
  it('rejects deleted rows and stale CAS without audit', async () => {
    const inactive = setup({ inactive: true });
    await expect(
      inactive.service.mutate(id, { expectedVersion: 1 }, 'delete', actor),
    ).rejects.toMatchObject({ status: 404 });
    const stale = setup({ count: 0 });
    await expect(
      stale.service.mutate(
        id,
        { expectedVersion: 1, rate: '280000' },
        'update',
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(stale.tx.masterDataAuditEvent.create).not.toHaveBeenCalled();
  });
  it('propagates audit failure so the transaction can roll back', async () => {
    const { service, tx } = setup();
    tx.masterDataAuditEvent.create.mockRejectedValue(
      new Error('audit-failure'),
    );
    await expect(
      service.mutate(id, { expectedVersion: 1 }, 'delete', actor),
    ).rejects.toThrow('audit-failure');
  });
  it('validates runtime DTOs and refuses injected lifecycle/pair/actor metadata', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const field of [
      'status',
      'isActive',
      'isAuthoritative',
      'fromCurrencyId',
      'updatedByUserId',
    ])
      await expect(
        pipe.transform(
          { expectedVersion: 1, rate: '280000', [field]: 'injected' },
          { type: 'body', metatype: CurrencyRateUpdateDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform(
        { expectedVersion: 1, rate: '280000' },
        { type: 'body', metatype: CurrencyRateVersionDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform(
        { expectedVersion: 1, rate: '280000.1234567890' },
        { type: 'body', metatype: CurrencyRateUpdateDto },
      ),
    ).resolves.toMatchObject({ expectedVersion: 1, rate: '280000.1234567890' });
  });
});
