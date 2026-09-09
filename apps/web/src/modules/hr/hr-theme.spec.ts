import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hr = readFileSync('src/modules/hr/hr-workspace.module.css', 'utf8');
const frappe = readFileSync(
  'src/modules/hr/frappe-workspace.module.css',
  'utf8',
);
describe('HR dark surfaces', () => {
  it('themes both workspace and portalled dialog tokens', () => {
    const dark = hr.slice(hr.indexOf('/* Dark overrides'));
    expect(dark).toContain(':global(.dark) .workspace');
    expect(dark).toContain(':global(.dark) .modal');
    expect(dark).toContain('--hr-ink: var(--foreground)');
    expect(dark).toContain('--hr-muted: var(--muted-foreground)');
    for (const selector of [
      '.control',
      '.panel',
      '.table th',
      '.hubCard',
      '.orgNode',
      '.employeeBanner',
      '.payrollHero',
    ])
      expect(dark).toContain(selector);
    expect(dark).toContain('background: var(--surface)');
    expect(dark).toContain('outline: 2px solid var(--ring)');
  });
  it('themes the HR landing page and selected section', () => {
    const dark = frappe.slice(frappe.indexOf('/* Frappe landing'));
    for (const selector of [
      '.launcher',
      '.chartCard',
      '.directory',
      '.switcher',
      '.metricCard',
      '.groupCard',
    ])
      expect(dark).toContain(selector);
    expect(dark).toContain(".switcherItem[data-active='true']");
    expect(dark).toContain('color: var(--foreground)');
    expect(dark).toContain('background: var(--surface)');
  });
});
