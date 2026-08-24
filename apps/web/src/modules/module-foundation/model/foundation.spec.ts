import { describe, expect, it } from 'vitest';

import { foundationModules } from './foundation';

describe('module foundation coverage', () => {
  const configs = Object.values(foundationModules);

  it('covers every remaining foundation route exactly once', () => {
    expect(Object.keys(foundationModules)).toEqual([
      'reservations',
      'ticket-management',
      'sales',
      'purchases',
      'marketing',
      'organizations',
      'human-resources',
      'tasks',
      'documents',
      'reports',
      'integrations',
      'system',
    ]);
    expect(new Set(configs.map((config) => config.key)).size).toBe(12);
  });

  it('provides complete shared UI contracts for every module', () => {
    for (const config of configs) {
      expect(config.title.length).toBeGreaterThan(2);
      expect(config.description.length).toBeGreaterThan(20);
      expect(config.boundary.length).toBeGreaterThan(20);
      expect(config.sections.length).toBeGreaterThanOrEqual(3);
      expect(config.metrics).toHaveLength(4);
      expect(config.permissions.length).toBeGreaterThanOrEqual(6);
      expect(config.references.length).toBeGreaterThanOrEqual(3);
      expect(config.rows.length).toBeGreaterThanOrEqual(4);
      expect(config.outputFormats.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses only explicit synthetic preview identifiers', () => {
    for (const config of configs) {
      for (const row of config.rows) {
        expect(row.id).toMatch(/^PREVIEW-/);
        expect(row.title).toContain('نمونه');
        expect(row.owner).toContain('نمونه');
      }
    }
  });

  it('preserves sensitive domain boundaries', () => {
    expect(foundationModules.reservations.boundary).toContain('تخصیص');
    expect(foundationModules['ticket-management'].boundary).toContain(
      'صدور مسافر',
    );
    expect(foundationModules.sales.boundary).toContain('فقط فروش');
    expect(foundationModules.purchases.boundary).toContain(
      'سود فیلد دستی نیست',
    );
    expect(foundationModules.documents.boundary).toContain('ماژول دامنه');
    expect(foundationModules.integrations.boundary).toContain('Secret');
    expect(foundationModules['human-resources'].boundary).toContain('Customer');
  });

  it('keeps exports deferred instead of declaring generated artifacts', () => {
    for (const config of configs) {
      expect(config.outputFormats.every((format) => format.length > 0)).toBe(
        true,
      );
    }
    expect(foundationModules.reports.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: 'Worker' }),
        expect.objectContaining({ owner: 'Documents' }),
      ]),
    );
  });
});
