import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';
import { MasterDataRepository } from './master-data.repository';
import { MasterOrganizationDirectory } from './master-organization-directory';
import { persistPartnerDossier } from './partner-dossier.persistence';
vi.mock('./partner-dossier.persistence', () => ({
  persistPartnerDossier: vi.fn().mockResolvedValue('org'),
}));

describe('every partner has a ready dossier', () => {
  function setup() {
    const model = {
      create: vi.fn().mockResolvedValue({ id: 'partner' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'partner', version: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: 'partner' }),
    };
    const tx = {
      masterSupplier: model,
      masterBroker: model,
      masterDataAuditEvent: { create: vi.fn() },
    };
    const repo = new MasterDataRepository({
      client: { $transaction: (fn: (v: typeof tx) => unknown) => fn(tx) },
    } as unknown as DatabaseService);
    vi.mocked(persistPartnerDossier).mockClear();
    return { repo, model };
  }
  it.each(['suppliers', 'brokers'] as const)(
    'creates the canonical %s dossier even for clients without the optional dossier payload',
    async (resource) => {
      const { repo, model } = setup();
      await repo.create(resource, { name: 'QA' }, 'actor', 'branch');
      expect(persistPartnerDossier).toHaveBeenCalledWith(
        expect.anything(),
        resource,
        expect.objectContaining({ name: 'QA' }),
        {},
        'actor',
        'branch',
      );
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org' }),
        }),
      );
    },
  );
  it('repairs legacy records on ordinary edit but does not rewrite existing identity on status-only edit', async () => {
    const { repo, model } = setup();
    await repo.update(
      'suppliers',
      'partner',
      { isActive: false },
      1,
      'actor',
      'branch',
    );
    expect(persistPartnerDossier).toHaveBeenCalledTimes(1);
    vi.mocked(persistPartnerDossier).mockClear();
    model.findUnique.mockResolvedValue({
      id: 'partner',
      version: 1,
      organizationId: 'existing',
    } as never);
    await repo.update(
      'suppliers',
      'partner',
      { isActive: true },
      1,
      'actor',
      'branch',
    );
    expect(persistPartnerDossier).not.toHaveBeenCalled();
  });
  it('uses bounded authorized batches and reuses the audited CAS/idempotent connector', async () => {
    const model = {
      findMany: vi.fn().mockResolvedValue([{ id: 'partner', version: 8 }]),
      count: vi.fn().mockResolvedValue(0),
    };
    const directory = new MasterOrganizationDirectory({
      client: { masterSupplier: model },
    } as unknown as DatabaseService);
    const ensure = vi
      .spyOn(directory, 'ensurePartnerDossier')
      .mockResolvedValue({ organizationId: 'org' });
    const actor = {
      userId: 'actor',
      branchIds: ['branch'],
      permissions: ['master_data.create', 'master_data.update'],
    } as AuthenticatedActor;
    expect(
      await directory.preparePartnerDossiers('suppliers', 'branch', actor),
    ).toEqual({ prepared: 1, remaining: 0 });
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: null }, take: 50 }),
    );
    expect(ensure).toHaveBeenCalledWith(
      'suppliers',
      'partner',
      8,
      'branch',
      actor,
    );
    await expect(
      directory.preparePartnerDossiers('suppliers', 'other', actor),
    ).rejects.toThrow();
    await expect(
      directory.preparePartnerDossiers('suppliers', 'branch', {
        ...actor,
        permissions: ['master_data.read'],
      }),
    ).rejects.toThrow();
    expect(ensure).toHaveBeenCalledTimes(1);
  });
});
