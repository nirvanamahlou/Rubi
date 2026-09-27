import { describe, expect, it } from 'vitest';

import { workbenchRequestPriorityLabel } from './workbench-request-priority';

describe('workbenchRequestPriorityLabel', () => {
  it.each([
    ['LOW', 'پایین'],
    ['normal', 'عادی'],
    ['HIGH', 'بالا'],
    ['URGENT', 'فوری'],
  ])('renders %s in Persian', (priority, expected) => {
    expect(workbenchRequestPriorityLabel(priority)).toBe(expected);
  });

  it('keeps an unknown or missing priority understandable', () => {
    expect(workbenchRequestPriorityLabel('P0')).toBe('تعیین نشده');
    expect(workbenchRequestPriorityLabel(null)).toBe('تعیین نشده');
  });
});
