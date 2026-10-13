import { describe, expect, it } from 'vitest';

import {
  assertStrongPassword,
  initialPasswordPolicyErrors,
  passwordPolicyErrors,
} from './password-policy';

describe('initial password policy', () => {
  it.each(['1234', '0000', '123456', 'abcd', '0'.repeat(200)])(
    'accepts %s',
    (password) => {
      expect(initialPasswordPolicyErrors(password)).toEqual([]);
    },
  );
  it.each(['', '123', '0'.repeat(201)])(
    'rejects invalid length',
    (password) => {
      expect(initialPasswordPolicyErrors(password)).not.toEqual([]);
    },
  );
  it('keeps numeric initial credentials invalid for strong-password operations', () => {
    expect(() => assertStrongPassword('1234')).toThrow();
  });
});

describe('IAM password policy', () => {
  it.each([10, 11, 12])(
    'accepts all required character classes at length %i',
    (length) => {
      expect(passwordPolicyErrors('Aa1!' + 'x'.repeat(length - 4))).toEqual([]);
    },
  );

  it('rejects nine characters even with all required character classes', () => {
    expect(() => assertStrongPassword('Aa1!xxxxx')).toThrow('حداقل ۱۰ نویسه');
  });

  it.each(['AAAAAAAA1!', 'aaaaaaaa1!', 'Aaaaaaaa!!', 'Aaaaaaaa11'])(
    'still rejects a missing character class in %s',
    (password) => expect(() => assertStrongPassword(password)).toThrow(),
  );

  it('accepts a sufficiently strong password', () => {
    expect(passwordPolicyErrors('Nora-Strong-2026!')).toEqual([]);
    expect(() => assertStrongPassword('Nora-Strong-2026!')).not.toThrow();
  });

  it('rejects short and single-class passwords', () => {
    expect(passwordPolicyErrors('password').length).toBeGreaterThan(1);
    expect(() => assertStrongPassword('password')).toThrow();
  });
});
