import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import {
  parseMasterDataListQuery,
  serializeMasterDataListQuery,
} from '../api/contracts';
import {
  mealServiceFormValues,
  mealServiceMutationValues,
  mealServiceStatus,
  parseIncludedMeals,
  validateMealServiceForm,
} from './meal-service-form';
const record: MasterDataRecord = {
  id: 'meal-test',
  resource: 'meal-services',
  code: 'BB',
  name: 'اتاق و صبحانه',
  status: 'inactive',
  version: 2,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:00Z',
  attributes: {
    englishName: 'Bed & Breakfast',
    category: 'MEAL_PLAN',
    includedMeals: 'صبحانه',
    isUnderReview: true,
    hotelCount: 7,
  },
};
describe('meal/service form state and payload', () => {
  it('preserves current fields, standard code and review status', () => {
    expect(mealServiceFormValues(record)).toEqual({
      code: 'BB',
      name: 'اتاق و صبحانه',
      englishName: 'Bed & Breakfast',
      category: 'MEAL_PLAN',
      includedMeals: '["صبحانه"]',
      status: 'under_review',
    });
  });
  it('does not manufacture defaults when creating', () => {
    expect(mealServiceFormValues()).toMatchObject({
      code: '',
      name: '',
      includedMeals: '[]',
      status: 'active',
    });
  });
  it('round-trips legacy custom values without replacing them with the option catalog', () => {
    const custom = {
      ...record,
      attributes: {
        ...record.attributes,
        includedMealsJson: '["Custom, meal","وعده قدیمی"]',
      },
    };
    expect(
      mealServiceMutationValues(mealServiceFormValues(custom), custom)
        .includedMeals,
    ).toBe('["Custom, meal","وعده قدیمی"]');
  });
  it('omits unchanged status/code and read-only count from mutation', () => {
    const payload = mealServiceMutationValues(
      { ...mealServiceFormValues(record), hotelCount: '999' },
      record,
    );
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('hotelCount');
  });
  it('sends new code, multiple meals and changed status in one request', () => {
    expect(
      mealServiceMutationValues(
        {
          ...mealServiceFormValues(record),
          code: ' fb ',
          includedMeals: '["صبحانه","ناهار","شام"]',
          status: 'active',
        },
        record,
      ),
    ).toMatchObject({
      code: 'FB',
      includedMeals: '["صبحانه","ناهار","شام"]',
      status: 'active',
    });
  });
  it('clears all meals without losing the explicit empty update', () => {
    expect(
      mealServiceMutationValues(
        { ...mealServiceFormValues(record), includedMeals: '[]' },
        record,
      ).includedMeals,
    ).toBe('[]');
  });
  it.each(['code', 'name', 'category', 'status'])(
    'prevents saving after required %s is cleared',
    (key) => {
      const result = validateMealServiceForm({
        ...mealServiceFormValues(record),
        [key]: '',
      });
      expect(result.errors).toHaveProperty(key);
      expect(result.success).toBe(false);
    },
  );
  it.each(['A B', 'فارسی', 'a'.repeat(33)])(
    'rejects invalid code %s',
    (code) => {
      expect(
        validateMealServiceForm({ ...mealServiceFormValues(record), code })
          .errors.code,
      ).toBeTruthy();
    },
  );
  it.each([
    '[1]',
    '[broken',
    '[""]',
    JSON.stringify(Array.from({ length: 21 }, (_, i) => `meal-${i}`)),
  ])('rejects malformed meals %s', (includedMeals) => {
    expect(
      validateMealServiceForm({
        ...mealServiceFormValues(record),
        includedMeals,
      }).errors.includedMeals,
    ).toBeTruthy();
  });
  it('parses Persian and legacy comma-delimited values', () => {
    expect(parseIncludedMeals('صبحانه، شام,صبحانه')).toEqual(['صبحانه', 'شام']);
  });
  it('uses the real lifecycle and preserves old inactive meaning', () => {
    expect(mealServiceStatus(record)).toBe('under_review');
    expect(mealServiceStatus({ ...record, attributes: {} })).toBe('inactive');
  });
  it('serializes the review filter without changing the global status contract', () => {
    const query = parseMasterDataListQuery({
      mealServiceStatus: 'under_review',
    });
    expect(serializeMasterDataListQuery(query)).toContain(
      'mealServiceStatus=under_review',
    );
    expect(() =>
      parseMasterDataListQuery({ status: 'under_review' }),
    ).toThrow();
  });
});
