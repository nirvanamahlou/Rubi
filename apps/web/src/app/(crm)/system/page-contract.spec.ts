import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const systemPageSource = readFileSync(
  new URL('./page.tsx', import.meta.url),
  'utf8',
);

describe('system management access', () => {
  it('links to the existing IAM user-management interface', () => {
    expect(systemPageSource).toContain('href="/users"');
    expect(systemPageSource).toContain('ورود به مدیریت کاربران');
  });

  it('links to legal entity management', () => {
    expect(systemPageSource).toContain('href="/system/legal-entities"');
    expect(systemPageSource).toContain('مدیریت شرکت‌های صادرکننده');
  });

  it('links to system settings', () => {
    expect(systemPageSource).toContain('href="/settings"');
    expect(systemPageSource).toContain('ورود به تنظیمات سامانه');
  });
});
