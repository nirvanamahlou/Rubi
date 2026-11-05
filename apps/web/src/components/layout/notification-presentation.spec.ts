import { describe, expect, it } from 'vitest';
import {
  compareNotifications,
  isCallCenterAssignment,
  notificationColors,
  notificationKind,
} from './notification-presentation';

describe('recipient notification presentation', () => {
  it('identifies actionable Call Center notices without blinking for closure or unrelated events', () => {
    const item = {
      sourceModule: 'customer-affairs',
      eventType: 'call-center.assigned',
      href: '/customer-affairs/call-center#cc-follow-up-queue',
    };
    expect(isCallCenterAssignment(item)).toBe(true);
    expect(notificationKind(item)).toBe('request');
    expect(
      isCallCenterAssignment({ ...item, eventType: 'call-center.closed' }),
    ).toBe(false);
    expect(isCallCenterAssignment({ ...item, sourceModule: 'documents' })).toBe(
      false,
    );
  });
  it('distinguishes private/group messages from assigned requests', () => {
    expect(
      notificationKind({
        sourceModule: 'messaging',
        eventType: 'message.received',
        href: '/workbench?tab=messages&conversation=1',
      }),
    ).toBe('message');
    expect(
      notificationKind({
        sourceModule: 'customer-affairs',
        eventType: 'ticket.assigned',
        href: '/workbench?tab=requests&request=1',
      }),
    ).toBe('request');
    expect(
      notificationKind({
        sourceModule: 'documents',
        eventType: 'document.created',
        href: '/documents',
      }),
    ).toBe('other');
  });
  it('keeps an unread request above newer read and local history', () => {
    const items = [
      { id: 'read', isRead: true, occurredAt: '2026-11-04T10:00:00Z' },
      { id: 'request', isRead: false, occurredAt: '2026-11-03T10:00:00Z' },
      { id: 'message', isRead: false, occurredAt: '2026-11-04T09:00:00Z' },
    ];
    expect(items.sort(compareNotifications).map((item) => item.id)).toEqual([
      'message',
      'request',
      'read',
    ]);
  });
  it('uses distinct unread colors and returns both types to their read appearance', () => {
    expect(notificationColors('message', false)).not.toEqual(
      notificationColors('request', false),
    );
    expect(notificationColors('message', true)).toEqual(
      notificationColors('request', true),
    );
    expect(notificationColors('message', true).item).toBe('');
    expect(notificationColors('request', false).dot).not.toBe('');
  });
});
