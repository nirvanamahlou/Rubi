import { describe, expect, it } from 'vitest';
import { resolvedCallCenterBranch } from './branch-context';
describe('Call Center branch bootstrap', () => {
  it('uses server employee context rather than first login branch', () => {
    expect(
      resolvedCallCenterBranch(['academy', 'office'], {
        data: [{ id: 'academy' }, { id: 'office' }],
        meta: { defaultBranchId: 'office' },
      }),
    ).toBe('office');
  });
  it('rejects a preferred branch absent from authorized API options', () => {
    expect(
      resolvedCallCenterBranch(['academy', 'office'], {
        data: [{ id: 'academy' }],
        meta: { defaultBranchId: 'office' },
      }),
    ).toBeNull();
  });
  it('rejects response options outside the authenticated account branches', () => {
    expect(
      resolvedCallCenterBranch(['academy'], {
        data: [{ id: 'office' }],
        meta: { defaultBranchId: 'office' },
      }),
    ).toBeNull();
  });
  it('does not silently fall back to academy for ambiguous legacy responses', () => {
    expect(
      resolvedCallCenterBranch(['academy', 'office'], {
        data: [{ id: 'academy' }, { id: 'office' }],
      }),
    ).toBeNull();
  });
  it('supports a single authorized branch from a legacy API', () => {
    expect(
      resolvedCallCenterBranch(['office'], { data: [{ id: 'office' }] }),
    ).toBe('office');
  });
});
