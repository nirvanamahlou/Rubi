import { describe, expect, it, vi } from 'vitest';
import { createTourBranches } from './tour-branches';
describe('independent branch tour creation', () => {
  it('submits each selected branch once and retains successful results on partial failure', async () => {
    let pending = ['a', 'b', 'a', 'c'];
    const saved: string[] = [];
    const create = vi.fn(async (branch: string) => {
      if (branch === 'b') throw new Error('Offline');
      return branch;
    });
    const complete = (branch: string, result: string) => {
      saved.push(result);
      pending = pending.filter((id) => id !== branch);
    };
    await expect(createTourBranches(pending, create, complete)).rejects.toThrow(
      'Offline',
    );
    expect(saved).toEqual(['a']);
    expect(pending).toEqual(['b', 'c']);
    await createTourBranches(pending, async (branch) => branch, complete);
    expect(saved).toEqual(['a', 'b', 'c']);
    expect(pending).toEqual([]);
  });
});
