import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.create', 'master_data.update'],
};
const existing = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'LEGACY_CASH',
  name: 'روش آزمایشی',
  englishName: 'Test method',
  channel: 'CASH',
  direction: 'BOTH',
  isActive: true,
  version: 1,
  createdAt: new Date('2026-08-31T00:00:00Z'),
  updatedAt: new Date('2026-08-31T00:00:00Z'),
};

function setup() {
  const repository = {
    codeExists: vi.fn().mockResolvedValue(false),
    fieldExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(async (_resource: string, data: Record<string, unknown>) => ({
      ...existing,
      englishName: null,
      ...data,
    })),
    update: vi.fn(
      async (
        _resource: string,
        _id: string,
        data: Record<string, unknown>,
      ) => ({
        ...existing,
        ...data,
        version: 2,
      }),
    ),
  };
  return {
    repository,
    service: new MasterDataService(
      repository as unknown as MasterDataRepository,
    ),
  };
}

describe('payment-method form persistence', () => {
  it('creates without either hidden field and generates a unique uppercase code', async () => {
    const { service, repository } = setup();
    repository.codeExists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const result = await service.create(
      'payment-methods',
      {
        name: existing.name,
        channel: 'CASH',
        direction: 'BOTH',
      },
      actor,
    );
    expect(result.data.code).toMatch(/^PAYMENT_METHOD_[A-Z0-9]{12}$/);
    expect(repository.codeExists).toHaveBeenCalledTimes(2);
    const candidates = repository.codeExists.mock.calls.map((call) => call[1]);
    expect(candidates[0]).not.toBe(candidates[1]);
    expect(repository.create).toHaveBeenCalledWith(
      'payment-methods',
      {
        code: result.data.code,
        name: existing.name,
        channel: 'CASH',
        direction: 'BOTH',
      },
      actor.userId,
      actor.branchIds[0],
    );
    expect(result.data.attributes.englishName).toBeNull();
  });

  it('preserves an explicit code from existing API consumers', async () => {
    const { service, repository } = setup();
    const result = await service.create(
      'payment-methods',
      {
        code: 'legacy_cash',
        name: existing.name,
        channel: 'CASH',
        direction: 'BOTH',
      },
      actor,
    );
    expect(result.data.code).toBe('LEGACY_CASH');
    expect(repository.codeExists).not.toHaveBeenCalled();
    expect(repository.fieldExists).toHaveBeenCalledWith(
      'payment-methods',
      'code',
      'LEGACY_CASH',
      undefined,
    );
  });

  it('preserves existing code and English name on edit without regenerating or clearing them', async () => {
    const { service, repository } = setup();
    const values = {
      name: 'روش ویرایش‌شده',
      channel: 'CASH',
      direction: 'BOTH',
    };
    const result = await service.update(
      'payment-methods',
      existing.id,
      values,
      1,
      actor,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'payment-methods',
      existing.id,
      values,
      1,
      actor.userId,
      actor.branchIds[0],
    );
    expect(repository.codeExists).not.toHaveBeenCalled();
    expect(result.data.code).toBe(existing.code);
    expect(result.data.attributes.englishName).toBe(existing.englishName);
  });

  it('still rejects missing required fields and invalid explicit codes', async () => {
    const { service, repository } = setup();
    await expect(
      service.create(
        'payment-methods',
        { channel: 'CASH', direction: 'BOTH' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.create(
        'payment-methods',
        { name: existing.name, code: '', channel: 'CASH', direction: 'BOTH' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
