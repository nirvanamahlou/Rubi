import { describe, expect, it } from 'vitest';
import {
  getHrResource,
  type HrBootstrapDto,
  type HrRecordDto,
} from '@rubi/contracts';
import {
  expenseMissionOptions,
  isMissionExpense,
  missionOptionLabel,
} from './hr-mission-reference';
import { prepareHrCommand } from './hr-commands';

const mission = (
  id: string,
  overrides: Partial<HrRecordDto> = {},
): HrRecordDto => ({
  id,
  code: `HR-${id}`,
  branchId: 'branch-a',
  employeeId: 'employee-a',
  section: 'expenses',
  tab: 'mission',
  parentId: null,
  version: 1,
  columns: [...getHrResource('expenses', 'mission')!.columns],
  values: ['همکار آزمایشی', 'شیراز', '2026-09-10', '2026-09-12', 'جلسه', ''],
  status: 'پیش‌نویس',
  data: { organizationBranchId: 'company-a' },
  deletedAt: null,
  appliedAt: null,
  effectiveAt: null,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
  ...overrides,
});
const data = (records: HrRecordDto[]) =>
  ({
    records,
    branches: [],
    employees: [
      {
        id: 'employee-a',
        branchId: 'branch-a',
        organizationBranchId: 'company-a',
      },
      {
        id: 'employee-b',
        branchId: 'branch-a',
        organizationBranchId: 'company-b',
      },
    ],
  }) as unknown as HrBootstrapDto;

describe('expense mission references', () => {
  it('includes stored and legacy missions while respecting employee and company scope', () => {
    const snapshot = data([
      mission('current'),
      mission('legacy', { section: 'time', data: {} }),
      mission('other-employee', { employeeId: 'employee-b', data: {} }),
      mission('other-company', { data: { organizationBranchId: 'company-b' } }),
      mission('other-branch', { branchId: 'branch-b' }),
      mission('deleted', { deletedAt: '2026-09-08T00:00:00Z' }),
      mission('claim', { tab: 'claims' }),
      mission('missing-employee', { employeeId: null }),
    ]);
    expect(
      expenseMissionOptions(
        snapshot,
        'branch-a',
        'company-a',
        'employee-a',
      ).map((r) => r.id),
    ).toEqual(['current', 'legacy']);
    expect(
      expenseMissionOptions(snapshot, 'branch-a', 'company-a').map((r) => r.id),
    ).toEqual(['current', 'legacy']);
    expect(
      expenseMissionOptions(snapshot, 'branch-a', 'empty-company'),
    ).toEqual([]);
  });
  it('distinguishes trips by their stored ID, destination and dates, even for the same employee', () => {
    const trip = mission('mission-001');
    expect(missionOptionLabel(trip)).toBe(
      'HR-mission-001 · همکار آزمایشی · شیراز · 2026-09-10 تا 2026-09-12',
    );
    const next = { ...trip, id: 'mission-002', code: 'HR-mission-002' };
    expect(
      expenseMissionOptions(data([trip, next]), 'branch-a', 'company-a'),
    ).toHaveLength(2);
  });
  it('preserves the actual mission ID in an expense command and permits a truly independent expense', () => {
    const expense = {
      branchId: 'branch-a',
      employeeId: 'employee-a',
      section: 'expenses',
      tab: 'claims',
      values: [
        'همکار آزمایشی',
        'رفت‌وآمد',
        '2026-09-10',
        'IRR',
        '1000',
        '',
        '',
      ],
      data: { currency: 'IRR' },
    };
    expect(
      prepareHrCommand({ ...expense, parentId: 'mission-a' }, data([]))
        .parentId,
    ).toBe('mission-a');
    expect(prepareHrCommand(expense, data([])).parentId).toBeUndefined();
    expect(isMissionExpense('expenses', 'claims')).toBe(true);
    expect(isMissionExpense('expenses', 'mission')).toBe(false);
  });
});
