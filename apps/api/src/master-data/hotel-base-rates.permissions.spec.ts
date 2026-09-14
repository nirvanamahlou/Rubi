import { describe, expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { MasterHotelBaseRatesController } from './hotel-base-rates.controller';

describe('MasterHotelBaseRatesController permission metadata', () => {
  it.each([
    ['options', ['master_data.read']],
    ['list', ['master_data.read']],
    ['detail', ['master_data.read']],
    ['create', ['master_data.create']],
    ['update', ['master_data.update']],
  ] as const)('%s requires %j', (method, permissions) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        MasterHotelBaseRatesController.prototype[method],
      ),
    ).toEqual(permissions);
  });
});
