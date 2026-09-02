import { describe, expect, it } from 'vitest';

import { filterContracts, salesContractPreviews } from './contracts';

describe('sales contract preview filters', () => {
  it('filters contracts by stage', () => {
    expect(
      filterContracts(salesContractPreviews, '', 'آماده اجرا').map(
        (contract) => contract.id,
      ),
    ).toEqual(['NSS-1405-0399']);
  });

  it('searches title, customer, destination and identifier', () => {
    expect(
      filterContracts(salesContractPreviews, 'استانبول', 'همه'),
    ).toHaveLength(1);
    expect(
      filterContracts(salesContractPreviews, '0412', 'همه')[0]?.title,
    ).toBe('تور خانوادگی کیش');
  });
});
