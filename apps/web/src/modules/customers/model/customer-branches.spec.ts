import { describe, expect, it } from 'vitest';
import { customerBranchOptions } from './customer-branches';

describe('customer branch labels', () => {
  it('uses real names by ID, preserving customer scope and excluding other branches', () => {
    expect(
      customerBranchOptions(
        ['b', 'a', 'b'],
        [
          { id: 'a', code: 'A', name: 'شعبه الف' },
          { id: 'b', code: 'B', name: ' شعبه ب ' },
          { id: 'outside', code: 'X', name: 'خارج از دسترسی' },
        ],
      ),
    ).toEqual([
      { id: 'b', name: 'شعبه ب', unavailable: false },
      { id: 'a', name: 'شعبه الف', unavailable: false },
    ]);
  });
  it('does not expose a UUID or fabricate a missing or blank name', () => {
    const options = customerBranchOptions(
      ['missing', 'empty'],
      [{ id: 'empty', code: 'E', name: '  ' }],
    );
    for (const option of options) {
      expect(option.name).toBe('نام شعبه در دسترس نیست');
      expect(option.unavailable).toBe(true);
    }
    expect(
      customerBranchOptions([], [{ id: 'a', code: 'A', name: 'شعبه الف' }]),
    ).toEqual([]);
  });
});
