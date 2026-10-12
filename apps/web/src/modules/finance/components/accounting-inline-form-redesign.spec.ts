import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = (name: string) =>
  readFileSync(
    join(process.cwd(), 'src', 'modules', 'finance', 'components', name),
    'utf8',
  );

const ledger = component('accounting-ledger-editor.tsx');
const chart = component('accounting-chart-editor.tsx');
const detail = component('accounting-detail-editor.tsx');
const baseList = component('accounting-base-list.tsx');
const documentList = component('accounting-document-list.tsx');
const workspace = component('accounting-navigation-workspace.tsx');
const styles = component('accounting-navigation-workspace.module.css');

describe('accounting inline form redesign', () => {
  it('keeps the established fields inside the three core inline editors', () => {
    for (const id of [
      'ledger-code',
      'ledger-title',
      'ledger-title-en',
      'ledger-description',
      'ledger-branch',
      'ledger-currency',
      'ledger-notes',
    ]) {
      expect(ledger).toContain(`id="${id}"`);
    }
    for (const token of [
      'coa-code',
      "text('title', 'عنوان', true)",
      "text('titleEn', 'عنوان به زبان دوم')",
      'coa-description',
    ]) {
      expect(chart).toContain(token);
    }
    for (const key of [
      'title',
      'titleEn',
      'description',
      'code',
      'active',
      'typeId',
      'parentId',
      'currency',
    ]) {
      expect(detail).toContain(`${key}:`);
    }

    expect(ledger).toContain('data-accounting-inline-form');
    expect(chart).toContain('data-accounting-inline-form');
    expect(detail).toContain('data-accounting-inline-form');
  });

  it('keeps forms inline and scopes the presentation to accounting', () => {
    expect(workspace).toContain('data-accounting-inline-surface');
    expect(styles).toContain('.formSurface :global(form)');
    expect(styles).toContain('[data-accounting-inline-form]');
    expect(styles).not.toContain('position: fixed');
  });

  it('places list actions and filters before their tables', () => {
    expect(baseList.indexOf('data-accounting-filter-bar')).toBeLessThan(
      baseList.indexOf('<table'),
    );
    expect(baseList.indexOf('data-accounting-filter-panel')).toBeLessThan(
      baseList.indexOf('<table'),
    );
    expect(documentList.indexOf('{toolbar()}')).toBeLessThan(
      documentList.indexOf('data-accounting-filter-panel'),
    );
    expect(documentList.indexOf('data-accounting-filter-panel')).toBeLessThan(
      documentList.indexOf('<table'),
    );
  });
});
