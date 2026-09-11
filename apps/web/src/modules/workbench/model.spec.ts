import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canAccessWorkbench,
  todayMetrics,
  workbenchTab,
  workbenchTabs,
} from './model';
describe('Workbench boundary and navigation', () => {
  it('denies access by default and never treats management as private access', () => {
    expect(canAccessWorkbench([])).toBe(false);
    expect(canAccessWorkbench(['iam.users.manage'])).toBe(false);
    expect(canAccessWorkbench(['workbench.access'])).toBe(true);
  });
  it('restores only a supported tab from the URL', () => {
    for (const [key] of workbenchTabs) expect(workbenchTab(key)).toBe(key);
    expect(workbenchTab('https://untrusted.example')).toBe('today');
    expect(workbenchTab(null)).toBe('today');
    expect(todayMetrics).toHaveLength(6);
  });
  it('does not introduce browser persistence or a fabricated mutation in the unavailable slice', () => {
    const source = readFileSync(
      new URL('./workbench-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /localStorage|sessionStorage|method:\s*['"]POST|console\./,
    );
    expect(source.replace(/\s+/g, ' ')).toContain(
      'ثبت درخواست، پیام و اطلاعات شخصی هنوز فعال نیست',
    );
    expect(source).toContain('canAccessWorkbench(identity.user.permissions)');
    expect(source).toContain('scroll: false');
  });
});
