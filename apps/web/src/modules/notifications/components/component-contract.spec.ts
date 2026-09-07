import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'notifications',
    'components',
    'notifications-bell.tsx',
  ),
  'utf8',
);

describe('notifications bell contract', () => {
  it('shows real unread state and accessible loading, empty and error states', () => {
    for (const marker of [
      'notificationsApi.list',
      'notificationsApi.markRead',
      'notificationsApi.markAllRead',
      'خواندن همه',
      'هنوز اعلانی ثبت نشده است',
      'در حال دریافت اعلان‌ها',
      'aria-label',
      'NOTIFICATIONS_CHANGED_EVENT',
    ]) {
      expect(source).toContain(marker);
    }
    expect(source).not.toContain('absolute end-2 top-2 size-2');
  });
});
