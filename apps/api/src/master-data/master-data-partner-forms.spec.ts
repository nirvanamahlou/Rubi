import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { MasterDataRepository } from './master-data.repository';
import { toMasterDataRecord } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const orgId = '33333333-3333-4333-8333-333333333333';
const contactId = '44444444-4444-4444-8444-444444444444';
const partnerId = '55555555-5555-4555-8555-555555555555';
const actor: AuthenticatedActor = { userId: orgId, sessionId: contactId, branchIds: [orgId], permissions: ['master_data.create', 'master_data.update'] };
function setup(contact = { id: contactId, organizationId: orgId, isActive: true }) {
  const organization = { id: orgId, isActive: true, personType: 'LEGAL', roles: [{ roleCode: 'SUPPLIER' }, { roleCode: 'BROKER' }] };
  const existing = { id: partnerId, organizationId: orgId, primaryContactId: contactId, isActive: true };
  const row = (data: object) => ({ id: partnerId, code: 'TEST_PARTNER', name: 'آزمون', isActive: true, version: 1,
    createdAt: new Date(), updatedAt: new Date(), organization, ...data, services: [] });
  const create = vi.fn(async (_resource, data) => row(data));
  const update = vi.fn(async (_resource, _id, data) => row(data));
  const repository = { create, update, codeExists: vi.fn().mockResolvedValue(false),
    find: vi.fn(async (resource) => resource === 'organization-contacts' ? contact : resource === 'organizations' ? organization : existing),
    list: vi.fn(async () => ({ rows: [{ id: contactId, code: 'HOTEL', isActive: true }], total: 1 })),
  } as unknown as MasterDataRepository;
  return { service: new MasterDataService(repository), create, update };
}

describe('partner profile form persistence', () => {
  it.each(['suppliers', 'brokers'])('persists English name, same-organization contact and service relations for %s', async (resource) => {
    const { service, create } = setup();
    await service.create(resource, { ...(resource === 'brokers' ? { name: 'آزمون' } : {}), organizationId: orgId, englishName: ' Test Partner ', primaryContactId: contactId, serviceCodes: 'hotel,HOTEL' }, actor);
    expect(create).toHaveBeenCalledWith(resource, expect.objectContaining({ englishName: 'Test Partner', primaryContactId: contactId,
      services: { create: [{ serviceId: contactId, assignedByUserId: actor.userId }] },
    }), actor.userId, orgId);
  });
  it.each(['suppliers', 'brokers'])('rejects another organization contact for %s', async (resource) => {
    const { service, create } = setup({ id: contactId, organizationId: partnerId, isActive: true });
    await expect(service.create(resource, { ...(resource === 'brokers' ? { name: 'آزمون' } : {}), organizationId: orgId, primaryContactId: contactId }, actor)).rejects.toThrow('همان سازمان');
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects an inactive contact and malformed contact IDs', async () => {
    await expect(setup({ id: contactId, organizationId: orgId, isActive: false }).service.update('brokers', partnerId, { primaryContactId: contactId }, 1, actor)).rejects.toThrow('فعال');
    await expect(setup().service.update('brokers', partnerId, { primaryContactId: 42 }, 1, actor)).rejects.toThrow('شناسه');
  });
  it('revalidates retained primary contact when only organization changes', async () => {
    await expect(setup().service.update('brokers', partnerId, { organizationId: partnerId }, 1, actor)).rejects.toThrow('همان سازمان');
  });
  it('preserves omitted values and clears only explicitly blank optional fields', async () => {
    const { service, update } = setup();
    await service.update('brokers', partnerId, { name: 'نام تازه' }, 1, actor);
    expect(update.mock.calls[0]?.[2]).not.toHaveProperty('englishName');
    expect(update.mock.calls[0]?.[2]).not.toHaveProperty('primaryContactId');
    await service.update('brokers', partnerId, { englishName: '', primaryContactId: '' }, 1, actor);
    expect(update.mock.calls[1]?.[2]).toMatchObject({ englishName: null, primaryContactId: null });
  });
  it('validates person type and English-name length', async () => {
    const { service, update } = setup();
    await service.update('organizations', orgId, { personType: ' natural ' }, 1, actor);
    expect(update.mock.calls[0]?.[2]).toMatchObject({ personType: 'NATURAL' });
    await expect(service.update('organizations', orgId, { personType: 'BROKER' }, 1, actor)).rejects.toThrow('شخصیت');
    await expect(service.update('brokers', partnerId, { englishName: 'x'.repeat(161) }, 1, actor)).rejects.toThrow('۱۶۰');
  });
  it('does not serialize primary-contact private data or inactive masks', () => {
    const source = { id: partnerId, code: 'TEST', name: 'Test', isActive: true, version: 1, createdAt: new Date(), updatedAt: new Date(),
      organization: { personType: 'LEGAL' }, primaryContact: { isActive: true, fullName: 'Test contact', phoneMasked: '••••1234', emailMasked: null, phoneEncrypted: 'never-public', phoneFingerprint: 'never-public' } };
    expect(toMasterDataRecord('brokers', source).attributes).toMatchObject({ primaryPhoneMasked: '••••1234', organizationPersonType: 'LEGAL' });
    expect(JSON.stringify(toMasterDataRecord('brokers', source))).not.toContain('never-public');
    expect(toMasterDataRecord('brokers', { ...source, primaryContact: { ...source.primaryContact, isActive: false } }).attributes.primaryPhoneMasked).toBeNull();
  });
});
