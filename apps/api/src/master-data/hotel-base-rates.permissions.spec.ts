import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { MasterHotelBaseRatesController } from './hotel-base-rates.controller';
import { MasterDataController } from './master-data.controller';
import { MasterDataModule } from './master-data.module';

describe('MasterHotelBaseRatesController permission metadata', () => {
  it('registers hotel rate routes before the generic resource wildcard', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      MasterDataModule,
    ) as unknown[];
    expect(
      controllers.indexOf(MasterHotelBaseRatesController),
    ).toBeGreaterThanOrEqual(0);
    expect(controllers.indexOf(MasterHotelBaseRatesController)).toBeLessThan(
      controllers.indexOf(MasterDataController),
    );
  });

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
