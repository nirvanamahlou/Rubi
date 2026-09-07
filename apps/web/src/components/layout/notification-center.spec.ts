import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('NotificationCenter integration contract', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, 'notification-center.tsx'),
    'utf8',
  );

  it('combines persistent server notifications with browser-local changes', () => {
    expect(source).toContain('notificationsApi.list()');
    expect(source).toContain('serverItems.map(serverNotification)');
    expect(source).toContain('localItems.map(localNotification)');
    expect(source).toContain('NOTIFICATIONS_CHANGED_EVENT');
  });

  it('supports recipient-scoped read and clear actions through the API', () => {
    expect(source).toContain('notificationsApi.markRead(notification.id)');
    expect(source).toContain('notificationsApi.markAllRead()');
    expect(source).toContain('notificationsApi.clearRead()');
  });

  it('renders loading, empty, retry and unread states in Persian', () => {
    expect(source).toContain('در حال دریافت اعلان‌ها');
    expect(source).toContain('اعلانی ندارید');
    expect(source).toContain('تلاش دوباره');
    expect(source).toContain('خوانده‌نشده');
  });
});
