import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(fileName: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/modules/master-data/components', fileName),
    'utf8',
  );
}

describe('Master Data accessibility regressions', () => {
  it('restores focus for forms and profile dialogs', () => {
    const hook = source('use-master-data-dialog-focus-restore.ts');
    expect(hook).toContain('onOpenAutoFocus');
    expect(hook).toContain('onCloseAutoFocus');
    expect(hook).toContain('trigger.focus()');

    for (const fileName of [
      'master-data-form.tsx',
      'master-data-live-form.tsx',
      'master-data-profile-dialog.tsx',
    ]) {
      expect(source(fileName), fileName).toContain('{...focusRestore}');
    }
  });

  it('uses localized custom validation and associates errors with controls', () => {
    const form = source('master-data-live-form.tsx');
    expect(form).toContain('noValidate');
    expect(form).toContain('aria-describedby={describedBy}');
    expect(form).toContain('ariaDescribedby: describedBy');
    expect(form).toContain('invalid={Boolean(error)}');
  });

  it('gives every Master Data table in component workspaces an accessible name', () => {
    for (const fileName of [
      'hotel-import-panel.tsx',
      'master-data-accommodation-workspace.tsx',
      'master-data-currency-form.tsx',
      'master-data-finance-workspace.tsx',
      'master-data-geography-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-live-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-workspace.tsx',
    ]) {
      const component = source(fileName);
      const tableCount = component.match(/<table\b/g)?.length ?? 0;
      const namedTableCount =
        component.match(/<table[\s\S]*?aria-label=/g)?.length ?? 0;
      expect(namedTableCount, fileName).toBe(tableCount);
    }
  });

  it('keeps geography filters within the content width at desktop breakpoints', () => {
    const geography = source('master-data-geography-workspace.tsx');
    expect(geography).toContain('min-w-0 max-w-full space-y-5');
    expect(geography).toContain('xl:grid-cols-3 2xl:grid-cols-[');
  });
});
