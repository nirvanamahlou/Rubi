import { expect, it } from 'vitest';
import { hrCompanyDirectory } from './hr-company-directory';

it('lists the real company independently of a differently named subsidiary', () => {
  const result = hrCompanyDirectory({
    branches: [{ id: 'company', code: 'company', name: 'جهان باستان' }],
    records: [],
  });
  expect(result[0]).toMatchObject({
    id: 'company',
    name: 'جهان باستان',
    organizationBranchId: '',
  });
  expect(result[1]).toMatchObject({
    name: 'همه شرکت‌ها',
    isHeadquarters: true,
    branchIds: ['company'],
  });
});
it('groups equivalent company names without losing ownership identifiers', () => {
  const result = hrCompanyDirectory({
    branches: [
      { id: 'a', code: 'a', name: 'جهان آکادمی' },
      { id: 'b', code: 'b', name: 'جهان آکادمی' },
    ],
    records: [],
  });
  expect(result[0]?.branchIds).toEqual(['a', 'b']);
  expect(result).toHaveLength(2);
});
