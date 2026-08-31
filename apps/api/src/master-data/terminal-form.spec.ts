import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';
import { MasterDataService } from './master-data.service';
import { prepareTerminalForm } from './terminal-form.policy';

const userId = '11111111-1111-4111-8111-111111111111';
const airportId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId,
  sessionId: userId,
  branchIds: [userId],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
const row = {
  id: '33333333-3333-4333-8333-333333333333',
  airportId,
  code: 'TERMINAL_TEST',
  name: 'ترمینال آزمون',
  terminalType: 'MIXED',
  isActive: true,
  isUnderMaintenance: false,
  gateCount: 12,
  operatingHoursMode: 'TIME_RANGE',
  opensAt: '05:00',
  closesAt: '24:00',
  version: 2,
  updatedByUserId: userId,
  createdAt: new Date('2026-08-31T00:00:00Z'),
  updatedAt: new Date('2026-08-31T00:00:00Z'),
};
function setup() {
  const create = vi.fn(async (_resource, data) => ({ ...row, ...data }));
  const update = vi
    .fn()
    .mockImplementation(async (_resource, _id, data) => ({
      ...row,
      ...data,
      version: 3,
    }));
  const repository = {
    create,
    update,
    codeExists: vi.fn().mockResolvedValue(false),
    find: vi.fn(async (resource) =>
      resource === 'terminals' ? row : { id: airportId, isActive: true },
    ),
  } as unknown as MasterDataRepository;
  return { create, update, service: new MasterDataService(repository) };
}
describe('terminal form validation and persistence', () => {
  it('creates all fields and maintenance in a single audited repository mutation', async () => {
    const { service, create } = setup();
    const result = await service.create(
      'terminals',
      {
        name: ' ترمینال آزمون ',
        englishName: ' Test terminal ',
        airportId,
        terminalType: 'MIXED',
        gateCount: '28',
        operatingHoursMode: 'TIME_RANGE',
        opensAt: '05:00',
        closesAt: '24:00',
        status: 'maintenance',
      },
      actor,
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      name: 'ترمینال آزمون',
      englishName: 'Test terminal',
      terminalType: 'MIXED',
      gateCount: 28,
      opensAt: '05:00',
      closesAt: '24:00',
      isActive: false,
      isUnderMaintenance: true,
      deactivatedByUserId: userId,
    });
    expect(result.data.status).toBe('inactive');
    expect(result.data.attributes.isUnderMaintenance).toBe(true);
  });
  it('merges partial hours against existing values and keeps other fields untouched', async () => {
    const { service, update } = setup();
    await service.update('terminals', row.id, { opensAt: '06:00' }, 2, actor);
    expect(update.mock.calls[0]?.[2]).toEqual({
      operatingHoursMode: 'TIME_RANGE',
      opensAt: '06:00',
      closesAt: '24:00',
    });
    await service.update('terminals', row.id, { name: 'نام تازه' }, 2, {
      ...actor,
      permissions: ['master_data.update'],
    });
    expect(update.mock.calls[1]?.[2]).toEqual({ name: 'نام تازه' });
  });
  it('clears optional details without turning unknown hours or gate count into fake defaults', () => {
    const form = prepareTerminalForm(
      { gateCount: '', operatingHoursMode: '', opensAt: '', closesAt: '' },
      actor,
      false,
      row,
    );
    expect(form.values).toEqual({
      gateCount: null,
      operatingHoursMode: null,
      opensAt: null,
      closesAt: null,
    });
  });
  it.each([
    { gateCount: -1 },
    { gateCount: '1.5' },
    { gateCount: '1e2' },
    { gateCount: ' ' },
    { gateCount: 2147483648 },
    { gateCount: ['2'] },
    { operatingHoursMode: 'ALL_DAY', opensAt: '05:00' },
    { operatingHoursMode: null, closesAt: '24:00' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '24:00', closesAt: '05:00' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '05:60', closesAt: '24:00' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '05:00', closesAt: '24:01' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '05:00', closesAt: '05:00' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '05:00' },
    { operatingHoursMode: ['ALL_DAY'] },
    { operatingHoursMode: 'INVALID' },
    { status: null },
    { status: '' },
    { status: 'APPROVED' },
    { name: '' },
    { name: 2 },
    { englishName: 'x'.repeat(161) },
    { terminalType: 'INVALID' },
    { terminalType: ['MIXED'] },
    { airportId: [airportId] },
    { cityId: airportId },
    { isUnderMaintenance: 'true' },
    { updatedByUserId: userId },
    { updatedAt: '2026-08-31' },
  ])('rejects invalid values/forged metadata %j', async (values) => {
    const { service, create } = setup();
    await expect(
      service.create(
        'terminals',
        { name: 'ترمینال آزمون', airportId, terminalType: 'MIXED', ...values },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it.each(['DOMESTIC', 'INTERNATIONAL', 'MIXED', 'VIP'])(
    'supports %s and overnight activity',
    async (terminalType) => {
      const { service } = setup();
      await expect(
        service.create(
          'terminals',
          {
            name: 'ترمینال آزمون',
            airportId,
            terminalType,
            operatingHoursMode: 'TIME_RANGE',
            opensAt: '22:00',
            closesAt: '06:00',
          },
          actor,
        ),
      ).resolves.toBeDefined();
    },
  );
  it('accepts zero gates, full-day hours and normal creation without status permission', () => {
    expect(
      prepareTerminalForm(
        { gateCount: '0', operatingHoursMode: 'ALL_DAY', status: 'active' },
        { ...actor, permissions: ['master_data.create'] },
        true,
      ).values.gateCount,
    ).toBe(0);
  });
  it.each(['create', 'update'] as const)(
    'requires status permission in %s',
    async (method) => {
      const { service, create, update } = setup();
      const unauthorized = { ...actor, permissions: [] };
      const values = {
        name: 'ترمینال',
        airportId,
        terminalType: 'MIXED',
        status: 'maintenance',
      };
      await expect(
        method === 'create'
          ? service.create('terminals', values, unauthorized)
          : service.update('terminals', row.id, values, 2, unauthorized),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it('surfaces optimistic-lock conflicts', async () => {
    const { service, update } = setup();
    update.mockResolvedValue(null);
    await expect(
      service.update('terminals', row.id, { gateCount: 10 }, 2, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('derives city and IATA/ICAO from the airport and returns real actor metadata', () => {
    expect(
      toMasterDataRecord('terminals', {
        ...row,
        airport: {
          id: airportId,
          iataCode: 'TST',
          icaoCode: 'TEST',
          cityId: 'city-test',
          ianaTimezone: 'Asia/Tehran',
          city: { name: 'شهر آزمون' },
        },
      }).attributes,
    ).toMatchObject({
      airportIataCode: 'TST',
      airportIcaoCode: 'TEST',
      cityName: 'شهر آزمون',
      cityId: 'city-test',
      ianaTimezone: 'Asia/Tehran',
      updatedByUserId: userId,
    });
  });
});
describe('terminal status transaction', () => {
  it('audits details, claims one version and clears maintenance on ordinary status change', async () => {
    const after = {
      ...row,
      gateCount: 9,
      isActive: false,
      isUnderMaintenance: true,
      version: 3,
    };
    const model = {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(after),
    };
    const audit = vi.fn().mockResolvedValue({});
    const tx = {
      masterTerminal: model,
      masterDataAuditEvent: { create: audit },
    };
    const transact = vi.fn(
      async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
    );
    const repository = new MasterDataRepository({
      client: { $transaction: transact },
    } as unknown as DatabaseService);
    await repository.update(
      'terminals',
      row.id,
      { gateCount: 9, isActive: false, isUnderMaintenance: true },
      2,
      userId,
      userId,
    );
    expect(transact).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: userId,
        beforeSnapshot: expect.objectContaining({ gateCount: 12 }),
        afterSnapshot: expect.objectContaining({
          gateCount: 9,
          isUnderMaintenance: true,
        }),
      }),
    });
    await repository.setStatus('terminals', row.id, true, 2, userId, userId);
    expect(model.update.mock.calls[1]?.[0].data).toMatchObject({
      isActive: true,
      isUnderMaintenance: false,
      deactivatedAt: null,
    });
    model.updateMany.mockResolvedValue({ count: 0 });
    model.update.mockClear();
    audit.mockClear();
    expect(
      await repository.update(
        'terminals',
        row.id,
        { gateCount: 4 },
        2,
        userId,
        userId,
      ),
    ).toBeNull();
    expect(model.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
