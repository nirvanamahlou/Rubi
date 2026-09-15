import { describe, expect, it } from 'vitest';

import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { MasterDataController } from './master-data.controller';
import { MasterDataLogoController } from './master-data-logo.controller';

describe('MasterDataController permission metadata', () => {
  it.each([
    ['downloadXlsx', 'master_data.export'],
    ['requestExport', 'master_data.export'],
    ['exportStatus', 'master_data.export'],
    ['list', 'master_data.read'],
    ['insuranceSummary', 'master_data.read'],
    ['travelServicesSummary', 'master_data.read'],
    ['detail', 'master_data.read'],
    ['create', 'master_data.create'],
    ['update', 'master_data.update'],
    ['status', 'master_data.status.manage'],
    ['remove', 'master_data.delete'],
  ] as const)('requires %s on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        MasterDataController.prototype[method],
      ),
    ).toEqual([permission]);
  });
});

describe('MasterDataLogoController permission metadata', () => {
  it.each(['replace', 'remove'] as const)(
    'requires master_data.update on %s',
    (method) => {
      expect(
        Reflect.getMetadata(
          PERMISSIONS_KEY,
          MasterDataLogoController.prototype[method],
        ),
      ).toEqual(['master_data.update']);
    },
  );
});
