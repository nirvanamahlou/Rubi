import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('authenticated user menu integration', () => {
  const menuSource = fs.readFileSync(
    path.resolve(__dirname, 'user-menu.tsx'),
    'utf8',
  );
  const shellSource = fs.readFileSync(
    path.resolve(__dirname, 'app-shell.tsx'),
    'utf8',
  );
  const profileSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../modules/profile/components/profile-workspace.tsx',
    ),
    'utf8',
  );

  it('shows a responsive avatar, authenticated name, loading text and safe fallback', () => {
    expect(menuSource).toContain('در حال دریافت کاربر');
    expect(menuSource).toContain('PROFILE_USER_FALLBACK');
    expect(menuSource).toContain('refreshAuthenticatedSession(api)');
    expect(menuSource).toContain('rememberHeaderSession(');
    expect(menuSource).toContain('response.user');
    expect(menuSource).toContain('max-w-32 truncate');
    expect(menuSource).toContain('lg:block');
    expect(menuSource).toContain('data-user-menu-trigger');
  });

  it('shows only Workbench and logout menu actions', () => {
    expect(menuSource).toContain('href="/workbench"');
    expect(menuSource).not.toContain('href="/profile"');
    expect(menuSource).not.toContain('href="/profile?tab=preferences"');
    expect(menuSource).not.toContain('href="/profile?tab=security"');
    expect(menuSource).toContain('DropdownMenuTrigger asChild');
  });

  it('uses the existing logout operation and keeps notifications in the shell', () => {
    expect(menuSource).toContain('logoutAuthenticatedSession()');
    expect(menuSource).toContain('clearHeaderSession()');
    expect(shellSource).toContain('<NotificationCenter />');
    expect(shellSource).toContain('<UserMenu />');
  });

  it('keeps access details read-only and separates personal preferences from session logs', () => {
    expect(profileSource).toContain('شعب مجاز');
    expect(profileSource).toContain('خلاصه دسترسی‌ها');
    expect(profileSource).toContain('لاگ نشست‌ها');
    expect(profileSource).not.toContain('aria-label="بخش‌های پروفایل"');
    expect(profileSource).toContain('<PersonalDetailsForm');
    expect(profileSource).toContain('وضعیت MFA');
    expect(profileSource).not.toMatch(
      /accessToken|refreshToken|document\.cookie|localStorage|type="password"/i,
    );
    expect(profileSource).not.toMatch(
      /role.*(update|edit)|permission.*(update|edit)/i,
    );
  });
});
