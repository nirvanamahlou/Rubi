import { describe, expect, it } from 'vitest';
import { salesInsuranceDisplayName } from './sales-insurance-picker';

describe('Sales insurance labels', () => {
  it('shows the plan and insurer names without the internal code', () => {
    expect(
      salesInsuranceDisplayName({
        name: 'طرح مسافرتی اروپا',
        attributes: { insurerName: 'بیمه سامان' },
      }),
    ).toBe('طرح مسافرتی اروپا — بیمه سامان');
  });
});
