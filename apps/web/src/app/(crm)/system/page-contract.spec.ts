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

describe('system management access', () => {
  it('uses the dedicated management center rather than a placeholder workspace', () => {
    expect(systemPageSource).toContain('SystemManagementWorkspace');
    expect(systemPageSource).not.toContain('ModuleFoundationWorkspace');
  });

  it('retains real owner links for IAM and Legal Entity', () => {
    expect(workspaceSource).toContain("href: '/users'");
    expect(workspaceSource).toContain("href: '/system/legal-entities'");
    expect(workspaceSource).toContain('Legal Entity');
  });

  it('does not add a navigation item or bypass owner APIs', () => {
    expect(workspaceSource).toContain(
      'هر عملیات حساس در API ماژول مالک دوباره مجوزسنجی می‌شود',
    );
    expect(workspaceSource).toContain('managementAreas');
  });
});
