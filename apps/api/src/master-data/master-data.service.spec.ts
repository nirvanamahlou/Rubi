import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
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
  it.each(['rail-companies', 'bus-companies'] as const)(
    'persists %s without inventing an organization',
    async (resource) => {
      const countryId = '55555555-5555-4555-8555-555555555555';
      const repository = {
        codeExists: vi.fn().mockResolvedValue(false),
        fieldExists: vi.fn().mockResolvedValue(false),
        find: vi.fn().mockResolvedValue({ id: countryId, isActive: true }),
        create: vi
          .fn()
          .mockImplementation(async (_resource, data) => ({ ...row, ...data })),
      } as unknown as MasterDataRepository;
      await new MasterDataService(repository).create(
        resource,
        { name: 'Synthetic operator', countryId },
        actor,
      );
      expect(repository.create).toHaveBeenCalledWith(
        resource,
        expect.not.objectContaining({ organizationId: expect.any(String) }),
        actor.userId,
        actor.branchIds[0],
      );
    },
  );
  it.each([
    '+03:30',
    '+05:45',
    '-09:30',
    '+14:00',
    '-12:00',
    '+00:00',
    '-00:00',
    '',
    null,
  ])('persists and returns country GMT offset %s', async (gmtOffset) => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      create: vi
        .fn()
        .mockImplementation(async (_resource, data) => ({ ...row, ...data })),
    } as unknown as MasterDataRepository;
    const result = await new MasterDataService(repository).create(
      'countries',
      { iso2Code: 'IR', name: 'ایران', gmtOffset },
      actor,
    );
    const expected = gmtOffset === '-00:00' ? '+00:00' : gmtOffset || null;
    expect(result.data.attributes.gmtOffset).toBe(expected);
    expect(repository.create).toHaveBeenCalledWith(
      'countries',
      expect.objectContaining({ gmtOffset: expected }),
      actor.userId,
      actor.branchIds[0],
    );
  });
  it.each(['+14:01', '-12:01', '+03:60', '03:30', 'NaN', 3, ['+03:30']])(
    'rejects invalid country GMT offset %s',
    async (gmtOffset) => {
      const repository = { create: vi.fn() } as unknown as MasterDataRepository;
      await expect(
        new MasterDataService(repository).create(
          'countries',
          { iso2Code: 'IR', name: 'ایران', gmtOffset },
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it('supports updating and clearing GMT while omission preserves it', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(row),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    for (const [values, expected] of [
      [{ gmtOffset: '+03:30' }, { gmtOffset: '+03:30' }],
      [{ gmtOffset: '' }, { gmtOffset: null }],
      [{ name: 'ایران' }, { name: 'ایران' }],
    ] as const) {
      await service.update('countries', row.id, values, 1, actor);
      expect(repository.update).toHaveBeenLastCalledWith(
        'countries',
        row.id,
        expected,
        1,
        actor.userId,
        actor.branchIds[0],
      );
    }
  });
  it('creates a broker with allowed data fields without requiring a hidden dossierVersion grant', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
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
    const scoped = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.manual.v3',
        'ui.allow.master-data.resource.brokers',
        'ui.allow.field.master-data.brokers.name',
      ],
    } as AuthenticatedActor;
    await expect(
      new MasterDataService(repository).create(
        'brokers',
        { name: 'Synthetic broker', dossierVersion: '1' },
        scoped,
      ),
    ).resolves.toBeDefined();
    expect(repository.create).toHaveBeenCalledWith(
      'brokers',
      expect.objectContaining({ name: 'Synthetic broker', partnerDossier: {} }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it.each([
    'name',
    'dossierEmail',
    'dossierMobile',
    'dossierAddress',
    'organizationId',
    'leaderDrafts',
  ])(
    'still denies actual broker data %s without its field grant',
    async (key) => {
      const repository = { create: vi.fn() } as unknown as MasterDataRepository;
      const scoped = {
        ...actor,
        permissions: [
          ...actor.permissions,
          'ui.manual.v3',
          'ui.allow.master-data.resource.brokers',
          ...(key === 'name'
            ? []
            : ['ui.allow.field.master-data.brokers.name']),
        ],
      } as AuthenticatedActor;
      await expect(
        new MasterDataService(repository).create(
          'brokers',
          { name: 'Synthetic broker', dossierVersion: '1', [key]: 'value' },
          scoped,
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'MASTER_DATA_FIELDS_RESTRICTED',
          controlIds: [`field.master-data.brokers.${key}`],
        },
      });
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it('stores a per-unit toman rate for USD without imposing the old USD self-rate rule', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue({
        ...row,
        code: 'USD',
        tomanPerUnit: '270000.1234567890',
      }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.update(
      'currencies',
      row.id,
      { tomanPerUnit: '270000.1234567890' },
      1,
      actor,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'currencies',
      row.id,
      { tomanPerUnit: '270000.1234567890' },
      1,
      actor.userId,
      actor.branchIds[0],
    );
    await service.update('currencies', row.id, { tomanPerUnit: '' }, 1, actor);
    expect(repository.update).toHaveBeenLastCalledWith(
      'currencies',
      row.id,
      { tomanPerUnit: null },
      1,
      actor.userId,
      actor.branchIds[0],
    );
  });

  it.each([
    '0',
    '-1',
    'NaN',
    'Infinity',
    '1e5',
    '100000000000000',
    '1.12345678901',
  ])('rejects invalid toman reference %s before persistence', async (rate) => {
    const repository = { update: vi.fn() } as unknown as MasterDataRepository;
    await expect(
      new MasterDataService(repository).update(
        'currencies',
        row.id,
        { tomanPerUnit: rate },
        1,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('checks unchecked manual fields on updates without requiring legacy deny tokens', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const scoped: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.manual.v3',
        'ui.allow.master-data.resource.countries',
      ],
    };
    await expect(
      service.update('countries', row.id, { name: 'changed' }, 1, scoped),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('enforces additive resource and field restrictions before mutation while leaving reads shared', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ rows: [row], total: 1 }),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const resourceDenied = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.deny.master-data.resource.countries',
      ],
    } as AuthenticatedActor;
    await expect(
      service.create('countries', { name: 'ایران' }, resourceDenied),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.list('countries', {
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ meta: { total: 1 } });
    const fieldDenied = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.deny.field.master-data.countries.name',
      ],
    } as AuthenticatedActor;
    await expect(
      service.create('countries', { name: null }, fieldDenied),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('permits a canonically unchanged denied update and rejects an actual change', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      fieldExists: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const restricted = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.deny.field.master-data.countries.name',
      ],
    } as AuthenticatedActor;
    await expect(
      service.update('countries', row.id, { name: row.name }, 1, restricted),
    ).resolves.toBeDefined();
    await expect(
      service.update('countries', row.id, { name: 'نام تازه' }, 1, restricted),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });
  it('does not disclose a voucher leader contact from another broker', async () => {
    const repository = {
      find: vi
        .fn()
        .mockImplementation(async (resource: string) =>
          resource === 'brokers'
            ? { isActive: true }
            : { isActive: true, brokerId: 'different-broker' },
        ),
      recordLeaderContactRead: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await expect(
      service.voucherLeaderContact('broker-1', 'leader-1', actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.recordLeaderContactRead).not.toHaveBeenCalled();
  });
  it('rejects an inverted list date range before querying persistence', async () => {
    const repository = { list: vi.fn() } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.list('countries', {
        createdFrom: '2026-09-01',
        createdTo: '2026-08-01',
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.list).not.toHaveBeenCalled();
  });

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
      { ...values, decimalDigits: 2, displayOrder: 0 },
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

  it('generates the supplier and broker service code in the backend', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
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
      'travel-services',
      { name: 'رزرو هتل', englishName: 'Hotel booking' },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'travel-services',
      expect.objectContaining({
        code: expect.stringMatching(/^SERVICE_[A-Z0-9]{12}$/),
        name: 'رزرو هتل',
        displayOrder: 0,
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('normalizes merged unique IATA/ICAO codes without requiring an organization', async () => {
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
      'airlines',
      {
        airlineCodes: 'w5 / irm',
        name: 'ایرلاین آزمایشی',
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

  it('accepts the visible Cabin form payload and normalizes its enum', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
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
      'cabin-classes',
      {
        englishName: '  Business  ',
        bookingCode: 'c',
        cabinType: 'business',
      },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'cabin-classes',
      expect.objectContaining({
        englishName: 'Business',
        name: 'Business',
        bookingCode: 'C',
        cabinType: 'BUSINESS',
        displayOrder: 0,
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('persists the exact visible Cabin form payload without an English title', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
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

    const created = await service.create(
      'cabin-classes',
      { bookingCode: 'J', cabinType: 'ECONOMY' },
      actor,
    );
    expect(repository.create).toHaveBeenCalledWith(
      'cabin-classes',
      expect.not.objectContaining({ englishName: expect.anything() }),
      actor.userId,
      actor.branchIds[0],
    );
    expect(repository.create).toHaveBeenCalledWith(
      'cabin-classes',
      expect.objectContaining({
        name: 'J',
        bookingCode: 'J',
        cabinType: 'ECONOMY',
      }),
      actor.userId,
      actor.branchIds[0],
    );
    expect(created).toMatchObject({
      data: {
        name: 'J',
        attributes: {
          bookingCode: 'J',
          cabinType: 'ECONOMY',
        },
      },
    });
  });

  it('accepts a country without an English title', async () => {
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

    await service.create('countries', { iso2Code: 'IR', name: 'ایران' }, actor);
    expect(repository.create).toHaveBeenCalledWith(
      'countries',
      expect.not.objectContaining({ englishName: expect.anything() }),
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
        displayOrder: 0,
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

  it('accepts the organization role filter for organization XLSX exports', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ rows: [row], total: 1 }),
      createExport: vi.fn().mockResolvedValue({
        id: '77777777-7777-4777-8777-777777777777',
        status: 'COMPLETED',
      }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.downloadXlsx(
      {
        resource: 'organizations',
        format: 'xlsx',
        filters: {
          search: '',
          status: 'all',
          organizationRole: 'AGENCY',
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: ['code', 'legalName', 'personType', 'roleCodes'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      },
      actor,
    );

    expect(repository.list).toHaveBeenCalledWith(
      'organizations',
      expect.objectContaining({ organizationRole: 'AGENCY' }),
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

  it('creates an airport without inventing optional ICAO, timezone or coordinates', async () => {
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
        name: 'فرودگاه کیش',
        englishName: 'Kish Airport',
        countryId,
        cityId,
        iataCode: 'kih',
      },
      actor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      'airports',
      {
        name: 'فرودگاه کیش',
        englishName: 'Kish Airport',
        cityId,
        iataCode: 'KIH',
        displayOrder: 0,
      },
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('creates a destination-bound XLSX manifest draft with automatic metadata', async () => {
    const airlineId = '55555555-5555-4555-8555-555555555555';
    const destinationCityId = '66666666-6666-4666-8666-666666666666';
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
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
      'manifest-templates',
      {
        name: 'Iran Airtour Antalya',
        airlineId,
        destinationCityId,
      },
      actor,
    );

    expect(repository.find).toHaveBeenCalledWith('airlines', airlineId);
    expect(repository.find).toHaveBeenCalledWith('cities', destinationCityId);
    expect(repository.create).toHaveBeenCalledWith(
      'manifest-templates',
      expect.objectContaining({
        name: 'Iran Airtour Antalya',
        airlineId,
        destinationCityId,
        fileFormat: 'XLSX',
        publicationStatus: 'DRAFT',
        validFrom: expect.any(Date),
        displayOrder: 0,
        code: expect.stringMatching(/^MANIFEST_[A-Z0-9]{12}$/),
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('attaches the uploaded manifest file without requiring hidden validity fields again', async () => {
    const fileReferenceId = '77777777-7777-4777-8777-777777777777';
    const validFrom = new Date('2026-09-12T00:00:00.000Z');
    const repository = {
      find: vi.fn().mockResolvedValue({
        ...row,
        resource: 'manifest-templates',
        validFrom,
        validTo: null,
      }),
      update: vi.fn().mockResolvedValue({
        ...row,
        resource: 'manifest-templates',
        fileReferenceId,
        validFrom,
        validTo: null,
      }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.update(
      'manifest-templates',
      row.id,
      { fileReferenceId },
      1,
      actor,
    );

    expect(repository.update).toHaveBeenCalledWith(
      'manifest-templates',
      row.id,
      { fileReferenceId, validFrom, validTo: null },
      1,
      actor.userId,
      actor.branchIds[0],
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

  it.each([undefined, null, '', '   '])(
    'creates a bank with optional code %s',
    async (code) => {
      const repository = {
        codeExists: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValue(false),
        fieldExists: vi.fn().mockResolvedValue(false),
        find: vi.fn().mockResolvedValue({ isActive: true }),
        create: vi
          .fn()
          .mockImplementation(async (_resource, data) => ({ ...row, ...data })),
      } as unknown as MasterDataRepository;
      const response = await new MasterDataService(repository).create(
        'banks',
        {
          name: 'Synthetic bank',
          countryId: '55555555-5555-4555-8555-555555555555',
          ...(code === undefined ? {} : { code }),
        },
        actor,
      );
      expect(response.data.code).toMatch(/^BANK_[A-Z0-9]{12}$/);
      expect(repository.codeExists).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledWith(
        'banks',
        expect.objectContaining({ code: response.data.code }),
        actor.userId,
        actor.branchIds[0],
      );
    },
  );

  it('preserves saved bank code on blank edits and retains supplied-code validation', async () => {
    const repository = {
      codeExists: vi.fn(),
      fieldExists: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockResolvedValue({ ...row, code: 'SAVED_BANK' }),
      find: vi.fn().mockResolvedValue({ isActive: true }),
      create: vi
        .fn()
        .mockImplementation(async (_resource, data) => ({ ...row, ...data })),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    for (const code of ['', '  ', null]) {
      await service.update(
        'banks',
        row.id,
        { code, name: 'Renamed bank' },
        1,
        actor,
      );
      expect(repository.update).toHaveBeenLastCalledWith(
        'banks',
        row.id,
        { name: 'Renamed bank' },
        1,
        actor.userId,
        actor.branchIds[0],
      );
    }
    expect(repository.codeExists).not.toHaveBeenCalled();
    const base = {
      name: 'Synthetic bank',
      countryId: '55555555-5555-4555-8555-555555555555',
    };
    expect(
      (await service.create('banks', { ...base, code: ' manual_01 ' }, actor))
        .data.code,
    ).toBe('MANUAL_01');
    await expect(
      service.create('banks', { ...base, code: 'bad code!' }, actor),
    ).rejects.toMatchObject({ status: 400 });
    vi.mocked(repository.fieldExists).mockResolvedValue(true);
    await expect(
      service.create('banks', { ...base, code: 'DUPLICATE' }, actor),
    ).rejects.toMatchObject({ status: 409 });
    for (const invalid of [
      { name: 'Only name' },
      { countryId: base.countryId },
    ]) {
      await expect(
        service.create('banks', invalid, actor),
      ).rejects.toMatchObject({ status: 400 });
    }
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

  it('creates an independent rail terminal from name only with a generated code', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockImplementation(async (_resource, data) => ({
        ...row,
        ...data,
        isActive: true,
      })),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.create('rail-terminals', { name: 'راه‌آهن تهران' }, actor);
    expect(repository.create).toHaveBeenCalledWith(
      'rail-terminals',
      expect.objectContaining({
        name: 'راه‌آهن تهران',
        code: expect.stringMatching(/^RAIL_TERMINAL_[A-Z0-9]{12}$/),
        displayOrder: 0,
      }),
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('clears optional rail terminal fields without weakening optimistic update', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({
        ...row,
        operatingHoursMode: 'FULL_TIME',
      }),
      update: vi.fn().mockResolvedValue({ ...row, code: 'RAIL_TERMINAL_TEST' }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.update(
      'rail-terminals',
      row.id,
      { cityId: null, englishName: null, operatingHoursMode: null },
      3,
      actor,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'rail-terminals',
      row.id,
      expect.objectContaining({
        cityId: null,
        englishName: null,
        operatingHoursMode: null,
      }),
      3,
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('rejects an unknown or inactive rail terminal city reference', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await expect(
      service.create(
        'rail-terminals',
        {
          name: 'راه‌آهن تست',
          cityId: '55555555-5555-4555-8555-555555555555',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('preserves complete limited hours on a name-only rail terminal patch', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({
        ...row,
        operatingHoursMode: 'LIMITED',
        opensAt: '08:00',
        closesAt: '18:00',
      }),
      update: vi.fn().mockResolvedValue({ ...row, name: 'نام تازه' }),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.update(
      'rail-terminals',
      row.id,
      { name: 'نام تازه' },
      1,
      actor,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'rail-terminals',
      row.id,
      { name: 'نام تازه' },
      1,
      actor.userId,
      actor.branchIds[0],
    );
  });

  it('clearing the rail hours mode also clears prior endpoints', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({
        ...row,
        operatingHoursMode: 'LIMITED',
        opensAt: '08:00',
        closesAt: '18:00',
      }),
      update: vi.fn().mockResolvedValue(row),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.update(
      'rail-terminals',
      row.id,
      { operatingHoursMode: null },
      1,
      actor,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'rail-terminals',
      row.id,
      { operatingHoursMode: null, opensAt: null, closesAt: null },
      1,
      actor.userId,
      actor.branchIds[0],
    );
  });

  it.each([
    { operatingHoursMode: 'LIMITED', opensAt: '08:00' },
    { operatingHoursMode: 'LIMITED', closesAt: '18:00' },
    { opensAt: '08:00', closesAt: '18:00' },
  ])('rejects incoherent rail terminal hours: %o', async (values) => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await expect(
      service.create(
        'rail-terminals',
        { name: 'راه‌آهن تست', ...values },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a client-supplied rail terminal code on update', async () => {
    const repository = { update: vi.fn() } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await expect(
      service.update(
        'rail-terminals',
        row.id,
        { code: 'CLIENT_CODE' },
        1,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
