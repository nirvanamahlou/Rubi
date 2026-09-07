'use client';

import type { NotificationItemV1 } from '@rubi/contracts';
import {
  Bell,
  BellRing,
  CheckCheck,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/environment';
import { cn } from '@/lib/utils';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationsApi,
} from '@/modules/notifications/api/client';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/overlays';
import {
  CHANGE_NOTIFICATIONS_EVENT,
  CHANGE_NOTIFICATIONS_STORAGE_KEY,
  createTrackedFetch,
  limitChangeNotifications,
  parseChangeNotifications,
  type ChangeNotification,
} from './change-notifications';

const SERVER_POLL_INTERVAL_MS = 45_000;

interface CenterNotification {
  key: string;
  id: string;
  source: 'local' | 'server';
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  isRead: boolean;
  actorName?: string;
}

function newNotificationId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredNotifications() {
  try {
    return parseChangeNotifications(
      window.localStorage.getItem(CHANGE_NOTIFICATIONS_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

function writeStoredNotifications(
  notifications: readonly ChangeNotification[],
) {
  const limited = limitChangeNotifications(notifications);
  try {
    window.localStorage.setItem(
      CHANGE_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(limited),
    );
  } catch {
    return limited;
  }
  window.dispatchEvent(new Event(CHANGE_NOTIFICATIONS_EVENT));
  return limited;
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function serverNotification(item: NotificationItemV1): CenterNotification {
  return {
    key: `server:${item.id}`,
    id: item.id,
    source: 'server',
    title: item.title,
    description: item.message,
    href: item.href ?? '/documents',
    occurredAt: item.occurredAt,
    isRead: item.isRead,
    ...(item.actor ? { actorName: item.actor.displayName } : {}),
  };
}

function localNotification(item: ChangeNotification): CenterNotification {
  return {
    key: `local:${item.id}`,
    id: item.id,
    source: 'local',
    title: item.title,
    description: item.description,
    href: item.href,
    occurredAt: item.occurredAt,
    isRead: item.readAt !== null,
  };
}

export function NotificationCenter() {
  const [localItems, setLocalItems] = useState<ChangeNotification[]>([]);
  const [serverItems, setServerItems] = useState<NotificationItemV1[]>([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const apiBaseUrl = getPublicApiBaseUrl();

  const loadServer = useCallback(async () => {
    try {
      const response = await notificationsApi.list();
      setServerItems(response.data);
      setServerUnreadCount(response.meta.unreadCount);
      setServerError(null);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'دریافت اعلان‌های پایدار ناموفق بود.',
      );
    } finally {
      setServerLoading(false);
    }
  }, []);

  const notifications = useMemo(
    () =>
      [
        ...serverItems.map(serverNotification),
        ...localItems.map(localNotification),
      ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    [localItems, serverItems],
  );
  const unreadCount = useMemo(
    () =>
      serverUnreadCount +
      localItems.filter((notification) => !notification.readAt).length,
    [localItems, serverUnreadCount],
  );

  useEffect(() => {
    const sync = () => setLocalItems(readStoredNotifications());
    const syncStorage = (event: StorageEvent) => {
      if (event.key === CHANGE_NOTIFICATIONS_STORAGE_KEY) sync();
    };
    sync();
    window.addEventListener(CHANGE_NOTIFICATIONS_EVENT, sync);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener(CHANGE_NOTIFICATIONS_EVENT, sync);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadServer(), 0);
    const interval = window.setInterval(
      () => void loadServer(),
      SERVER_POLL_INTERVAL_MS,
    );
    const refresh = () => void loadServer();
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [loadServer]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    const originalFetch = window.fetch.bind(window);
    const trackedFetch = createTrackedFetch(
      originalFetch,
      apiBaseUrl,
      (notification) => {
        const next = writeStoredNotifications([
          notification,
          ...readStoredNotifications(),
        ]);
        setLocalItems(next);
      },
      newNotificationId,
      () => new Date(),
    );
    window.fetch = trackedFetch;
    return () => {
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
    };
  }, [apiBaseUrl]);

  const updateLocalItems = (
    updater: (current: readonly ChangeNotification[]) => ChangeNotification[],
  ) => {
    const next = writeStoredNotifications(updater(readStoredNotifications()));
    setLocalItems(next);
  };

  function markRead(notification: CenterNotification) {
    if (notification.isRead) return;
    if (notification.source === 'server') {
      setServerItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      setServerUnreadCount((current) => Math.max(0, current - 1));
      void notificationsApi.markRead(notification.id).catch(() => loadServer());
      return;
    }
    const readAt = new Date().toISOString();
    updateLocalItems((current) =>
      current.map((item) =>
        item.id === notification.id && !item.readAt
          ? { ...item, readAt }
          : item,
      ),
    );
  }

  function markAllRead() {
    const readAt = new Date().toISOString();
    updateLocalItems((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt })),
    );
    setServerItems((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
    setServerUnreadCount(0);
    void notificationsApi.markAllRead().catch(() => loadServer());
  }

  function clearRead() {
    updateLocalItems((current) => current.filter((item) => !item.readAt));
    setServerItems((current) => current.filter((item) => !item.isRead));
    void notificationsApi.clearRead().catch(() => loadServer());
  }

  const hasRead = notifications.some((notification) => notification.isRead);

  return (
    <DropdownMenu dir="rtl" onOpenChange={(open) => open && void loadServer()}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={
            unreadCount
              ? `اعلان‌ها، ${unreadCount.toLocaleString('fa-IR')} خوانده‌نشده`
              : 'اعلان‌ها'
          }
          className="relative"
          size="icon"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount ? (
            <span className="absolute end-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-black leading-4 text-destructive-foreground ring-2 ring-surface">
              {unreadCount > 99 ? '+۹۹' : unreadCount.toLocaleString('fa-IR')}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label="مرکز اعلان تغییرات"
        className="w-[min(92vw,25rem)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-l from-blue-50 to-cyan-50 px-4 py-3 dark:from-blue-950/50 dark:to-cyan-950/30">
          <div>
            <p className="font-black">اعلان تغییرات</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount
                ? `${unreadCount.toLocaleString('fa-IR')} اعلان خوانده‌نشده`
                : 'همه اعلان‌ها خوانده شده‌اند'}
            </p>
          </div>
          {unreadCount ? (
            <Button
              onClick={markAllRead}
              size="sm"
              type="button"
              variant="ghost"
            >
              <CheckCheck aria-hidden="true" className="size-4" />
              خواندن همه
            </Button>
          ) : null}
        </div>

        {notifications.length ? (
          <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-1.5">
            {notifications.map((notification) => (
              <DropdownMenuItem
                asChild
                className={cn(
                  'mb-1 h-auto items-start px-3 py-3',
                  !notification.isRead && 'bg-primary/5',
                )}
                key={notification.key}
              >
                <Link
                  href={notification.href}
                  onClick={() => markRead(notification)}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                      notification.isRead
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    <BellRing aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">
                      {notification.title}
                    </strong>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {notification.description}
                    </span>
                    <time
                      className="mt-1 block text-[11px] text-muted-foreground"
                      dateTime={notification.occurredAt}
                    >
                      {notification.actorName
                        ? `${notification.actorName} · `
                        : ''}
                      {formatNotificationTime(notification.occurredAt)}
                    </time>
                  </span>
                  {!notification.isRead ? (
                    <span
                      aria-label="خوانده‌نشده"
                      className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : serverLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            در حال دریافت اعلان‌ها
          </div>
        ) : serverError ? (
          <div className="grid place-items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-6 text-amber-500" />
            <p>{serverError}</p>
            <Button
              onClick={() => void loadServer()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              تلاش دوباره
            </Button>
          </div>
        ) : (
          <div className="grid place-items-center gap-2 px-6 py-10 text-center text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-2xl bg-muted">
              <Bell aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-bold text-foreground">اعلانی ندارید</p>
            <p className="max-w-64 text-xs leading-5">
              پس از ایجاد، ویرایش، حذف یا تغییر وضعیت موفق، اعلان اینجا نمایش
              داده می‌شود.
            </p>
          </div>
        )}

        {serverError && notifications.length ? (
          <p className="border-t border-border px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            تازه‌سازی اعلان‌های پایدار ناموفق بود؛ فهرست قبلی نمایش داده می‌شود.
          </p>
        ) : null}

        {hasRead ? (
          <div className="border-t border-border p-2">
            <Button
              className="w-full"
              onClick={clearRead}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4 text-destructive" />
              پاک‌کردن اعلان‌های خوانده‌شده
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
