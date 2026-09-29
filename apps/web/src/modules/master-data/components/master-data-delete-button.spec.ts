import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/modules/master-data/components', file),
    'utf8',
  );
}

describe('Master Data safe deletion UI', () => {
  const button = source('master-data-delete-button.tsx');
  it('requires an explicit confirmation, shows the target name and focuses cancel first', () => {
    expect(button).toContain('<DialogTitle>حذف دائمی رکورد</DialogTitle>');
    expect(button).toContain('target.name');
    expect(button).toContain('قابل بازگشت نیست');
    expect(button).toContain('cancelButton.current?.focus()');
    expect(button).toContain('setTarget({ ...record })');
    expect(button.match(/masterDataApi.remove\(/g)).toHaveLength(1);
    expect(button).toContain('target.resource, target.id, target.version');
  });
  it('prevents duplicate submissions and leaves failures visible without reloading as success', () => {
    expect(button).toContain('if (inFlight.current) return;');
    expect(button).toContain('inFlight.current = true;');
    expect(button).toContain('role="alert"');
    expect(button).toContain('mounted.current');
    expect(button.indexOf('await onDeleted()')).toBeGreaterThan(
      button.indexOf('finally'),
    );
  });
  it.each([
    'finance',
    'geography',
    'suppliers',
    'accommodation',
    'transportation',
    'insurance',
    'travel-services',
    'sales-references',
    'live',
  ])('adds the shared deletion action to the %s list', (name) => {
    const workspace = source(`master-data-${name}-workspace.tsx`);
    expect(workspace).toContain("from './master-data-delete-button'");
    expect(workspace).toContain('<MasterDataDeleteButton');
    expect(workspace).toContain('afterDelete');
  });
  it('preserves the read-only collaboration view and rate history restrictions', () => {
    const suppliers = source('master-data-suppliers-workspace.tsx');
    const actions = suppliers.slice(
      suppliers.indexOf('const rowActions'),
      suppliers.indexOf('function renderProfile'),
    );
    expect(actions.indexOf('<MasterDataDeleteButton')).toBeGreaterThan(
      actions.indexOf("tab !== 'collaboration'"),
    );
    const finance = source('master-data-finance-workspace.tsx');
    expect(finance).toMatch(
      /row.status === 'DRAFT' \? \(\s*(?:<>\s*)?<MasterDataDeleteButton/,
    );
  });
});
