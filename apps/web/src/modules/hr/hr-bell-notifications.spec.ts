import { describe, expect, it } from 'vitest';
import type { HrNotificationDto } from '@rubi/contracts';
import { pendingHrBellNotifications } from './hr-bell-notifications';

const notice: HrNotificationDto = {
  id: 'notice-1',
  action: 'record.update',
  recordId: 'record-1',
  employeeId: null,
  title: 'درخواست به‌روز شد',
  createdAt: '2026-09-08T10:00:00Z',
  readAt: null,
};
describe('HR notifications in the common bell', () => {
  it('opens the actual HR record and keeps its distinct source', () => {
    expect(pendingHrBellNotifications([notice])[0]).toMatchObject({
      key: 'hr:notice-1',
      source: 'hr',
      href: '/hr?record=record-1',
      isRead: false,
    });
  });
  it('removes acknowledged HR items from the pending feed', () => {
    expect(
      pendingHrBellNotifications([{ ...notice, readAt: notice.createdAt }]),
    ).toEqual([]);
  });
  it('opens the employee when a notification has no record', () => {
    expect(
      pendingHrBellNotifications([
        { ...notice, recordId: null, employeeId: 'employee-1' },
      ])[0]?.href,
    ).toBe('/hr?section=employee&employee=employee-1');
  });
});
