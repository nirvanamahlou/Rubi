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
  it('allows currencies without display policy and preserves existing policy on edit', async () => {
    const currency = { ...row, code: 'USD', displayPolicy: 'SYMBOL_BEFORE' };
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(currency),
      update: vi.fn().mockResolvedValue({ ...currency, version: 2 }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const values = {
      code: 'USD',
      name: 'ارز تست',
      englishName: 'Test currency',
      symbol: '$',
      decimalDigits: '2',
    };
    await service.create('currencies', values, actor);
    await service.update('currencies', currency.id, values, 1, actor);
    expect(repository.create).toHaveBeenCalledWith(
      'currencies',
      { ...values, decimalDigits: 2 },
      actor.userId,
      actor.branchIds[0],
    );
    expect(repository.update).toHaveBeenCalledWith(
      'currencies',
      currency.id,
      { ...values, decimalDigits: 2 },
      1,
      actor.userId,
      actor.branchIds[0],
    );
  });
  it('normalizes a Tag color and generates its internal code', async () => {
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

    await service.create(
      'tags',
      { name: 'پیگیری ویژه', colorHex: '#aabbcc', displayOrder: '2' },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'tags',
      expect.objectContaining({ colorHex: '#AABBCC', displayOrder: 2 }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('normalizes unique IATA/ICAO codes and enforces the airline organization role', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue({
        ...row,
        displayName: 'ایرلاین سازمانی',
        roles: [{ roleCode: 'AIRLINE' }],
      }),
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

    await service.create(
      'airlines',
      {
        code: 'w5',
        icaoCode: 'irm',
        name: 'ایرلاین آزمایشی',
        organizationId: row.id,
      },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'airlines',
      expect.objectContaining({ code: 'W5', icaoCode: 'IRM' }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('rejects a non-positive baggage allowance before persistence', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'baggage-rules',
        {
          name: 'قاعده بار',
          airlineId: row.id,
          passengerType: 'ADT',
          allowance: '0',
          unit: 'KG',
          validFrom: '2026-08-29',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('persists the canonical ISO-2 code with actor and audit branch', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
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
      { iso2Code: 'ir', name: 'ایران', englishName: 'Iran' },
      actor,
    );

    expect(result.data.code).toBe('IR');
    expect(repository.fieldExists).toHaveBeenCalledWith(
      'countries',
      'code',
      'IR',
      undefined,
    );
    expect(repository.create).toHaveBeenCalledWith(
      'countries',
      {
        code: 'IR',
        name: 'ایران',
        englishName: 'Iran',
      },
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('denies mutations when no authorized branch exists', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'countries',
        { iso2Code: 'IR', name: 'ایران', englishName: 'Iran' },
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
  it('normalizes airport codes and enforces active same-country city references', async () => {
    const countryId = '55555555-5555-4555-8555-555555555555';
    const cityId = '66666666-6666-4666-8666-666666666666';
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue({ isActive: true, countryId }),
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

    await service.create(
      'airports',
      {
        name: 'مهرآباد',
        englishName: 'Mehrabad',
        countryId,
        cityId,
        iataCode: 'thr',
        icaoCode: 'oiii',
        ianaTimezone: 'Asia/Tehran',
        latitude: '35.6892',
        longitude: '51.3134',
      },
      actor,
    );

    expect(repository.fieldExists).toHaveBeenCalledTimes(2);
    expect(repository.find).toHaveBeenCalledWith('cities', cityId);
    expect(repository.create).toHaveBeenCalledWith(
      'airports',
      expect.objectContaining({
        cityId,
        iataCode: 'THR',
        icaoCode: 'OIII',
        ianaTimezone: 'Asia/Tehran',
        latitude: '35.6892',
        longitude: '51.3134',
      }),
      actor.userId,
      actor.branchIds[0],
    );
    expect(repository.create).not.toHaveBeenCalledWith(
      'airports',
      expect.objectContaining({ countryId }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects invalid IANA timezones and out-of-range coordinates', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const base = {
      name: 'فرودگاه آزمون',
      englishName: 'Test Airport',
      countryId: '55555555-5555-4555-8555-555555555555',
      cityId: '66666666-6666-4666-8666-666666666666',
      iataCode: 'TST',
      icaoCode: 'OITT',
      longitude: '51',
    };

    await expect(
      service.create(
        'airports',
        {
          ...base,
          ianaTimezone: 'Mars/Olympus_Mons',
          latitude: '35',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.create(
        'airports',
        {
          ...base,
          ianaTimezone: 'Asia/Tehran',
          latitude: '91',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('allows partial airport edits without resending relationship fields', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue({
        ...row,
        iataCode: 'THR',
        name: 'فرودگاه مهرآباد',
      }),
      find: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.update(
      'airports',
      row.id,
      { name: 'فرودگاه مهرآباد' },
      1,
      actor,
    );

    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      'airports',
      row.id,
      { name: 'فرودگاه مهرآباد' },
      1,
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('creates a bank branch only from active bank/city references', async () => {
    const bankId = '55555555-5555-4555-8555-555555555555';
    const cityId = '66666666-6666-4666-8666-666666666666';
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      bankBranchCodeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue({ isActive: true }),
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

    await service.create(
      'bank-branches',
      {
        code: 'central_01',
        name: 'شعبه مرکزی',
        bankId,
        cityId,
      },
      actor,
    );

    expect(repository.find).toHaveBeenCalledWith('banks', bankId);
    expect(repository.find).toHaveBeenCalledWith('cities', cityId);
    expect(repository.bankBranchCodeExists).toHaveBeenCalledWith(
      bankId,
      'CENTRAL_01',
      undefined,
    );
    expect(repository.create).toHaveBeenCalledWith(
      'bank-branches',
      expect.objectContaining({ code: 'CENTRAL_01', bankId, cityId }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('normalizes payment-method reference settings without Finance data', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
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

    await service.create(
      'payment-methods',
      {
        code: 'bank_transfer',
        name: 'حواله بانکی',
        channel: 'BANK_TRANSFER',
        direction: 'BOTH',
        requiresManualApproval: 'true',
        displayOrder: '2',
      },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'payment-methods',
      expect.objectContaining({
        code: 'BANK_TRANSFER',
        channel: 'BANK_TRANSFER',
        direction: 'BOTH',
        requiresManualApproval: true,
        displayOrder: 2,
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });
});
