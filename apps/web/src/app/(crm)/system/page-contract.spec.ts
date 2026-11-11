import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const systemPageSource = readFileSync(
  new URL('./page.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = readFileSync(
  new URL(
    '../../../modules/system-management/components/system-management-workspace.tsx',
    import.meta.url,
  ),
  'utf8',
);
const operationsPageSource = readFileSync(
  new URL('./operations/page.tsx', import.meta.url),
  'utf8',
);

describe('system management access', () => {
  it('uses the dedicated management center rather than a placeholder workspace', () => {
    expect(systemPageSource).toContain('SystemManagementWorkspace');
    expect(systemPageSource).not.toContain('ModuleFoundationWorkspace');
    expect(systemPageSource).not.toContain('<Link');
    expect(workspaceSource).toContain('href="/system/users"');
  });

  it('shows user management and permission-gated activity history', () => {
    expect(workspaceSource).toContain("routeAllowed('/system/users')");
    expect(workspaceSource).toContain(
      "permissions?.includes('system.audit.read')",
    );
    expect(workspaceSource).toContain("['کاربر', 'بخش', 'اقدام', 'تاریخ']");
    expect(workspaceSource).not.toContain('settingsModules');
    expect(workspaceSource).not.toContain('/system/operations');
  });

  it('keeps the existing operations route available to authorized callers', () => {
    expect(operationsPageSource).toContain(
      'عملیات حساس در API مالک دوباره مجوزسنجی و ثبت Audit می‌شود',
    );
  });
});
