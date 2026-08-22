import { describe, expect, it } from 'vitest';

import { assertStrongPassword, passwordPolicyErrors } from './password-policy';

describe('IAM password policy', () => {
  it('accepts a sufficiently strong password', () => {
    expect(passwordPolicyErrors('Rubi-Strong-2026!')).toEqual([]);
    expect(() => assertStrongPassword('Rubi-Strong-2026!')).not.toThrow();
  });

  it('rejects short and single-class passwords', () => {
    expect(passwordPolicyErrors('password').length).toBeGreaterThan(1);
    expect(() => assertStrongPassword('password')).toThrow();
  });
});
