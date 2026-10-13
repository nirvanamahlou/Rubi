import { describe, expect, it } from 'vitest';
import { PhoneVerificationRequestGate } from './phone-verification-lifecycle';

describe('cooperation phone request lifecycle', () => {
  it('lets a new request proceed after identity invalidates an in-flight request', () => {
    const gate = new PhoneVerificationRequestGate();
    const staleRequest = gate.begin();
    expect(gate.busy).toBe(true);

    gate.invalidate();
    expect(gate.busy).toBe(false);
    const currentRequest = gate.begin();
    expect(gate.busy).toBe(true);

    expect(gate.settle(staleRequest)).toBe(false);
    expect(gate.busy).toBe(true);
    expect(gate.settle(currentRequest)).toBe(true);
    expect(gate.busy).toBe(false);
  });
});
