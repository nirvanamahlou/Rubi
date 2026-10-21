import { describe, it, expect } from 'vitest';
import { hrGroups, resolveHrGroup, resolveHrSource } from './hr-navigation';
describe('legacy roster entry after separating working hours and shift definitions', () => {
  it('loads assigned shifts for the existing calendar link rather than working-hour catalog rows', () => {
    const group = resolveHrGroup(hrGroups.time!, 'shift');
    expect(resolveHrSource(group, 'roster').tab).toBe('shift');
    expect(resolveHrSource(group, 'workingHours').tab).toBe('workingHours');
    expect(resolveHrSource(group, 'shiftTemplates').tab).toBe('shiftTemplates');
  });
  it('never selects an unauthorized assignment source from a filtered group', () => {
    const group = resolveHrGroup(hrGroups.time!, 'shift');
    const limited = {
      ...group,
      sources: group.sources.filter((s) => s.tab === 'workingHours'),
    };
    expect(resolveHrSource(limited, 'roster').tab).toBe('workingHours');
    expect(limited.sources.some((s) => s.tab === 'shift')).toBe(false);
  });
});
