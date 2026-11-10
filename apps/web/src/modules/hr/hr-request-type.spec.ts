import { describe, expect, it } from 'vitest';
import type { HrRecordDto } from '@nora/contracts';
import { matchesHrRequestType } from './hr-request-type';
import { employeeGroups } from './hr-navigation';
const record = (section: string, tab: string, requestSubtype = '') =>
  ({ section, tab, data: { requestSubtype } }) as HrRecordDto;
describe('HR request category filters', () => {
  it.each([
    ['time', 'leave'],
    ['requests', 'leave'],
    ['requests', 'radanLeave'],
  ])('includes leave from %s.%s', (section, tab) =>
    expect(matchesHrRequestType(record(section, tab), 'leave')).toBe(true),
  );
  it.each([
    ['time', 'corrections'],
    ['requests', 'attendance'],
  ])('includes attendance from %s.%s', (section, tab) =>
    expect(matchesHrRequestType(record(section, tab), 'attendance')).toBe(true),
  );
  it('matches leave subtypes without including missions', () => {
    expect(
      matchesHrRequestType(
        record('requests', 'inbox', 'مرخصی روزانه استحقاقی'),
        'leave',
      ),
    ).toBe(true);
    expect(matchesHrRequestType(record('expenses', 'mission'), 'leave')).toBe(
      false,
    );
  });
  it('filters advances and preserves all requests', () => {
    expect(
      matchesHrRequestType(record('expenses', 'advances'), 'advance'),
    ).toBe(true);
    expect(matchesHrRequestType(record('expenses', 'claims'), 'advance')).toBe(
      false,
    );
    expect(matchesHrRequestType(record('expenses', 'mission'), '')).toBe(true);
  });
  it('keeps requests and missions in the renamed profile group', () => {
    const group = employeeGroups.find((g) => g.id === 'requests')!;
    expect(group.label).toBe('درخواست‌ها و مأموریت‌ها');
    expect(group.sources.map((s) => s.tab)).toEqual(['requests', 'mission']);
  });
});
