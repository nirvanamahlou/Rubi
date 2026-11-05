'use client';

import { canViewRoute, type AuthenticatedActor } from '@nora/contracts';
import { useAccessActor } from '@/modules/iam/access-context';
import type { HrNotificationDto, NotificationItemV1 } from '@nora/contracts';
import {
  X,
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from '@/i18n/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/environment';
import { cn } from '@/lib/utils';
import { hrApi, HrApiError } from '@/modules/hr/hr-api';
import { pendingHrBellNotifications } from '@/modules/hr/hr-bell-notifications';
import {
  MASTER_DATA_CHANGED_EVENT,
  masterDataApi,
  type MasterDataNotification,
} from '@/modules/master-data/api/client';
import { getMasterDataNotificationPresentation } from '@/modules/master-data/model/notifications';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationsApi,
  notifyNotificationFeedChanged,
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
  createTrackedFetch,
  limitChangeNotifications,
  parseChangeNotifications,
  type ChangeNotification,
} from './change-notifications';

import {
  compareNotifications,
  isCallCenterAssignment,
  notificationColors,
  notificationKind,
  type NotificationKind,
} from './notification-presentation';

import { newMessagePopup } from './message-popup';
import { createNotificationFeedGuard } from './notification-feed-guard';

const SERVER_POLL_INTERVAL_MS = 10_000;

interface CenterNotification {
  kind?: NotificationKind;
  key: string;
  id: string;
  source: 'local' | 'server' | 'hr';
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

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'short',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function mergeMasterDataFeed(
  current: readonly ChangeNotification[],
  events: readonly MasterDataNotification[],
  dismissed: ReadonlySet<string> = new Set(),
  readAudit: ReadonlyMap<string, string> = new Map(),
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
      readAt: existing?.readAt ?? readAudit.get(id) ?? null,
    };
  });
  const auditIds = new Set(fromAudit.map((item) => item.id));
  return limitChangeNotifications([
    ...fromAudit.filter((item) => !dismissed.has(item.id)),
    ...current.filter(
      (item) => !auditIds.has(item.id) && !dismissed.has(item.id),
    ),
  ]);
}

function serverNotification(item: NotificationItemV1): CenterNotification {
  return {
    key: `server:${item.id}`,
    kind: notificationKind(item),
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
  const actor = useAccessActor();
  if (!actor) return null;
  return (
    <ScopedNotificationCenter key={notificationScope(actor)} actor={actor} />
  );
}
export function notificationScope(actor: AuthenticatedActor) {
  return [
    actor.userId,
    [...actor.branchIds].sort().join(','),
    [...actor.permissions].sort().join(','),
  ].join(':');
}
function ScopedNotificationCenter({ actor }: { actor: AuthenticatedActor }) {
  const CHANGE_NOTIFICATIONS_STORAGE_KEY =
    'nora.notifications.scoped:' + notificationScope(actor);
  const AUDIT_STATE_KEY = 'nora.notifications.audit:' + actor.userId;
  const DISMISSED_AUDIT_KEY = AUDIT_STATE_KEY + '.dismissed-audit';
  const {
    readDismissedAuditIds,
    readAuditReadTimes,
    readStoredNotifications,
    writeStoredNotifications,
    clearReadNotifications,
  } = useMemo(
    () =>
      notificationStorage(CHANGE_NOTIFICATIONS_STORAGE_KEY, AUDIT_STATE_KEY),
    [CHANGE_NOTIFICATIONS_STORAGE_KEY, AUDIT_STATE_KEY],
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const loginChecked = useRef(false);
  const messageStartedAt = useRef(new Date().toISOString());
  const messageSeen = useRef<Set<string> | null>(null);
  const [messagePopup, setMessagePopup] = useState<NotificationItemV1 | null>(
    null,
  );
  const serverLoadInFlight = useRef(false);
  const serverWrites = useRef(Promise.resolve());
  const hrWrites = useRef(Promise.resolve());
  const hrFeedGuard = useRef(createNotificationFeedGuard());
  const pendingWrites = useRef(0);
  const feedVersion = useRef(0);
  const [localItems, setLocalItems] = useState<ChangeNotification[]>([]);
  const [serverItems, setServerItems] = useState<NotificationItemV1[]>([]);
  const [hrItems, setHrItems] = useState<HrNotificationDto[]>([]);
  const [hrError, setHrError] = useState<string | null>(null);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [refreshingMasterData, setRefreshingMasterData] = useState(false);
  const apiBaseUrl = getPublicApiBaseUrl();

  const loadHr = useCallback(async () => {
    const token = hrFeedGuard.current.beginRead();
    if (token === null) return;
    try {
      const items = await hrApi.notifications();
      if (!hrFeedGuard.current.canApply(token)) return;
      setHrItems(items);
      setHrError(null);
    } catch (error) {
      if (!hrFeedGuard.current.canApply(token)) return;
      setHrItems([]);
      setHrError(
        error instanceof HrApiError && error.status === 403
          ? null
          : 'دریافت اعلان‌های منابع انسانی انجام نشد.',
      );
    }
  }, []);

  const loadServer = useCallback(async () => {
    if (pendingWrites.current || serverLoadInFlight.current) return;
    serverLoadInFlight.current = true;
    const version = feedVersion.current;
    try {
      const response = await notificationsApi.list();
      if (version !== feedVersion.current || pendingWrites.current) return;
      const fresh = newMessagePopup(
        response.data,
        messageSeen.current,
        actor.permissions,
        messageStartedAt.current,
      );
      if (fresh) setMessagePopup(fresh);
      messageSeen.current ??= new Set();
      response.data.forEach((item) => messageSeen.current!.add(item.id));
      setServerItems(response.data);
      setServerUnreadCount(response.meta.unreadCount);
      setServerError(null);
      if (!loginChecked.current) {
        loginChecked.current = true;
        if (
          response.data.some(
            (item) =>
              !item.isRead && item.eventType === 'sales.passenger-corrected',
          )
        )
          setDropdownOpen(true);
      }
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'دریافت اعلان‌های پایدار ناموفق بود.',
      );
    } finally {
      serverLoadInFlight.current = false;
      setServerLoading(false);
    }
  }, [actor.permissions]);

  function writeHr(operation: () => Promise<unknown>) {
    const settle = hrFeedGuard.current.beginWrite();
    hrWrites.current = hrWrites.current
      .then(operation)
      .then(() => {
        window.dispatchEvent(new Event('nora:hr-server-change'));
      })
      .catch((error: unknown) =>
        setHrError(
          error instanceof Error
            ? error.message
            : 'ثبت تغییر اعلان ناموفق بود.',
        ),
      )
      .finally(() => {
        settle();
        if (!hrFeedGuard.current.writing()) void loadHr();
      });
  }

  function writeServer(operation: () => Promise<unknown>) {
    pendingWrites.current += 1;
    feedVersion.current += 1;
    serverWrites.current = serverWrites.current
      .then(operation)
      .then(() => undefined)
      .catch((error: unknown) => {
        setServerError(
          error instanceof Error
            ? error.message
            : 'ثبت تغییر اعلان ناموفق بود.',
        );
      })
      .finally(() => {
        pendingWrites.current -= 1;
        if (!pendingWrites.current) void loadServer();
      });
  }

  const notifications = useMemo<CenterNotification[]>(
    () =>
      [
        ...serverItems
          .filter(
            (item) => !item.href || canViewRoute(actor.permissions, item.href),
          )
          .map(serverNotification),
        ...localItems
          .filter((item) => canViewRoute(actor.permissions, item.href))
          .map(localNotification),
        ...pendingHrBellNotifications(hrItems),
      ].sort(compareNotifications),
    [localItems, serverItems, hrItems, actor.permissions],
  );
  const unreadCount = useMemo(
    () =>
      serverUnreadCount +
      hrItems.filter((item) => !item.readAt).length +
      localItems.filter(
        (notification) =>
          !notification.readAt &&
          canViewRoute(actor.permissions, notification.href),
      ).length,
    [localItems, serverUnreadCount, hrItems, actor.permissions],
  );

  const syncMasterDataFeed = useCallback(
    async (showProgress = false) => {
      if (showProgress) setRefreshingMasterData(true);
      try {
        const response = await masterDataApi.notifications(60);
        const next = writeStoredNotifications(
          mergeMasterDataFeed(
            readStoredNotifications(),
            response.data,
            readDismissedAuditIds(),
            readAuditReadTimes(),
          ),
        );
        setLocalItems(next);
      } catch {
        // The global center keeps local notifications available if Audit is
        // temporarily unreachable or the current role cannot read Master Data.
      } finally {
        if (showProgress) setRefreshingMasterData(false);
      }
    },
    [
      readDismissedAuditIds,
      readAuditReadTimes,
      readStoredNotifications,
      writeStoredNotifications,
    ],
  );

  useEffect(() => {
    const refresh = () => void loadHr();
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 45_000);
    window.addEventListener('nora:hr-server-change', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('nora:hr-server-change', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadHr]);

  useEffect(() => {
    const sync = () => setLocalItems(readStoredNotifications());
    const syncStorage = (event: StorageEvent) => {
      if (
        event.key === CHANGE_NOTIFICATIONS_STORAGE_KEY ||
        event.key === AUDIT_STATE_KEY + '.read-audit' ||
        event.key === DISMISSED_AUDIT_KEY
      )
        sync();
    };
    sync();
    window.addEventListener(CHANGE_NOTIFICATIONS_EVENT, sync);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener(CHANGE_NOTIFICATIONS_EVENT, sync);
      window.removeEventListener('storage', syncStorage);
    };
  }, [
    readStoredNotifications,
    CHANGE_NOTIFICATIONS_STORAGE_KEY,
    AUDIT_STATE_KEY,
    DISMISSED_AUDIT_KEY,
  ]);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadServer(), 0);
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadServer();
    };
    const interval = window.setInterval(refresh, SERVER_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
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
  }, [apiBaseUrl, readStoredNotifications, writeStoredNotifications]);

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

  const updateLocalItems = (
    updater: (current: readonly ChangeNotification[]) => ChangeNotification[],
  ) => {
    const next = writeStoredNotifications(updater(readStoredNotifications()));
    setLocalItems(next);
  };

  function markRead(notification: CenterNotification) {
    if (notification.isRead) return;
    if (notification.source === 'hr') {
      setHrItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      writeHr(() => hrApi.readNotification(notification.id));
      return;
    }
    if (notification.source === 'server') {
      setServerItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      setServerUnreadCount((current) => Math.max(0, current - 1));
      writeServer(() =>
        notificationsApi
          .markRead(notification.id)
          .then(notifyNotificationFeedChanged),
      );
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
    const pendingHr = hrItems.filter((item) => !item.readAt);
    setHrItems((current) => current.map((item) => ({ ...item, readAt })));
    writeHr(async () => {
      for (const item of pendingHr) await hrApi.readNotification(item.id);
    });
    updateLocalItems((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt })),
    );
    setServerItems((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
    setServerUnreadCount(0);
    writeServer(() => notificationsApi.markAllRead());
  }

  function clearRead() {
    setClearError(null);
    try {
      setLocalItems(clearReadNotifications());
    } catch {
      setClearError('ذخیره حذف اعلان در مرورگر انجام نشد.');
    }
    setClearing(true);
    writeServer(async () => {
      try {
        await notificationsApi.clearRead();
        setServerItems((current) => current.filter((item) => !item.isRead));
      } catch (error) {
        setClearError(
          (previous) =>
            previous ??
            (error instanceof Error
              ? error.message
              : 'ثبت تغییر اعلان ناموفق بود.'),
        );
      } finally {
        setClearing(false);
      }
    });
  }

  const hasRead = notifications.some((notification) => notification.isRead);
  const BellIcon = unreadCount ? BellRing : Bell;
  const hasPendingCallRequest = serverItems.some(
    (item) =>
      !item.isRead &&
      isCallCenterAssignment(item) &&
      (!item.href || canViewRoute(actor.permissions, item.href)),
  );

  return (
    <>
      {messagePopup &&
        createPortal(
          <aside
            role="status"
            dir="rtl"
            className="fixed bottom-5 right-4 z-[60] w-[calc(100vw-2rem)] max-w-80 rounded-2xl border border-primary/20 bg-background p-4 shadow-2xl"
          >
            <button
              type="button"
              aria-label="بستن"
              onClick={() => setMessagePopup(null)}
              className="absolute left-2 top-2 rounded-lg p-2 hover:bg-muted"
            >
              <X className="size-4" />
            </button>
            <Link
              href={messagePopup.href!}
              onClick={() => setMessagePopup(null)}
              className="block space-y-2 pl-5"
            >
              <span className="flex items-center gap-2 font-bold text-primary">
                <MessageSquare className="size-5" />
                {messagePopup.title}
              </span>
              <span className="block text-sm font-semibold">
                {messagePopup.actor?.displayName}
              </span>
              <span className="line-clamp-3 break-words text-sm leading-6 text-muted-foreground">
                {messagePopup.message}
              </span>
            </Link>
          </aside>,
          document.body,
        )}
      <DropdownMenu
        dir="rtl"
        open={dropdownOpen}
        onOpenChange={(open) => {
          setDropdownOpen(open);
          if (!open) return;
          void loadServer();
          void syncMasterDataFeed(true);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={
              unreadCount
                ? `اعلان‌ها، ${unreadCount.toLocaleString('fa-IR')} خوانده‌نشده`
                : 'اعلان‌ها'
            }
            className={cn(
              'relative',
              unreadCount > 0 && 'text-amber-300 hover:text-amber-200',
            )}
            size="icon"
            variant="ghost"
          >
            <BellIcon
              aria-hidden="true"
              className={cn(
                'size-5',
                unreadCount > 0 && 'fill-amber-300/25 text-amber-300',
              )}
            />
            {hasPendingCallRequest && (
              <span
                aria-hidden="true"
                data-call-request-alert
                className="pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-surface motion-safe:animate-pulse"
              />
            )}
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
            <div className="flex items-center gap-1">
              <Button
                aria-label="تازه‌سازی اعلان‌های اطلاعات پایه"
                disabled={refreshingMasterData}
                onClick={() => {
                  void loadServer();
                  void syncMasterDataFeed(true);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    refreshingMasterData && 'animate-spin',
                  )}
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

          {hrError ? (
            <div role="alert" className="px-4 py-2 text-sm text-destructive">
              {hrError}
              <Button onClick={() => void loadHr()} size="sm" variant="ghost">
                تلاش دوباره
              </Button>
            </div>
          ) : null}

          {notifications.length ? (
            <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-1.5">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  asChild
                  className={cn(
                    'mb-1 h-auto items-start px-3 py-3',
                    notificationColors(notification.kind, notification.isRead)
                      .item,
                  )}
                  key={notification.key}
                >
                  <Link
                    href={notification.href}
                    onClick={() => {
                      markRead(notification);
                      setDropdownOpen(false);
                      if (notification.href.endsWith('#cc-follow-up-queue'))
                        window.dispatchEvent(
                          new Event('call-center:open-queue'),
                        );
                    }}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                        notificationColors(
                          notification.kind,
                          notification.isRead,
                        ).icon,
                      )}
                    >
                      {notification.kind === 'message' ? (
                        <MessageSquare aria-hidden="true" className="size-4" />
                      ) : notification.kind === 'request' ? (
                        <ClipboardList aria-hidden="true" className="size-4" />
                      ) : (
                        <BellRing aria-hidden="true" className="size-4" />
                      )}
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
                        className={cn(
                          'mt-2 size-2 shrink-0 rounded-full',
                          notificationColors(
                            notification.kind,
                            notification.isRead,
                          ).dot,
                        )}
                      />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ) : serverLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
              در حال دریافت اعلان‌ها
            </div>
          ) : serverError ? (
            <div className="grid place-items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
              <CircleAlert
                aria-hidden="true"
                className="size-6 text-amber-500"
              />
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
              تازه‌سازی اعلان‌های پایدار ناموفق بود؛ فهرست قبلی نمایش داده
              می‌شود.
            </p>
          ) : null}

          {clearError ? (
            <p
              role="alert"
              className="border-t border-border px-3 py-2 text-xs text-destructive"
            >
              {clearError}
            </p>
          ) : null}

          {hasRead ? (
            <div className="border-t border-border p-2">
              <Button
                className="w-full"
                disabled={clearing}
                onClick={clearRead}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2
                  aria-hidden="true"
                  className="size-4 text-destructive"
                />
                پاک‌کردن اعلان‌های خوانده‌شده
              </Button>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function notificationStorage(
  CHANGE_NOTIFICATIONS_STORAGE_KEY: string,
  auditStateKey = CHANGE_NOTIFICATIONS_STORAGE_KEY,
) {
  const LEGACY_DISMISSED_AUDIT_KEY =
    CHANGE_NOTIFICATIONS_STORAGE_KEY + '.dismissed-audit';
  const DISMISSED_AUDIT_KEY = auditStateKey + '.dismissed-audit';
  const AUDIT_READ_KEY = auditStateKey + '.read-audit';
  function readDismissedAuditIds(): Set<string> {
    try {
      const ids: unknown = JSON.parse(
        window.localStorage.getItem(DISMISSED_AUDIT_KEY) ?? '[]',
      );
      const legacy: unknown = JSON.parse(
        window.localStorage.getItem(LEGACY_DISMISSED_AUDIT_KEY) ?? '[]',
      );
      return new Set(
        [
          ...(Array.isArray(ids) ? ids : []),
          ...(Array.isArray(legacy) ? legacy : []),
        ].filter((id): id is string => typeof id === 'string'),
      );
    } catch {
      return new Set();
    }
  }

  function readAuditReadTimes(): Map<string, string> {
    try {
      const data: unknown = JSON.parse(
        window.localStorage.getItem(AUDIT_READ_KEY) ?? '[]',
      );
      return new Map(
        Array.isArray(data)
          ? data.filter(
              (entry): entry is [string, string] =>
                Array.isArray(entry) &&
                entry.length === 2 &&
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string' &&
                Number.isFinite(Date.parse(entry[1])),
            )
          : [],
      );
    } catch {
      return new Map();
    }
  }

  function readStoredNotifications() {
    try {
      const readAudit = readAuditReadTimes();
      const dismissed = readDismissedAuditIds();
      return parseChangeNotifications(
        window.localStorage.getItem(CHANGE_NOTIFICATIONS_STORAGE_KEY),
      )
        .filter((item) => !dismissed.has(item.id))
        .map((item) => ({
          ...item,
          readAt: item.readAt ?? readAudit.get(item.id) ?? null,
        }));
    } catch {
      return [];
    }
  }

  function writeStoredNotifications(
    notifications: readonly ChangeNotification[],
  ) {
    const dismissed = readDismissedAuditIds();
    const readTimes = readAuditReadTimes();
    const limited = limitChangeNotifications(
      notifications
        .filter((item) => !dismissed.has(item.id))
        .map((item) => ({
          ...item,
          readAt: item.readAt ?? readTimes.get(item.id) ?? null,
        })),
    );
    try {
      const readAudit = readAuditReadTimes();
      for (const item of notifications) {
        if (item.readAt) readAudit.set(item.id, item.readAt);
      }
      window.localStorage.setItem(
        DISMISSED_AUDIT_KEY,
        JSON.stringify([...readDismissedAuditIds()]),
      );
      window.localStorage.setItem(
        AUDIT_READ_KEY,
        JSON.stringify([...readAudit]),
      );
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

  function clearReadNotifications() {
    const current = readStoredNotifications();
    const dismissed = readDismissedAuditIds();
    // The visible cache is capped; older acknowledged audit events can be
    // returned by the next poll even when they are no longer in that cache.
    for (const id of readAuditReadTimes().keys()) dismissed.add(id);
    for (const item of current) {
      if (item.readAt) dismissed.add(item.id);
    }
    window.localStorage.setItem(
      DISMISSED_AUDIT_KEY,
      JSON.stringify([...dismissed]),
    );
    const unread = current.filter((item) => !item.readAt);
    window.localStorage.setItem(
      CHANGE_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(unread),
    );
    window.dispatchEvent(new Event(CHANGE_NOTIFICATIONS_EVENT));
    return unread;
  }

  return {
    readDismissedAuditIds,
    readAuditReadTimes,
    readStoredNotifications,
    writeStoredNotifications,
    clearReadNotifications,
  };
}
