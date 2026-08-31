import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { prepareMealServiceForm } from './meal-service-form.policy';
import { MasterDataService } from './master-data.service';
import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';
import { MasterDataListQueryDto } from './master-data.dto';
import type { DatabaseService } from '../database/database.service';

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
const row = {
  id,
  code: 'BB',
  name: 'وعده آزمون',
  category: 'MEAL_PLAN',
  includedMeals: ['صبحانه'],
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function harness() {
  const repository = {
    codeExists: vi.fn().mockResolvedValue(false),
    fieldExists: vi.fn().mockResolvedValue(false),
    create: vi
      .fn()
      .mockImplementation(async (_resource, data) => ({ ...row, ...data })),
    update: vi
      .fn()
      .mockImplementation(async (_resource, _id, data) => ({
        ...row,
        ...data,
        version: 2,
      })),
  };
  return {
    repository,
    service: new MasterDataService(
      repository as unknown as MasterDataRepository,
    ),
  };
}
describe('meal/service form policy and persistence boundary', () => {
  it.each(['RO', 'BB', 'HB', 'FB', 'ALL', 'UALL', 'BRN'])(
    'accepts business code %s',
    async (code) => {
      const { service } = harness();
      expect(
        (
          await service.create(
            'meal-services',
            {
              code: ` ${code.toLowerCase()} `,
              name: 'وعده آزمون',
              category: 'MEAL_PLAN',
            },
            actor,
          )
        ).data.code,
      ).toBe(code);
    },
  );
  it('keeps omitted legacy codes generated and partial updates unchanged', async () => {
    const { repository, service } = harness();
    expect(
      (
        await service.create(
          'meal-services',
          { name: 'وعده آزمون', category: 'SERVICE' },
          actor,
        )
      ).data.code,
    ).toMatch(/^MEAL_SERVICE_/);
    await service.update(
      'meal-services',
      id,
      { englishName: 'Updated' },
      1,
      actor,
    );
    expect(repository.update.mock.calls[0]?.[2]).toEqual({
      englishName: 'Updated',
    });
  });
  it('checks uniqueness excluding the edited record', async () => {
    const { repository, service } = harness();
    repository.fieldExists.mockResolvedValue(true);
    await expect(
      service.update('meal-services', id, { code: 'ro' }, 1, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.fieldExists).toHaveBeenCalledWith(
      'meal-services',
      'code',
      'RO',
      id,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('reports a concurrent duplicate code as conflict, not a server error', async () => {
    const { repository, service } = harness();
    repository.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create(
        'meal-services',
        { code: 'BB', name: 'نام', category: 'MEAL_PLAN' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    repository.update.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.update('meal-services', id, { code: 'BB' }, 1, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['', 'A', 'نام', 'A B', 'A'.repeat(33), null, ['BB']])(
    'rejects malformed explicit code %j',
    async (code) => {
      const { service, repository } = harness();
      await expect(
        service.create(
          'meal-services',
          { code, name: 'وعده آزمون', category: 'MEAL_PLAN' },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it.each([['صبحانه', 'شام', 'صبحانه'], 'صبحانه، شام', '["صبحانه","شام"]'])(
    'normalizes multiple meals %j',
    (includedMeals) => {
      expect(
        prepareMealServiceForm({ includedMeals }, actor, false).values
          .includedMeals,
      ).toEqual(['صبحانه', 'شام']);
    },
  );
  it.each([
    0,
    '[broken',
    '[1]',
    Array(21).fill('meal'),
    [''],
    ['a'.repeat(81)],
  ])('rejects malformed meals %j', (includedMeals) => {
    expect(() =>
      prepareMealServiceForm({ includedMeals }, actor, true),
    ).toThrow(BadRequestException);
  });
  it.each([null, '', '[]', []])(
    'clears meals explicitly with %j',
    (includedMeals) => {
      expect(
        prepareMealServiceForm({ includedMeals }, actor, false).values
          .includedMeals,
      ).toEqual([]);
    },
  );
  it('preserves custom meals including commas in the non-lossy response', () => {
    const record = toMasterDataRecord('meal-services', {
      ...row,
      includedMeals: ['Custom, meal'],
    });
    expect(record.attributes.includedMealsJson).toBe('["Custom, meal"]');
  });
  it('writes review status and content in one authorized mutation', async () => {
    const { repository, service } = harness();
    const response = await service.update(
      'meal-services',
      id,
      { status: 'under_review', includedMeals: [] },
      1,
      actor,
    );
    expect(repository.update.mock.calls[0]?.[2]).toMatchObject({
      isActive: false,
      isUnderReview: true,
      includedMeals: [],
      deactivatedByUserId: id,
    });
    expect(response.data.status).toBe('inactive');
    expect(response.data.attributes.isUnderReview).toBe(true);
    expect(repository.update.mock.calls[0]?.[2]).not.toHaveProperty('status');
  });
  it.each(['inactive', 'under_review', 'active'])(
    'requires status permission on edit to %s',
    (status) => {
      expect(() =>
        prepareMealServiceForm(
          { status },
          { ...actor, permissions: ['master_data.update'] },
          false,
        ),
      ).toThrow(ForbiddenException);
    },
  );
  it('allows ordinary default-active creation without status permission', () => {
    expect(
      prepareMealServiceForm(
        { status: 'active' },
        { ...actor, permissions: [] },
        true,
      ).statusData,
    ).toMatchObject({ isActive: true, isUnderReview: false });
  });
  it.each(['UNDER_REVIEW', null, 1, ['active']])(
    'rejects invalid status %j',
    (status) => {
      expect(() => prepareMealServiceForm({ status }, actor, true)).toThrow(
        BadRequestException,
      );
    },
  );
  it('does not accept database flags or other read-only attributes', async () => {
    const { service } = harness();
    for (const key of ['isUnderReview', 'hotelCount', 'includedMealsJson'])
      await expect(
        service.update('meal-services', id, { [key]: 'true' }, 1, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('retains optimistic locking', async () => {
    const { service, repository } = harness();
    repository.update.mockResolvedValue(null);
    await expect(
      service.update('meal-services', id, { name: 'نام' }, 1, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('legacy status action clears review flag', async () => {
    const repository = new MasterDataRepository({} as DatabaseService);
    const update = vi.spyOn(repository, 'update').mockResolvedValue(row);
    await repository.setStatus('meal-services', id, true, 1, id, id);
    expect(update.mock.calls[0]?.[2]).toMatchObject({
      isUnderReview: false,
      isActive: true,
    });
  });
  it('validates query values at the API boundary', () => {
    expect(
      validateSync(
        plainToInstance(MasterDataListQueryDto, {
          mealServiceStatus: 'under_review',
        }),
      ),
    ).toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(MasterDataListQueryDto, {
          mealServiceStatus: 'UNKNOWN',
        }),
      ),
    ).not.toHaveLength(0);
  });
});
