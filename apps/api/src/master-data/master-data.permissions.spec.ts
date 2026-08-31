import { describe, expect, it } from 'vitest';

import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { MasterDataController } from './master-data.controller';

describe('MasterDataController permission metadata', () => {
  it.each([
    ['downloadXlsx', 'master_data.export'],
    ['requestExport', 'master_data.export'],
    ['exportStatus', 'master_data.export'],
    ['list', 'master_data.read'],
    ['detail', 'master_data.read'],
    ['create', 'master_data.create'],
    ['update', 'master_data.update'],
    ['status', 'master_data.status.manage'],
  ] as const)('requires %s on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        MasterDataController.prototype[method],
      ),
    ).toEqual([permission]);
  });
});
