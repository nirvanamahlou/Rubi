'use client';

import { Bell, BellRing, CheckCheck, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/environment';
import { cn } from '@/lib/utils';
import {
  MASTER_DATA_CHANGED_EVENT,
  masterDataApi,
  type MasterDataNotification,
} from '@/modules/master-data/api/client';
import { getMasterDataNotificationPresentation } from '@/modules/master-data/model/notifications';
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
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mergeMasterDataFeed(
  current: readonly ChangeNotification[],
  events: readonly MasterDataNotification[],
) {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const fromAudit = events.map((event): ChangeNotification => {
    const id = `master-data:${event.id}`;
    const existing = currentById.get(id);
    const presentation = getMasterDataNotificationPresentation(event);
    return {
      id,
      title: presentation.title,
      description: `تغییر در ${presentation.sectionLabel} ثبت شد.`,
      href: presentation.href,
      occurredAt: event.occurredAt,
      readAt: existing?.readAt ?? null,
    };
  });
  const auditIds = new Set(fromAudit.map((item) => item.id));
  return limitChangeNotifications([
    ...fromAudit,
    ...current.filter((item) => !auditIds.has(item.id)),
  ]);
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<ChangeNotification[]>([]);
  const [refreshingMasterData, setRefreshingMasterData] = useState(false);
  const apiBaseUrl = getPublicApiBaseUrl();
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const syncMasterDataFeed = useCallback(async (showProgress = false) => {
    if (showProgress) setRefreshingMasterData(true);
    try {
      const response = await masterDataApi.notifications(25);
      const next = writeStoredNotifications(
        mergeMasterDataFeed(readStoredNotifications(), response.data),
      );
      setNotifications(next);
    } catch {
      // The global center keeps local notifications available if Audit is
      // temporarily unreachable or the current role cannot read Master Data.
    } finally {
      if (showProgress) setRefreshingMasterData(false);
    }
  }, []);

  useEffect(() => {
    const sync = () => setNotifications(readStoredNotifications());
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
        setNotifications(next);
      },
      newNotificationId,
      () => new Date(),
    );
    window.fetch = trackedFetch;
    return () => {
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    const refresh = () => void syncMasterDataFeed();
    const initialLoad = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener(MASTER_DATA_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener(MASTER_DATA_CHANGED_EVENT, refresh);
    };
  }, [apiBaseUrl, syncMasterDataFeed]);

  const updateNotifications = (
    updater: (current: readonly ChangeNotification[]) => ChangeNotification[],
  ) => {
    const next = writeStoredNotifications(updater(readStoredNotifications()));
    setNotifications(next);
  };
  const markRead = (id: string) => {
    const readAt = new Date().toISOString();
    updateNotifications((current) =>
      current.map((notification) =>
        notification.id === id && !notification.readAt
          ? { ...notification, readAt }
          : notification,
      ),
    );
  };
  const markAllRead = () => {
    const readAt = new Date().toISOString();
    updateNotifications((current) =>
      current.map((notification) =>
        notification.readAt ? notification : { ...notification, readAt },
      ),
    );
  };
  const clearRead = () => {
    updateNotifications((current) =>
      current.filter((notification) => !notification.readAt),
    );
  };

  return (
    <DropdownMenu
      dir="rtl"
      onOpenChange={(open) => open && void syncMasterDataFeed(true)}
    >
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
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-black">اعلان تغییرات</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount
                ? `${unreadCount.toLocaleString('fa-IR')} اعلان خوانده‌نشده`
                : 'همه اعلان‌ها خوانده شده‌اند'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              aria-label="تازه‌سازی اعلان‌های اطلاعات پایه"
              disabled={refreshingMasterData}
              onClick={() => void syncMasterDataFeed(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-4', refreshingMasterData && 'animate-spin')}
              />
            </Button>
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
        </div>

        {notifications.length ? (
          <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-1.5">
            {notifications.map((notification) => (
              <DropdownMenuItem
                asChild
                className={cn(
                  'mb-1 h-auto items-start px-3 py-3',
                  !notification.readAt && 'bg-primary/5',
                )}
                key={notification.id}
              >
                <Link
                  href={notification.href}
                  onClick={() => markRead(notification.id)}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                      notification.readAt
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
                      {formatNotificationTime(notification.occurredAt)}
                    </time>
                  </span>
                  {!notification.readAt ? (
                    <span
                      aria-label="خوانده‌نشده"
                      className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
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

        {notifications.some((notification) => notification.readAt) ? (
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
