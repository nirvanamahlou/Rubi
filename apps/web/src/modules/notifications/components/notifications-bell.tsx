'use client';

import type { NotificationItemV1 } from '@rubi/contracts';
import {
  Bell,
  CheckCheck,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { faMessages } from '@/messages/fa';
import { NOTIFICATIONS_CHANGED_EVENT, notificationsApi } from '../api/client';

const POLL_INTERVAL_MS = 45_000;

function formatNotificationDate(value: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemV1[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await notificationsApi.list();
      setItems(response.data);
      setUnreadCount(response.meta.unreadCount);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'دریافت اعلان‌ها ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [load]);

  async function openNotification(item: NotificationItemV1) {
    if (!item.isRead) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, isRead: true } : candidate,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      await notificationsApi.markRead(item.id).catch(() => void load());
    }
    if (item.href) router.push(item.href);
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await notificationsApi.markAllRead().catch(() => void load());
  }

  const badge = unreadCount > 99 ? '+۹۹' : unreadCount.toLocaleString('fa-IR');

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={
            unreadCount > 0
              ? `${faMessages.shell.notifications}؛ ${badge} خوانده‌نشده`
              : faMessages.shell.notifications
          }
          className="relative"
          size="icon"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute end-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-black leading-none text-destructive-foreground ring-2 ring-surface">
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-blue-50 to-cyan-50 px-4 py-3 dark:from-blue-950/50 dark:to-cyan-950/30">
          <div>
            <strong className="block text-sm">اعلان‌ها</strong>
            <span className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${badge} اعلان خوانده‌نشده`
                : 'همه اعلان‌ها خوانده شده‌اند'}
            </span>
          </div>
          {unreadCount > 0 ? (
            <Button
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => void markAllRead()}
              size="sm"
              variant="ghost"
            >
              <CheckCheck aria-hidden="true" className="size-4" />
              خواندن همه
            </Button>
          ) : null}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
              در حال دریافت اعلان‌ها
            </div>
          ) : error && items.length === 0 ? (
            <div className="grid justify-items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
              <CircleAlert
                aria-hidden="true"
                className="size-6 text-amber-500"
              />
              <span>{error}</span>
              <Button
                className="gap-2"
                onClick={() => void load()}
                size="sm"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                تلاش دوباره
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Bell aria-hidden="true" className="size-5" />
              </span>
              هنوز اعلانی ثبت نشده است.
            </div>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                className={cn(
                  'relative block cursor-pointer px-4 py-3 ps-7 leading-6',
                  !item.isRead && 'bg-blue-50/80 dark:bg-blue-950/30',
                )}
                key={item.id}
                onSelect={() => void openNotification(item)}
              >
                {!item.isRead ? (
                  <span
                    aria-hidden="true"
                    className="absolute start-2 top-5 size-2 rounded-full bg-blue-600"
                  />
                ) : null}
                <span className="block text-sm font-bold">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.message}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground/80">
                  {item.actor ? `${item.actor.displayName} · ` : ''}
                  {formatNotificationDate(item.occurredAt)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        {error && items.length > 0 ? (
          <div className="border-t border-border px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            تازه‌سازی اعلان‌ها ناموفق بود؛ فهرست قبلی نمایش داده می‌شود.
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
