import { describe, expect, it } from 'vitest';

import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { HotelImportController } from './hotel-import.controller';

describe('HotelImportController permission metadata', () => {
  it.each(['preview', 'commit'] as const)(
    'requires master_data.import on %s',
    (method) => {
      expect(
        Reflect.getMetadata(
          PERMISSIONS_KEY,
          HotelImportController.prototype[method],
        ),
      ).toEqual(['master_data.import']);
    },
  );
});
