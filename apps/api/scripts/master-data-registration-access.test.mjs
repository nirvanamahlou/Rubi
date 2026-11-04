import { describe, expect, it } from 'vitest';
import {
  parseArguments,
  registrationSelection,
} from './master-data-registration-access.mjs';

const catalog = {
  USER_ACCESS_SCREENS: [
    { id: 'master-data.home', group: 'master-data' },
    { id: 'master-data.geography', group: 'master-data' },
    { id: 'master-data.accommodation.hotel-rates', group: 'master-data' },
    { id: 'system.users', group: 'system' },
  ],
  USER_ACCESS_DENY_CONTROLS: [
    { id: 'field.master-data.countries.name' },
    { id: 'master-data.resource.countries' },
    { id: 'master-data.geography' },
    { id: 'field.system-settings.master.import' },
    { id: 'system.users' },
  ],
};
const before = {
  permissionCodes: ['sales.contracts.read.own', 'unknown.extension.read'],
  screenIds: ['sales.contracts'],
  allowedControlIds: ['field.customers.firstName'],
};

describe('explicit local Master Data registration grant', () => {
  it('preserves unrelated access and only adds registration authority', () => {
    const result = registrationSelection(before, catalog);
    expect(result.permissionCodes).toEqual([
      'master_data.create',
      'master_data.currency_rate.create',
      'master_data.read',
      ...before.permissionCodes,
    ]);
    expect(result.screenIds).toEqual([
      'master-data.geography',
      'master-data.home',
      'sales.contracts',
    ]);
    expect(result.allowedControlIds).toEqual([
      'field.customers.firstName',
      'field.master-data.countries.name',
      'master-data.geography',
      'master-data.resource.countries',
    ]);
    expect(before.permissionCodes).toHaveLength(2);
  });
  it('is idempotent and retains existing broader grants without adding them', () => {
    const existing = {
      ...before,
      permissionCodes: [...before.permissionCodes, 'master_data.update'],
    };
    const once = registrationSelection(existing, catalog);
    expect(registrationSelection(once, catalog)).toEqual(once);
    expect(once.permissionCodes).toContain('master_data.update');
    expect(once.permissionCodes).not.toContain('master_data.delete');
    expect(once.permissionCodes).not.toContain(
      'master_data.currency_rate.approve',
    );
  });
  it('requires explicit exact targets, an operator and the database', () => {
    const operator = '11111111-1111-4111-8111-111111111111';
    expect(
      parseArguments(['--preview', 'local_test', operator, 'synthetic-a']).mode,
    ).toBe('--preview');
    for (const args of [
      [],
      ['--apply', 'local_test', operator],
      ['--apply', 'local_test', operator, '*'],
      ['--apply', 'local_test', operator, 'same', 'same'],
    ])
      expect(() => parseArguments(args)).toThrow('Usage');
  });
});
