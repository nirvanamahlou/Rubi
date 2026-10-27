import { describe, it, expect } from 'vitest';
import {
  canonicalHrLocation,
  hrGroups,
  resolveHrGroup,
  resolveHrSource,
} from './hr-navigation';

describe('payroll settings after removing periods and adjustments', () => {
  it('exposes only settings and resolves removed links to the worksheet', () => {
    expect(hrGroups.payroll?.map((group) => group.id)).toEqual(['settings']);
    for (const tab of [
      undefined,
      'periods',
      'adjustments',
      'runs',
      'batch',
      'results',
      'payslips',
      'importedPayslips',
      'payments',
      'accounting',
      'additional',
      'incentives',
      'corrections',
    ]) {
      expect(canonicalHrLocation('payroll', tab)).toEqual({
        section: 'payroll',
        tab: 'settings',
      });
      expect(resolveHrGroup(hrGroups.payroll!, tab).id).toBe('settings');
    }
    expect(canonicalHrLocation('finance', 'payments')).toEqual({
      section: 'payroll',
      tab: 'settings',
    });
    expect(canonicalHrLocation('finance', 'settlements')).toEqual({
      section: 'employees',
      tab: 'settlements',
    });
  });
});
describe('legacy roster entry after separating working hours and shift definitions', () => {
  it('loads assigned shifts for the existing calendar link rather than working-hour catalog rows', () => {
    const group = resolveHrGroup(hrGroups.time!, 'shift');
    expect(resolveHrSource(group, 'roster').tab).toBe('shift');
    const hours = resolveHrGroup(hrGroups.time!, 'workingHours');
    expect(hours.id).toBe('workingHours');
    expect(resolveHrSource(hours, 'workingHours').tab).toBe('workingHours');
    expect(group.sources.some((source) => source.tab === 'workingHours')).toBe(
      false,
    );
    expect(resolveHrSource(group, 'shiftTemplates').tab).toBe('shiftTemplates');
  });
  it('never selects an unauthorized assignment source from a filtered group', () => {
    const group = resolveHrGroup(hrGroups.time!, 'shift');
    const limited = {
      ...group,
      sources: group.sources.filter((s) => s.tab === 'shiftTemplates'),
    };
    expect(resolveHrSource(limited, 'roster').tab).toBe('shiftTemplates');
    expect(limited.sources.some((s) => s.tab === 'shift')).toBe(false);
  });
});
