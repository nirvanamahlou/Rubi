import { describe, expect, it } from 'vitest';
import type { HrDirectoryResponse } from '@rubi/contracts';
import { assigneeOptions } from './assignee-options';

describe('HR assignee options', () => {
  it('retains unlinked employees visibly but never substitutes their ID for a user ID', () => {
    const rows = [
      {
        id: 'employee-1',
        userId: 'user-1',
        name: 'همکار یک',
        unit: 'پشتیبانی',
      },
      { id: 'employee-2', userId: null, name: 'همکار دو', unit: 'فروش' },
    ] as HrDirectoryResponse['employees'];
    const options = assigneeOptions(rows);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ value: 'user-1', disabled: false });
    expect(options[1]).toMatchObject({
      value: 'unlinked:employee-2',
      disabled: true,
    });
    expect(options[1]?.label).toContain('بدون حساب کاربری متصل');
  });
  it('keeps empty directory results empty', () => {
    expect(assigneeOptions([])).toEqual([]);
  });
});
