import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  type MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';
import { MasterDataService } from './master-data.service';

const id = '44444444-4444-4444-8444-444444444444';
const referenceId = '55555555-5555-4555-8555-555555555555';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: id,
  branchIds: [referenceId],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
const base = {
  id,
  code: 'TEST_REFERENCE',
  name: 'Test reference',
  isActive: true,
  version: 2,
  vehicleType: 'Van',
  serviceMode: 'PRIVATE',
  suggestedCapacity: 8,
  suggestedCapacityMin: 4,
  countryId: referenceId,
  visaType: 'Tourist',
  referenceValidityMode: 'DAYS',
  referenceValidityDays: 90,
  createdAt: new Date('2026-08-31T00:00:00Z'),
  updatedAt: new Date('2026-08-31T00:00:00Z'),
};
function setup(existing = base) {
  const create = vi.fn(async (_resource, data) => ({
    ...base,
    ...data,
    version: 1,
  }));
  const update = vi.fn(async (_resource, _id, data) => ({
    ...existing,
    ...data,
    version: 3,
  }));
  const find = vi.fn(async (resource) =>
    resource === 'countries' || resource === 'suppliers'
      ? { id: referenceId, isActive: true }
      : existing,
  );
  const repository = {
    create,
    update,
    find,
    codeExists: vi.fn().mockResolvedValue(false),
  } as unknown as MasterDataRepository;
  return { create, update, find, service: new MasterDataService(repository) };
}
const transfer = {
  name: 'ترانسفر آزمون',
  vehicleType: 'ون',
  serviceMode: 'PRIVATE',
};
const visa = {
  name: 'ویزای آزمون',
  countryId: referenceId,
  visaType: 'توریستی',
};

describe('travel reference form persistence contract', () => {
  it('creates a capacity range and status together using the existing repository transaction', async () => {
    const { service, create } = setup();
    const result = await service.create(
      'transfer-types',
      {
        ...transfer,
        englishName: 'Test van',
        suggestedCapacityMin: '4',
        suggestedCapacity: '8',
        description: 'Test description',
        displayOrder: '2',
        status: 'inactive',
      },
      actor,
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      suggestedCapacityMin: 4,
      suggestedCapacity: 8,
      isActive: false,
      deactivatedByUserId: actor.userId,
      displayOrder: 2,
    });
    expect(result.data.attributes).toMatchObject({
      suggestedCapacityMin: 4,
      suggestedCapacity: 8,
      usageCount: null,
      usageStatus: 'UNAVAILABLE',
    });
    expect(result.data.status).toBe('inactive');
  });
  it('creates every visa field without storing passport or applicant data', async () => {
    const { service, create } = setup();
    const result = await service.create(
      'visa-services',
      {
        ...visa,
        englishName: 'Test visa',
        referenceValidityMode: 'DAYS',
        referenceValidityDays: '90',
        guidanceFileReference: referenceId,
        description: 'General guide',
        status: 'inactive',
      },
      actor,
    );
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      referenceValidityMode: 'DAYS',
      referenceValidityDays: 90,
      guidanceFileReference: referenceId,
      isActive: false,
    });
    expect(result.data.attributes.referenceValidityMode).toBe('DAYS');
    expect(result.data.attributes).not.toHaveProperty('supplierId');
  });
  it('preserves legacy numeric-only payloads and omitted lower bounds', async () => {
    const { service, create } = setup();
    await service.create(
      'transfer-types',
      { ...transfer, suggestedCapacity: '3' },
      actor,
    );
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty(
      'suggestedCapacityMin',
    );
    await service.create(
      'visa-services',
      { ...visa, referenceValidityDays: '90' },
      actor,
    );
    expect(create.mock.calls[1]?.[1]).not.toHaveProperty(
      'referenceValidityMode',
    );
  });
  it('validates the effective capacity range against stored values on PATCH', async () => {
    const { service, update } = setup();
    await expect(
      service.update(
        'transfer-types',
        id,
        { suggestedCapacity: '3' },
        2,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('transfer-types', id, { suggestedCapacity: '' }, 2, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    await service.update(
      'transfer-types',
      id,
      { suggestedCapacity: '', suggestedCapacityMin: '' },
      2,
      actor,
    );
    expect(update.mock.calls[0]?.[2]).toEqual({
      suggestedCapacity: null,
      suggestedCapacityMin: null,
    });
  });
  it('switches validity modes atomically and rejects days against stored passport expiry mode', async () => {
    const { service, update } = setup();
    await service.update(
      'visa-services',
      id,
      { referenceValidityMode: 'PASSPORT_EXPIRY', status: 'inactive' },
      2,
      actor,
    );
    expect(update.mock.calls[0]?.[2]).toMatchObject({
      referenceValidityMode: 'PASSPORT_EXPIRY',
      referenceValidityDays: null,
      isActive: false,
    });
    const passport = setup({
      ...base,
      referenceValidityMode: 'PASSPORT_EXPIRY',
      referenceValidityDays: null as unknown as number,
    });
    await expect(
      passport.service.update(
        'visa-services',
        id,
        { referenceValidityDays: '60' },
        2,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await passport.service.update(
      'visa-services',
      id,
      { referenceValidityMode: 'DAYS', referenceValidityDays: '60' },
      2,
      actor,
    );
    expect(passport.update.mock.calls[0]?.[2]).toEqual({
      referenceValidityMode: 'DAYS',
      referenceValidityDays: 60,
    });
  });
  it.each(['transfer-types', 'visa-services'] as const)(
    'enforces status permission and optimistic locking for %s',
    async (resource) => {
      const { service, create, update } = setup();
      const values = resource === 'transfer-types' ? transfer : visa;
      const editor = {
        ...actor,
        permissions: [
          'master_data.create',
          'master_data.update',
        ] as AuthenticatedActor['permissions'],
      };
      await expect(
        service.create(resource, { ...values, status: 'inactive' }, editor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.update(resource, id, { status: 'inactive' }, 2, editor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      await service.create(resource, { ...values, status: 'active' }, editor);
      await service.update(resource, id, { description: '' }, 2, editor);
      expect(update.mock.calls[0]?.[2]).toEqual({ description: null });
      update.mockResolvedValueOnce(null as unknown as typeof base);
      await expect(
        service.update(resource, id, { status: 'inactive' }, 2, actor),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );
  it.each([
    { suggestedCapacityMin: '0' },
    { suggestedCapacityMin: '101' },
    { suggestedCapacityMin: '1.2' },
    { suggestedCapacityMin: ['1'] },
    { suggestedCapacityMin: '4', suggestedCapacity: '3' },
    { suggestedCapacityMin: '1' },
    { vehicleType: '' },
    { vehicleType: 'x'.repeat(121) },
    { serviceMode: [] },
    { serviceMode: null },
    { status: '' },
    { status: null },
    { name: 4 },
    { englishName: 'x'.repeat(161) },
    { description: 'x'.repeat(1001) },
    { displayOrder: '2147483648' },
    { usageCount: 20 },
    { isActive: 'false' },
  ])('rejects malformed transfer fields before writes: %j', async (invalid) => {
    const { service, create } = setup();
    await expect(
      service.create('transfer-types', { ...transfer, ...invalid }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    { referenceValidityMode: '' },
    { referenceValidityMode: null },
    { referenceValidityMode: ['DAYS'] },
    { referenceValidityMode: 'OTHER' },
    { referenceValidityMode: 'PASSPORT_EXPIRY', referenceValidityDays: '30' },
    { referenceValidityDays: '0' },
    { referenceValidityDays: '3651' },
    { referenceValidityDays: ['90'] },
    { guidanceFileReference: 'DOC-20112' },
    { countryId: '' },
    { visaType: '' },
    { passportNumber: 'not-accepted' },
  ])('rejects malformed visa fields before writes: %j', async (invalid) => {
    const { service, create } = setup();
    await expect(
      service.create('visa-services', { ...visa, ...invalid }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it('never represents unavailable transfer usage as a measured zero', () => {
    expect(toMasterDataRecord('transfer-types', base).attributes).toMatchObject(
      { usageCount: null, usageStatus: 'UNAVAILABLE' },
    );
  });
});
