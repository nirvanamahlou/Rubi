import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: [
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
    'master_data.export',
    'master_data.currency_rate.create',
    'master_data.currency_rate.approve',
  ],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'IR',
  name: 'ایران',
  englishName: 'Iran',
  isActive: true,
  version: 1,
  createdAt: new Date('2026-08-23T00:00:00.000Z'),
  updatedAt: new Date('2026-08-23T00:00:00.000Z'),
};

describe('MasterDataService', () => {
  it('generates and persists an internal code with actor and branch scope', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi
        .fn()
        .mockImplementation(
          async (_resource: string, data: Record<string, unknown>) => ({
            ...row,
            ...data,
          }),
        ),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    const result = await service.create(
      'countries',
      { name: 'ایران', englishName: 'Iran' },
      actor,
    );

    expect(result.data.code).toMatch(/^[A-Z]{2}$/);
    expect(repository.codeExists).toHaveBeenCalledWith(
      'countries',
      expect.stringMatching(/^[A-Z]{2}$/),
    );
    expect(repository.create).toHaveBeenCalledWith(
      'countries',
      {
        code: expect.stringMatching(/^[A-Z]{2}$/),
        name: 'ایران',
        englishName: 'Iran',
      },
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('denies mutations when no authorized branch exists', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'countries',
        { name: 'ایران', englishName: 'Iran' },
        { ...actor, branchIds: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects manual changes to an automatically generated code', async () => {
    const repository = {
      update: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.update(
        'countries',
        row.id,
        { code: 'ZZ', name: 'ایران جدید' },
        1,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('returns a coded conflict when the atomic version claim loses', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(null),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    const operation = service.update(
      'countries',
      row.id,
      { name: 'ایران جدید' },
      1,
      actor,
    );

    await expect(operation).rejects.toBeInstanceOf(ConflictException);
    await expect(operation).rejects.toMatchObject({
      response: { code: 'CONCURRENT_MODIFICATION' },
      status: 409,
    });
  });

  it('forces exchange rates to draft/non-authoritative persistence', async () => {
    const currencyBase = {
      ...row,
      name: 'ارز',
      englishName: undefined,
    };
    const repository = {
      list: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              ...currencyBase,
              id: '55555555-5555-4555-8555-555555555555',
              code: 'USD',
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              ...currencyBase,
              id: '66666666-6666-4666-8666-666666666666',
              code: 'IRR',
            },
          ],
          total: 1,
        }),
      create: vi.fn().mockResolvedValue({
        ...row,
        code: undefined,
        name: undefined,
        source: 'preview',
        fromCurrency: { code: 'USD' },
        toCurrency: { code: 'IRR' },
        rate: '600000',
        isAuthoritative: false,
      }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.create(
      'exchange-rates',
      {
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'IRR',
        rate: '600000',
        source: 'preview',
        observedAt: '2026-08-23T00:00:00.000Z',
      },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'exchange-rates',
      expect.objectContaining({
        isAuthoritative: false,
        status: 'DRAFT',
        rateType: 'REFERENCE',
        rate: '600000',
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });
  it('builds a completed audited XLSX export from the filtered records', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ rows: [row], total: 1 }),
      createExport: vi.fn().mockResolvedValue({
        id: '77777777-7777-4777-8777-777777777777',
        status: 'COMPLETED',
      }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    const result = await service.downloadXlsx(
      {
        resource: 'countries',
        format: 'xlsx',
        filters: {
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: ['code', 'name', 'englishName', 'status', 'updatedAt'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      },
      actor,
    );

    expect(result.fileName).toMatch(
      /^master-data-countries-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(repository.list).toHaveBeenCalledWith(
      'countries',
      expect.objectContaining({ page: 1, pageSize: 100 }),
    );
    expect(repository.createExport).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'countries',
        format: 'XLSX',
        status: 'COMPLETED',
        actorUserId: actor.userId,
      }),
    );
  });

  it('forbids generic exchange-rate update and status before repository access', async () => {
    const repository = {
      find: vi.fn(),
      update: vi.fn(),
      setStatus: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    const operations = [
      service.update('exchange-rates', row.id, { rate: '610000' }, 1, actor),
      service.status('exchange-rates', row.id, 'active', 1, actor),
      service.status('exchange-rates', row.id, 'inactive', 1, actor),
    ];

    for (const operation of operations)
      await expect(operation).rejects.toMatchObject({
        response: { code: 'CURRENCY_RATE_STATUS_TRANSITION_FORBIDDEN' },
        status: 409,
      });
    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.setStatus).not.toHaveBeenCalled();
  });
});
