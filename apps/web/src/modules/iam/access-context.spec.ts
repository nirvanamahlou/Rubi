import { describe, expect, it, vi } from 'vitest';

import { tabAccessDecision } from './access-context';

describe('tab access decision', () => {
  it('keeps ordinary form tabs visible when they are not access screens', () => {
    const canView = vi.fn(() => false);

    expect(tabAccessDecision(undefined, canView)).toBe(true);
    expect(canView).not.toHaveBeenCalled();
  });

  it('continues to enforce access for catalogued screen tabs', () => {
    expect(tabAccessDecision('finance.overview', () => false)).toBe(false);
    expect(tabAccessDecision('finance.overview', () => true)).toBe(true);
  });
});
