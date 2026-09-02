import { describe, it, expect, vi } from 'vitest';
import {
  MASTER_TRANSPORT_FORM_RESOURCES,
  type AuthenticatedActor,
} from '@rubi/contracts';
import { transportStatusData } from './transport-form.policy';
import { MasterDataService } from './master-data.service';
import { strFromU8, unzipSync } from 'fflate';
import { buildMasterDataXlsx } from './master-data.xlsx';
import {
  toMasterDataRecord,
  type MasterDataRepository,
} from './master-data.repository';

const id = '11111111-1111-4111-8111-111111111111';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
const base = {
  id,
  code: 'TEST',
  name: 'Test',
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('transport forms policy and API compatibility', () => {
  it('exports every transport form with the server-side review filter and rejects malformed filters', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      createExport: vi.fn().mockResolvedValue({ id }),
    };
    const service = new MasterDataService(
      repository as unknown as MasterDataRepository,
    );
    for (const resource of MASTER_TRANSPORT_FORM_RESOURCES) {
      const input = {
        resource,
        format: 'xlsx' as const,
        filters: { transportStatus: 'UNDER_REVIEW' },
        columns: [
          'code',
          'name',
          'transportStatus',
          ...(resource === 'train-types' ? ['facilityIds'] : []),
        ],
        locale: 'fa-IR' as const,
        timezone: 'UTC',
      };
      await expect(service.downloadXlsx(input, actor)).resolves.toHaveProperty(
        'buffer',
      );
      expect(repository.list).toHaveBeenLastCalledWith(
        resource,
        expect.objectContaining({ transportStatus: 'UNDER_REVIEW' }),
      );
      await expect(
        service.downloadXlsx(
          { ...input, filters: { transportStatus: ['ACTIVE'] } },
          actor,
        ),
      ).rejects.toThrow('معتبر');
    }
  });
  it('exports review status and catalog facilities with Persian headers', () => {
    const row = toMasterDataRecord('train-types', {
      ...base,
      isActive: false,
      isUnderReview: true,
      facilities: [{ facilityId: id, facility: { id, name: 'Test facility' } }],
    });
    const files = unzipSync(
      buildMasterDataXlsx({
        resource: 'train-types',
        columns: ['transportStatus', 'facilityIds'],
        records: [row],
        locale: 'fa-IR',
        timezone: 'UTC',
      }),
    );
    const worksheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(worksheet).toContain('وضعیت بررسی');
    expect(worksheet).toContain('در حال بررسی');
    expect(worksheet).toContain('امکانات مرجع');
    expect(worksheet).toContain(id);
  });
  it.each(MASTER_TRANSPORT_FORM_RESOURCES)(
    '%s persists review as inactive and requires explicit status permission',
    (resource) => {
      expect(
        transportStatusData(
          resource,
          { transportStatus: 'UNDER_REVIEW' },
          actor,
        ),
      ).toMatchObject({
        isActive: false,
        isUnderReview: true,
        deactivatedByUserId: id,
      });
      expect(transportStatusData(resource, {}, actor)).toEqual({});
      expect(() =>
        transportStatusData(
          resource,
          { transportStatus: 'ACTIVE' },
          { ...actor, permissions: [] },
        ),
      ).toThrow('مجوز');
      expect(() =>
        transportStatusData(resource, { transportStatus: 'invalid' }, actor),
      ).toThrow('معتبر');
      expect(() =>
        transportStatusData(resource, { transportStatus: ['ACTIVE'] }, actor),
      ).toThrow('معتبر');
      const result = toMasterDataRecord(resource, {
        ...base,
        isActive: false,
        isUnderReview: true,
      });
      expect(result.status).toBe('inactive');
      expect(result.attributes.transportStatus).toBe('UNDER_REVIEW');
      expect(result.attributes.integrationConnectionStatus).toBe('UNAVAILABLE');
      expect(result.attributes.vehicleTypeCount).toBeNull();
    },
  );
  it('accepts a logo reference uploaded through Documents in the same form', async () => {
    const repository = {
      fieldExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(base),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.create(
      'airlines',
      {
        airlineCodes: 'ZZ / ZZZ',
        name: 'Test airline',
        logoFileReference: id,
      },
      actor,
    );
    expect(repository.create).toHaveBeenCalledWith(
      'airlines',
      expect.objectContaining({ logoFileReference: id }),
      actor.userId,
      actor.branchIds[0],
    );
  });
  it('validates train facilities and makes replacing/clearing atomic, preserving legacy text', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue({ ...base, isActive: true }),
      create: vi.fn().mockResolvedValue(base),
      update: vi.fn().mockResolvedValue(base),
    };
    const service = new MasterDataService(
      repository as unknown as MasterDataRepository,
    );
    await service.create(
      'train-types',
      {
        name: 'Test',
        manufacturer: 'Test',
        model: 'T',
        category: 'SLEEPER',
        facilityIds: [id],
        transportStatus: 'UNDER_REVIEW',
      },
      actor,
    );
    expect(repository.create.mock.calls[0]?.[1]).toMatchObject({
      facilities: { create: [{ facilityId: id, assignedByUserId: id }] },
      isActive: false,
      isUnderReview: true,
    });
    await service.update('train-types', id, { facilityIds: '' }, 1, actor);
    expect(repository.update.mock.calls[0]?.[2]).toEqual({
      facilities: { deleteMany: {}, create: [] },
    });
    repository.find.mockResolvedValueOnce({ ...base, isActive: false });
    await expect(
      service.update('train-types', id, { facilityIds: [id] }, 1, actor),
    ).rejects.toThrow('فعال');
  });
});
