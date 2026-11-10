import { describe, expect, it } from 'vitest';
import { insuranceActionState } from './use-insurance-status';
describe('insurance action status', () => {
  it('does not show a successful issue for absent or partial results', () => {
    expect(insuranceActionState()).toBe('none');
    expect(
      insuranceActionState({
        selected: false,
        total: 0,
        ready: false,
        sandbox: true,
      }),
    ).toBe('none');
    expect(
      insuranceActionState({
        selected: true,
        total: 0,
        ready: false,
        sandbox: true,
      }),
    ).toBe('incomplete');
    expect(
      insuranceActionState({ total: 2, ready: false, sandbox: true }),
    ).toBe('incomplete');
    expect(insuranceActionState({ total: 2, ready: true, sandbox: true })).toBe(
      'ready',
    );
  });
});
