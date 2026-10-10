import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { UserPasswordReset } from './user-password-reset';
import {
  initialUserPasswordError,
  userPasswordError,
} from './user-password-policy';

describe('initial user password', () => {
  it.each(['1234', '0000', '123456', 'abcd', '0'.repeat(200)])(
    'accepts simple initial credentials',
    (password) => {
      expect(initialUserPasswordError(password)).toBeNull();
    },
  );
  it.each(['', '123', '0'.repeat(201)])(
    'rejects invalid length',
    (password) => {
      expect(initialUserPasswordError(password)).not.toBeNull();
    },
  );
  it('retains the strong reset policy', () => {
    expect(userPasswordError('1234')).not.toBeNull();
  });
});
describe('user creation and password reset controls', () => {
  it.each([
    'Valid-Synthetic-2026!',
    'Aa1!' + 'x'.repeat(6),
    'Aa1!' + 'x'.repeat(196),
  ])('accepts valid password lengths and complexity', (password) =>
    expect(userPasswordError(password)).toBeNull(),
  );
  it.each([
    'short',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoNumbersPassword!',
    'NoSymbolsPassword123',
    'Aa1!' + 'x'.repeat(197),
  ])('explains invalid credentials before sending', (password) =>
    expect(userPasswordError(password)).toContain('۱۰ تا ۲۰۰'),
  );
  it('renders a separate confirmation form with no old password requirement', () => {
    const html = renderToStaticMarkup(
      <UserPasswordReset
        name="Synthetic user"
        disabled={false}
        onReset={async () => {}}
      />,
    );
    expect(html).toContain('تغییر رمز Synthetic user');
    expect((html.match(/type="password"/g) ?? []).length).toBe(2);
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain('currentPassword');
    expect(html).toContain('نشست‌های قبلی');
  });
  it('does not block creation while optional role suggestions are open and gates reset to administrators', () => {
    const source = readFileSync(
      new URL('./user-management.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('|| proposalOpen');
    expect(source).toContain('disabled={busy}');
    expect(source).toContain('options.canAssignAll');
    expect(source).toContain('selected.id !== actor?.userId');
    expect(source).toContain('/password');
  });
});
