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
  });

  it('retains navigation links without showing the Legal Entity callout', () => {
    expect(workspaceSource).toContain("href: '/users'");
    expect(workspaceSource).toContain("href: '/system/legal-entities'");
    expect(workspaceSource).not.toContain("owner: 'Legal Entity'");
    expect(workspaceSource).not.toContain(
      'هویت حقوقی، Branding و سربرگ‌ها در ماژول مالک ثبت می‌شوند.',
    );
  });

  it('does not duplicate owner APIs and exposes the live operations panel', () => {
    expect(operationsPageSource).toContain(
      'عملیات حساس در API مالک دوباره مجوزسنجی و ثبت Audit می‌شود',
    );
    expect(workspaceSource).toContain('managementAreas');
    expect(workspaceSource).not.toContain('legalEntitiesApi.selectable');
    expect(workspaceSource).toContain("scope: 'GLOBAL'");
  });
});
