import { describe, expect, it } from 'vitest';
import {
  isOptInCallCenterPermission,
  PERMISSION_SEED_DATA,
} from '../src/permission-seed-data';
describe('Call Center opt-in catalogue', () => {
  it('registers granular choices without auto-granting them to existing administrator roles', () => {
    const codes = PERMISSION_SEED_DATA.filter(([code]) =>
      code.startsWith('customer_affairs.call_center.'),
    ).map(([code]) => code);
    expect(codes).toContain('customer_affairs.call_center.scope.v1');
    expect(codes.filter(isOptInCallCenterPermission)).toHaveLength(10);
    expect(
      codes.filter((code) => !isOptInCallCenterPermission(code)).sort(),
    ).toEqual([
      'customer_affairs.call_center.calls.create',
      'customer_affairs.call_center.notes.create',
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.workflow.manage',
    ]);
    expect(isOptInCallCenterPermission('customer_affairs.ticket.read')).toBe(
      false,
    );
  });
});
