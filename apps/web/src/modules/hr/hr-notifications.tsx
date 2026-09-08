'use client';

import {
  BellRing,
  CheckCheck,
  ImageUp,
  PencilLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './hr-workspace.module.css';
import type { HrSectionId } from './hr.model';

const storageKey = 'rubi.hr.notifications.v1';
const notificationEvent = 'rubi:hr-notifications';
const maximumNotifications = 50;

export type HrNotificationAction = 'create' | 'edit' | 'delete' | 'update';

export interface HrNotification {
  id: string;
  action: HrNotificationAction;
  section: HrSectionId;
  tab: string;
  title: string;
  subject: string;
  message: string;
  href: string;
  occurredAt: string;
  read: boolean;
}

interface NotificationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isNotification(value: unknown): value is HrNotification {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<HrNotification>;
  return (
    typeof record.id === 'string' &&
    ['create', 'edit', 'delete', 'update'].includes(record.action ?? '') &&
    typeof record.section === 'string' &&
    typeof record.tab === 'string' &&
    typeof record.title === 'string' &&
    typeof record.subject === 'string' &&
    typeof record.message === 'string' &&
    typeof record.href === 'string' &&
    record.href.startsWith('/hr') &&
    typeof record.occurredAt === 'string' &&
    typeof record.read === 'boolean'
  );
}

export function parseHrNotifications(serialized: string | null) {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? parsed.filter(isNotification).slice(0, maximumNotifications)
      : [];
  } catch {
    return [];
  }
}

export function readHrNotifications(storage: NotificationStorage) {
  return parseHrNotifications(storage.getItem(storageKey));
}

export function writeHrNotifications(
  storage: NotificationStorage,
  notifications: readonly HrNotification[],
) {
  const bounded = notifications.slice(0, maximumNotifications);
  storage.setItem(storageKey, JSON.stringify(bounded));
  return bounded;
}

export function createHrNotification(
  input: Omit<HrNotification, 'id' | 'occurredAt' | 'read'>,
  options: { id?: string; occurredAt?: string } = {},
): HrNotification {
  return {
    ...input,
    id:
      options.id ??
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `hr-notification-${Date.now().toString(36)}`),
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    read: false,
  };
}

const actionLabel: Record<HrNotificationAction, string> = {
  create: 'افزوده شد',
  edit: 'ویرایش شد',
  delete: 'حذف شد',
  update: 'به‌روزرسانی شد',
};

export function publishHrMutationNotification(input: {
  action: HrNotificationAction;
  section: HrSectionId;
  tab: string;
  title: string;
  subject: string;
  href: string;
}) {
  if (typeof window === 'undefined') return;
  const notification = createHrNotification({
    ...input,
    message: `«${input.subject}» در بخش «${input.title}» ${actionLabel[input.action]}.`,
  });
  try {
    const next = writeHrNotifications(window.sessionStorage, [
      notification,
      ...readHrNotifications(window.sessionStorage),
    ]);
    window.dispatchEvent(
      new CustomEvent<readonly HrNotification[]>(notificationEvent, {
        detail: next,
      }),
    );
  } catch {
    window.dispatchEvent(
      new CustomEvent<readonly HrNotification[]>(notificationEvent, {
        detail: [notification],
      }),
    );
  }
}

function notificationIcon(action: HrNotificationAction) {
  if (action === 'create') return Plus;
  if (action === 'edit') return PencilLine;
  if (action === 'delete') return Trash2;
  return ImageUp;
}

function initialBrowserNotifications() {
  if (typeof window === 'undefined') return [];
  try {
    return readHrNotifications(window.sessionStorage);
  } catch {
    return [];
  }
}

export function HrNotificationCenter() {
  const [notifications, setNotifications] = useState<readonly HrNotification[]>(
    initialBrowserNotifications,
  );
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const persist = (next: readonly HrNotification[]) => {
    setNotifications(next);
    try {
      writeHrNotifications(window.sessionStorage, next);
    } catch {
      // Keep the notification center usable when session storage is unavailable.
    }
  };

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<readonly HrNotification[]>).detail;
      if (Array.isArray(detail))
        setNotifications(detail.filter(isNotification));
    };
    window.addEventListener(notificationEvent, receive);
    return () => window.removeEventListener(notificationEvent, receive);
  }, []);

  useEffect(() => {
    const bell = document.querySelector<HTMLButtonElement>(
      'button[aria-label^="اعلان‌ها"]',
    );
    if (!bell) return;
    bellRef.current = bell;
    bell.classList.add(styles.notificationBellConnected!);
    const toggle = () => setOpen((current) => !current);
    bell.addEventListener('click', toggle);
    return () => {
      bell.removeEventListener('click', toggle);
      bell.classList.remove(
        styles.notificationBellConnected!,
        styles.notificationBellHasUnread!,
      );
      bell.removeAttribute('data-unread');
      bell.removeAttribute('aria-expanded');
      bell.setAttribute('aria-label', 'اعلان‌ها');
      bellRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bell = bellRef.current;
    if (!bell) return;
    bell.classList.toggle(styles.notificationBellHasUnread!, unread > 0);
    bell.dataset.unread = unread.toLocaleString('fa-IR');
    bell.setAttribute('aria-expanded', String(open));
    bell.setAttribute(
      'aria-label',
      unread
        ? `اعلان‌ها (${unread.toLocaleString('fa-IR')} خوانده‌نشده)`
        : 'اعلان‌ها',
    );
  }, [open, unread]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !bellRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      aria-label="مرکز اعلان‌های منابع انسانی"
      className={styles.notificationPanel}
      ref={panelRef}
      role="dialog"
    >
      <div className={styles.notificationHeader}>
        <div>
          <strong>
            <BellRing aria-hidden="true" size={18} /> اعلان‌های منابع انسانی
          </strong>
          <small>{unread.toLocaleString('fa-IR')} اعلان خوانده‌نشده</small>
        </div>
        <button
          aria-label="بستن اعلان‌ها"
          className={styles.notificationIconButton}
          onClick={() => setOpen(false)}
          type="button"
        >
          <X aria-hidden="true" size={17} />
        </button>
      </div>
      {notifications.length ? (
        <>
          <div className={styles.notificationToolbar}>
            <button
              disabled={!unread}
              onClick={() =>
                persist(
                  notifications.map((notification) => ({
                    ...notification,
                    read: true,
                  })),
                )
              }
              type="button"
            >
              <CheckCheck aria-hidden="true" size={15} /> همه خوانده شد
            </button>
            <button onClick={() => persist([])} type="button">
              پاک‌کردن اعلان‌ها
            </button>
          </div>
          <div className={styles.notificationList}>
            {notifications.map((notification) => {
              const Icon = notificationIcon(notification.action);
              return (
                <Link
                  className={styles.notificationItem}
                  data-unread={!notification.read || undefined}
                  href={notification.href}
                  key={notification.id}
                  onClick={() => {
                    persist(
                      notifications.map((item) =>
                        item.id === notification.id
                          ? { ...item, read: true }
                          : item,
                      ),
                    );
                    setOpen(false);
                  }}
                >
                  <span className={styles.notificationItemIcon}>
                    <Icon aria-hidden="true" size={16} />
                  </span>
                  <span>
                    <b>{notification.title}</b>
                    <small>{notification.message}</small>
                    <time dateTime={notification.occurredAt}>
                      {new Intl.DateTimeFormat('fa-IR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(notification.occurredAt))}
                    </time>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.notificationEmpty}>
          <BellRing aria-hidden="true" size={26} />
          <span>هنوز تغییری در منابع انسانی ثبت نشده است.</span>
        </div>
      )}
    </div>
  );
}
