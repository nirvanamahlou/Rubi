import { describe, expect, it } from 'vitest';

import { loginErrorMessage, loginInputError } from './login-error';

describe('login error messages', () => {
  it('uses the credential message only for unauthorized responses', () => {
    expect(loginErrorMessage(401)).toBe('نام کاربری یا رمز عبور صحیح نیست.');
    expect(loginErrorMessage(400)).not.toContain('رمز عبور صحیح نیست');
    expect(loginErrorMessage(500)).not.toContain('رمز عبور صحیح نیست');
  });

  it('separates validation, rate-limit and server failures', () => {
    expect(loginErrorMessage(400)).toContain('اطلاعات ورود');
    expect(loginErrorMessage(429)).toContain('تلاش');
    expect(loginErrorMessage(503)).toContain('سرور');
  });

  it('returns visible feedback instead of relying on silent browser validation', () => {
    expect(loginInputError('', '')).toContain('کامل');
    expect(loginInputError('ab', 'password')).toContain('حداقل');
    expect(loginInputError('نام کاربری', 'password')).toContain('حروف لاتین');
    expect(loginInputError('staff.user', 'password')).toBeNull();
  });
});
