import { describe, expect, it } from 'vitest';

import { WORKBENCH_FEEDBACK_DEPARTMENTS } from './index';

describe('workbench feedback contract', () => {
  it('publishes only routable Rubi departments', () => {
    expect(WORKBENCH_FEEDBACK_DEPARTMENTS).toEqual([
      'finance',
      'reservations',
      'sales',
      'visa',
      'hr',
      'management',
    ]);
    expect(WORKBENCH_FEEDBACK_DEPARTMENTS).not.toContain('ai');
  });
});
