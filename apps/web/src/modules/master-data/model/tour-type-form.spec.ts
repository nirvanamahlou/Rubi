import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import {
  tourTypeFormValues,
  tourTypeMutationValues,
  tourTypeUpdatedLabel,
  tourTypeUsageLabel,
  validateTourTypeForm,
} from './tour-type-form';

const record: MasterDataRecord = {
  id: 'tour-test',
  resource: 'tour-types',
  code: 'TOUR_TEST',
  name: 'تور آزمون',
  status: 'inactive',
  version: 3,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T01:00:00Z',
  attributes: {
    englishName: 'Test Tour',
    scope: 'BOTH',
    description: 'شرح',
    displayOrder: 4,
    updatedByUserId: 'test-user',
  },
};
const valid = { ...tourTypeFormValues(), name: 'تور', scope: 'BOTH' };
describe('tour form model', () => {
  it('loads all existing form values without erasing optional data', () => {
    expect(tourTypeFormValues(record)).toEqual({
      name: 'تور آزمون',
      englishName: 'Test Tour',
      scope: 'BOTH',
      description: 'شرح',
      displayOrder: '4',
      status: 'inactive',
    });
  });
  it.each(['scope', 'status', 'name'])(
    'requires selection again after clearing %s',
    (field) => {
      expect(
        validateTourTypeForm({ ...valid, [field]: '' }).errors,
      ).toHaveProperty(field);
    },
  );
  it.each(['DOMESTIC', 'INTERNATIONAL', 'BOTH'])(
    'accepts scope %s',
    (scope) => {
      expect(validateTourTypeForm({ ...valid, scope }).success).toBe(true);
    },
  );
  it.each([
    { displayOrder: '-1' },
    { displayOrder: '1.1' },
    { displayOrder: 'Infinity' },
    { displayOrder: '2147483648' },
    { name: 'x'.repeat(161) },
    { englishName: 'x'.repeat(161) },
    { description: 'x'.repeat(1001) },
    { scope: 'OTHER' },
    { status: 'OTHER' },
  ])('rejects %j', (extra) => {
    expect(validateTourTypeForm({ ...valid, ...extra }).success).toBe(false);
  });
  it('allows the full 1000-character description and drops read-only metadata', () => {
    const result = tourTypeMutationValues({
      ...valid,
      description: 'x'.repeat(1000),
      code: 'MANUAL',
      updatedAt: 'fake',
      updatedByUserId: 'fake',
      usageCount: '28',
    });
    expect(result.description).toHaveLength(1000);
    for (const key of [
      'code',
      'updatedAt',
      'updatedByUserId',
      'usageCount',
      'status',
    ])
      expect(result).not.toHaveProperty(key);
  });
  it('only sends status for a real transition, preserving editor permissions', () => {
    expect(
      tourTypeMutationValues(tourTypeFormValues(record), record),
    ).not.toHaveProperty('status');
    expect(
      tourTypeMutationValues(
        { ...tourTypeFormValues(record), status: 'active' },
        record,
      ).status,
    ).toBe('active');
    expect(
      tourTypeMutationValues({ ...valid, status: 'inactive' }).status,
    ).toBe('inactive');
  });
  it('keeps unavailable usage distinct from a measured zero', () => {
    expect(tourTypeUsageLabel(record)).toContain('در انتظار');
    expect(
      tourTypeUsageLabel({
        ...record,
        attributes: { usageStatus: 'AVAILABLE', usageCount: 0 },
      }),
    ).toBe('۰ محصول');
    expect(
      tourTypeUsageLabel({
        ...record,
        attributes: { usageStatus: 'UNAVAILABLE', usageCount: 28 },
      }),
    ).toContain('در انتظار');
  });
  it('uses a permitted real name or the actual actor id, never a mockup name', () => {
    expect(
      tourTypeUpdatedLabel(record, { 'test-user': 'کاربر آزمون' }),
    ).toContain('کاربر آزمون');
    expect(tourTypeUpdatedLabel(record)).toContain('test-user');
    expect(tourTypeUpdatedLabel()).toContain('پس از ثبت');
  });
});
