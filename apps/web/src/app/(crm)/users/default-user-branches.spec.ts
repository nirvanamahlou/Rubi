import { describe, expect, it } from 'vitest';
import { defaultNewUserBranches } from './default-user-branches';

describe('new-user company branch defaults', () => {
  it('uses actual IDs for all five named branches, never guessed IDs or extra scopes', () => {
    expect(
      defaultNewUserBranches([
        { id: 'hq', name: 'دفتر مرکزی' },
        { id: 'n', name: 'شرکت نيايش سير سحر' },
        { id: 'b', name: 'جهان باستان' },
        { id: 'g', name: 'قسطی رو' },
        { id: 'a', name: 'جهان آکادمی' },
        { id: 'custom', name: 'شعبه سفارشی' },
      ]),
    ).toEqual(['hq', 'n', 'b', 'g', 'a']);
    expect(defaultNewUserBranches([])).toEqual([]);
  });
});
