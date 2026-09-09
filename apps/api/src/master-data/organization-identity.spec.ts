import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import { MasterDataService } from './master-data.service';
import type { MasterDataRepository } from './master-data.repository';

const orgId = '33333333-3333-4333-8333-333333333333';
const actor = {
  userId: orgId,
  sessionId: orgId,
  branchIds: [orgId],
  permissions: ['master_data.create', 'master_data.update'],
} as AuthenticatedActor;
function setup() {
  const existing = {
    id: orgId,
    code: 'TEST',
    legalName: 'شرکت آزمایشی',
    personType: 'LEGAL',
    nationalId: '12345678901',
    roles: [{ roleCode: 'AGENCY' }],
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const create = vi.fn(async (_resource, data) => ({
    ...existing,
    ...data,
    roles: existing.roles,
  }));
  const update = vi.fn(async (_resource, _id, data) => ({
    ...existing,
    ...data,
    roles: existing.roles,
  }));
  const repository = {
    create,
    update,
    find: vi.fn().mockResolvedValue(existing),
    codeExists: vi.fn().mockResolvedValue(false),
  } as unknown as MasterDataRepository;
  return { service: new MasterDataService(repository), create, update };
}
describe('organization company identity', () => {
  it('normalizes Persian/Arabic digits and exposes the saved value in the public record', async () => {
    const { service, create } = setup();
    const result = await service.create(
      'organizations',
      {
        legalName: 'شرکت آزمایشی',
        personType: 'LEGAL',
        nationalId: ' ۱۲۳٤٥٦۷۸۹۰۱ ',
        roleCodes: 'AGENCY',
      },
      actor,
    );
    expect(create.mock.calls[0]?.[1].nationalId).toBe('12345678901');
    expect(result.data.attributes.nationalId).toBe('12345678901');
  });
  it.each(['1234567890', '123456789012', '1234567890x', 12345678901])(
    'rejects malformed company identity %s',
    async (nationalId) => {
      const { service, update } = setup();
      await expect(
        service.update('organizations', orgId, { nationalId }, 1, actor),
      ).rejects.toThrow('شناسه ملی');
      expect(update).not.toHaveBeenCalled();
    },
  );
  it('preserves omitted values and only clears an explicit blank', async () => {
    const { service, update } = setup();
    await service.update(
      'organizations',
      orgId,
      { legalName: 'نام جدید' },
      1,
      actor,
    );
    expect(update.mock.calls[0]?.[2]).not.toHaveProperty('nationalId');
    await service.update('organizations', orgId, { nationalId: ' ' }, 1, actor);
    expect(update.mock.calls[1]?.[2].nationalId).toBeNull();
  });
  it('rejects retained company identity when switching to a natural person, allowing an explicit clear', async () => {
    const { service } = setup();
    await expect(
      service.update(
        'organizations',
        orgId,
        { personType: 'NATURAL' },
        1,
        actor,
      ),
    ).rejects.toThrow('حقوقی');
    await expect(
      service.update(
        'organizations',
        orgId,
        { personType: 'NATURAL', nationalId: null },
        1,
        actor,
      ),
    ).resolves.toBeDefined();
  });
  it('returns a conflict for a duplicate identity on create and update', async () => {
    const { service, create, update } = setup();
    const duplicate = { code: 'P2002', meta: { target: ['nationalId'] } };
    create.mockRejectedValue(duplicate);
    update.mockRejectedValue(duplicate);
    await expect(
      service.create(
        'organizations',
        {
          legalName: 'شرکت آزمایشی',
          personType: 'LEGAL',
          nationalId: '12345678901',
          roleCodes: 'AGENCY',
        },
        actor,
      ),
    ).rejects.toThrow('سازمان دیگری');
    await expect(
      service.update(
        'organizations',
        orgId,
        { nationalId: '12345678901' },
        1,
        actor,
      ),
    ).rejects.toThrow('سازمان دیگری');
  });
});
