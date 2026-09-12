import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('login password visibility control', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, 'login-form.tsx'),
    'utf8',
  );

  it('toggles the password input without submitting the login form', () => {
    expect(source).toContain(
      'const [showPassword, setShowPassword] = useState(false)',
    );
    expect(source).toContain("type={showPassword ? 'text' : 'password'}");
    expect(source).toContain(
      'onClick={() => setShowPassword((visible) => !visible)}',
    );
    expect(source).toContain('type="button"');
  });

  it('announces both visibility states to assistive technology', () => {
    expect(source).toContain(
      "showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'",
    );
    expect(source).toContain('aria-pressed={showPassword}');
    expect(source).toContain('<EyeOff aria-hidden="true"');
    expect(source).toContain('<Eye aria-hidden="true"');
  });
});
