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

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
const row = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'TOUR_TEST',
  name: 'تور آزمون',
  englishName: 'Test Tour',
  scope: 'BOTH',
  description: 'شرح آزمون',
  displayOrder: 0,
  isActive: true,
  version: 2,
  updatedByUserId: actor.userId,
  createdAt: new Date('2026-08-31T00:00:00Z'),
  updatedAt: new Date('2026-08-31T00:00:00Z'),
};
function setup() {
  const create = vi
    .fn()
    .mockImplementation(async (_resource, data) => ({ ...row, ...data }));
  const update = vi
    .fn()
    .mockImplementation(async (_resource, _id, data) => ({
      ...row,
      ...data,
      version: 3,
    }));
  const repository = {
    codeExists: vi.fn().mockResolvedValue(false),
    create,
    update,
  } as unknown as MasterDataRepository;
  return { create, update, service: new MasterDataService(repository) };
}

describe('tour type form mutations', () => {
  it('persists every editable field plus inactive status in one creation', async () => {
    const { service, create } = setup();
    const response = await service.create(
      'tour-types',
      {
        name: ' تور آزمون ',
        englishName: ' Test Tour ',
        scope: 'both',
        description: ' شرح آزمون ',
        displayOrder: '3',
        status: 'inactive',
      },
      actor,
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      name: 'تور آزمون',
      englishName: 'Test Tour',
      scope: 'BOTH',
      description: 'شرح آزمون',
      displayOrder: 3,
      isActive: false,
      deactivatedByUserId: actor.userId,
      deactivatedAt: expect.any(Date),
    });
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('status');
    expect(response.data.status).toBe('inactive');
    expect(response.data.code).toMatch(/^TOUR_[A-Z0-9]+$/);
  });
  it('updates status and fields together with the expected version', async () => {
    const { service, update } = setup();
    await service.update(
      'tour-types',
      row.id,
      { name: 'عنوان جدید', status: 'active' },
      2,
      actor,
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'tour-types',
      row.id,
      {
        name: 'عنوان جدید',
        isActive: true,
        deactivatedAt: null,
        deactivatedByUserId: null,
      },
      2,
      actor.userId,
      actor.branchIds[0],
    );
  });
  it('keeps legacy field-only updates free of status changes', async () => {
    const { service, update } = setup();
    await service.update('tour-types', row.id, { description: '' }, 2, {
      ...actor,
      permissions: ['master_data.update'],
    });
    expect(update.mock.calls[0]?.[2]).toEqual({ description: null });
  });
  it('allows normal active creation without status-management permission', async () => {
    const { service } = setup();
    await expect(
      service.create(
        'tour-types',
        { name: 'تور', scope: 'DOMESTIC', status: 'active' },
        { ...actor, permissions: ['master_data.create'] },
      ),
    ).resolves.toBeDefined();
  });
  it.each(['create', 'update'] as const)(
    'rejects unauthorized status via %s before writes',
    async (method) => {
      const { service, create, update } = setup();
      const editor = {
        ...actor,
        permissions: [
          'master_data.create',
          'master_data.update',
        ] as AuthenticatedActor['permissions'],
      };
      const values = { name: 'تور', scope: 'BOTH', status: 'inactive' };
      const request =
        method === 'create'
          ? service.create('tour-types', values, editor)
          : service.update('tour-types', row.id, values, 2, editor);
      await expect(request).rejects.toBeInstanceOf(ForbiddenException);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it.each([
    { name: '  ' },
    { name: 'x'.repeat(161) },
    { name: 3 },
    { englishName: 'x'.repeat(161) },
    { description: 'x'.repeat(1001) },
    { scope: '' },
    { scope: 'INVALID' },
    { scope: null },
    { scope: ['BOTH'] },
    { status: '' },
    { status: null },
    { status: 'approved' },
    { displayOrder: '-1' },
    { displayOrder: '1.5' },
    { displayOrder: '2147483648' },
    { updatedByUserId: actor.userId },
    { usageCount: 2 },
    { updatedAt: '2026-08-31' },
    { isActive: 'false' },
  ])('rejects invalid fields or forged metadata: %j', async (values) => {
    const { service, create } = setup();
    await expect(
      service.create(
        'tour-types',
        { name: 'تور', scope: 'BOTH', ...values },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it('does not make the generated code editable', async () => {
    const { service, update } = setup();
    await expect(
      service.update('tour-types', row.id, { code: 'TOUR_OTHER' }, 2, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it('surfaces version conflicts instead of treating a failed update as saved', async () => {
    const { service, update } = setup();
    update.mockResolvedValue(null);
    await expect(
      service.update('tour-types', row.id, { status: 'inactive' }, 2, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('returns server-owned actor metadata and distinguishes unknown usage from zero', () => {
    expect(toMasterDataRecord('tour-types', row).attributes).toMatchObject({
      updatedByUserId: actor.userId,
      usageCount: null,
      usageStatus: 'UNAVAILABLE',
    });
    expect(
      toMasterDataRecord('transfer-types', row).attributes,
    ).not.toHaveProperty('updatedByUserId');
  });
});

describe('tour status and field transaction', () => {
  it('claims one version and audits both changes inside one transaction', async () => {
    const after = { ...row, name: 'نام جدید', isActive: false, version: 3 };
    const model = {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(after),
    };
    const audit = vi.fn().mockResolvedValue({});
    const transaction = {
      masterTourType: model,
      masterDataAuditEvent: { create: audit },
    };
    const transact = vi.fn(
      async (run: (tx: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    );
    const repository = new MasterDataRepository({
      client: { $transaction: transact },
    } as unknown as DatabaseService);
    await repository.update(
      'tour-types',
      row.id,
      { name: 'نام جدید', isActive: false },
      2,
      actor.userId,
      actor.branchIds[0]!,
    );
    expect(transact).toHaveBeenCalledTimes(1);
    expect(model.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { name: 'نام جدید', isActive: false },
    });
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actor.userId,
        beforeSnapshot: expect.objectContaining({
          name: row.name,
          isActive: true,
        }),
        afterSnapshot: expect.objectContaining({
          name: 'نام جدید',
          isActive: false,
        }),
      }),
    });
    model.updateMany.mockResolvedValue({ count: 0 });
    model.update.mockClear();
    audit.mockClear();
    expect(
      await repository.update(
        'tour-types',
        row.id,
        { isActive: false },
        2,
        actor.userId,
        actor.branchIds[0]!,
      ),
    ).toBeNull();
    expect(model.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
