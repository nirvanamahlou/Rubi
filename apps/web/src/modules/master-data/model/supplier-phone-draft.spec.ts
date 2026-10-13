import { describe, expect, it } from 'vitest';

import { supplierEditValues } from './supplier-phone-draft';

describe('supplier phone edit payload', () => {
  it('preserves the stored phone when the masked field was not touched', () => {
    expect(
      supplierEditValues({ name: 'Supplier', primaryPhone: '' }, false),
    ).toEqual({
      name: 'Supplier',
    });
  });

  it('sends an explicit empty value to clear the phone', () => {
    expect(
      supplierEditValues({ name: 'Supplier', primaryPhone: '' }, true),
    ).toEqual({
      name: 'Supplier',
      primaryPhone: '',
    });
  });

  it('sends a replacement phone after entry', () => {
    expect(supplierEditValues({ primaryPhone: '+12025550124' }, true)).toEqual({
      primaryPhone: '+12025550124',
    });
  });
});
