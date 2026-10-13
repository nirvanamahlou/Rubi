import { describe, expect, it } from 'vitest';

import { getMasterDataDefinition } from '../model/catalog';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { withAppendedMasterDataReference } from './master-data-live-form';

describe('supplier inline canonical service creation', () => {
  it('reuses canonical travel-service name and generated-code fields', () => {
    expect(getMasterDataDefinition('travel-services').fields).toEqual([
      expect.objectContaining({
        key: 'code',
        hint: 'هنگام ذخیره به‌صورت خودکار تولید می‌شود.',
      }),
      expect.objectContaining({ key: 'name', required: true }),
    ]);
    expect(
      getMasterDataDefinition('travel-services').fields[0],
    ).not.toHaveProperty('required');
    expect(getReferenceFieldConfig('suppliers', 'serviceCodes')).toMatchObject({
      target: 'travel-services',
      payload: 'code',
      multiple: true,
      optional: true,
    });
  });

  it('appends the returned code while preserving the supplier draft', () => {
    const draft = {
      name: 'تأمین‌کننده آزمون',
      primaryPhone: '+989120000000',
      serviceCodes: 'HOTEL,FLIGHT',
    };

    expect(
      withAppendedMasterDataReference(draft, 'serviceCodes', 'TRANSFER'),
    ).toEqual({
      ...draft,
      serviceCodes: 'HOTEL,FLIGHT,TRANSFER',
    });
    expect(
      withAppendedMasterDataReference(draft, 'serviceCodes', 'HOTEL'),
    ).toEqual(draft);
    expect(draft.serviceCodes).toBe('HOTEL,FLIGHT');
  });
});
