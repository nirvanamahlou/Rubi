import { describe, expect, it } from 'vitest';

import {
  createHrNotification,
  parseHrNotifications,
  readHrNotifications,
  writeHrNotifications,
} from './hr-notifications';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('HR notification storage', () => {
  it('stores a populated mutation notification and restores it', () => {
    const storage = memoryStorage();
    const notification = createHrNotification(
      {
        action: 'create',
        section: 'employees',
        tab: 'list',
        title: 'کارکنان',
        subject: 'نیروانا محلو',
        message: 'کارمند جدید اضافه شد.',
        href: '/hr?section=employees',
      },
      { id: 'notification-1', occurredAt: '2026-09-07T04:00:00.000Z' },
    );

    writeHrNotifications(storage, [notification]);

    expect(readHrNotifications(storage)).toEqual([notification]);
    expect(notification.read).toBe(false);
  });

  it('rejects malformed or non-HR links and limits the feed to 50 items', () => {
    expect(parseHrNotifications('{bad json')).toEqual([]);
    expect(
      parseHrNotifications(
        JSON.stringify([
          {
            id: 'bad',
            action: 'create',
            section: 'employees',
            tab: 'list',
            title: 'کارکنان',
            subject: 'نمونه',
            message: 'نمونه',
            href: 'https://example.invalid',
            occurredAt: '2026-09-07T04:00:00.000Z',
            read: false,
          },
        ]),
      ),
    ).toEqual([]);

    const storage = memoryStorage();
    const items = Array.from({ length: 60 }, (_, index) =>
      createHrNotification(
        {
          action: 'edit',
          section: 'employees',
          tab: 'list',
          title: 'کارکنان',
          subject: `کارمند ${index}`,
          message: 'ویرایش شد.',
          href: '/hr?section=employees',
        },
        { id: `notification-${index}` },
      ),
    );
    writeHrNotifications(storage, items);
    expect(readHrNotifications(storage)).toHaveLength(50);
  });
});
