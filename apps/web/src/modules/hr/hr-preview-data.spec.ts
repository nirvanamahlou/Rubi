import { describe, expect, it } from 'vitest';
import { getHrPreviewDataset } from './hr-preview-data';
import { employeeTabs, sectionTabs, type HrSectionId } from './hr.model';

const tabbedSections = [
  'recruitment',
  'lifecycle',
  'contracts',
  'time',
  'development',
  'expenses',
  'benefits',
  'fleet',
  'requests',
  'finance',
  'reports',
  'payroll',
  'hrSettings',
] as const satisfies readonly HrSectionId[];

describe('HR preview datasets', () => {
  it('provides a complete and structurally valid dataset for every subpage', () => {
    for (const section of tabbedSections) {
      for (const tab of sectionTabs[section] ?? []) {
        const dataset = getHrPreviewDataset(section, tab.id);
        expect(dataset.rows.length).toBeGreaterThan(0);
        expect(dataset.totalLabel).toContain('آزمایشی');
        for (const row of dataset.rows) {
          expect(row).toHaveLength(dataset.columns.length);
          expect(row[0]).toMatch(/^preview-/);
        }
      }
    }
    for (const section of ['assets', 'documents'] as const) {
      const dataset = getHrPreviewDataset(section, 'list');
      expect(dataset.rows[0]).toHaveLength(dataset.columns.length);
    }
    for (const tab of employeeTabs.filter(({ id }) => id !== 'summary')) {
      const dataset = getHrPreviewDataset('employee', tab.id);
      expect(dataset.rows[0]).toHaveLength(dataset.columns.length);
      expect(dataset.totalLabel).toContain('آزمایشی');
    }
  });

  it('uses different columns and records for different subpages', () => {
    for (const section of tabbedSections) {
      const tabs = sectionTabs[section] ?? [];
      const datasets = tabs.map((tab) => getHrPreviewDataset(section, tab.id));
      expect(
        new Set(datasets.map(({ columns }) => columns.join('|'))).size,
      ).toBe(tabs.length);
      expect(
        new Set(datasets.map(({ rows }) => JSON.stringify(rows))).size,
      ).toBe(tabs.length);
    }
  });
});
