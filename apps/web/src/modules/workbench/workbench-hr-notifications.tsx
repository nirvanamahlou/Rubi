'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { HrNotificationDto } from '@rubi/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Skeleton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui';
import { hrApi } from '@/modules/hr/hr-api';
import { pendingHrBellNotifications } from '@/modules/hr/hr-bell-notifications';
import {
  HR_WORKBENCH_CHANGED,
  canReadWorkbenchHr,
  readWorkbenchHrNotification,
} from './connections';
import { workbenchDate } from './model';

export function WorkbenchHrNotifications({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const allowed = canReadWorkbenchHr(permissions);
  const [items, setItems] = useState<HrNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (!allowed) return;
    try {
      const next = await hrApi.notifications();
      if (request !== generation.current) return;
      setItems(next);
      setError('');
    } catch (reason) {
      if (request !== generation.current) return;
      setItems([]);
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت اعلان‌های منابع انسانی ناموفق بود.',
      );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [allowed]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = setInterval(refresh, 45000);
    window.addEventListener(HR_WORKBENCH_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      invalidate();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener(HR_WORKBENCH_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [load, invalidate]);
  async function markRead(id: string) {
    if (pending) return;
    setPending(id);
    setActionError('');
    try {
      await readWorkbenchHrNotification(id);
      await load();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : 'ثبت وضعیت انجام نشد.',
      );
    } finally {
      setPending(null);
    }
  }
  if (!allowed) return null;
  const notices = pendingHrBellNotifications(items);
  const renderNotices = (visibleNotices: typeof notices) => (
    <ul className="divide-y divide-border">
      {visibleNotices.map((item) => (
        <li key={item.key} className="space-y-2 py-3">
          <p className="font-semibold text-sm">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {workbenchDate(item.occurredAt)}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={item.href}>مشاهده پرونده</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={Boolean(pending)}
              onClick={() => void markRead(item.id)}
            >
              {pending === item.id ? 'در حال ثبت…' : 'خواندم'}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold">اعلان‌های منابع انسانی</h2>
        {!loading && !error && (
          <Badge>
            {notices.length.toLocaleString('fa-IR')} خوانده‌نشده در فهرست
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="ms-auto"
        >
          به‌روزرسانی
        </Button>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">
        اعلان‌های مجاز شما در آخرین ۱۰۰ اعلان منابع انسانی؛ شامل دامنهٔ شخصی یا
        تیم و شعب مجاز شما. این فهرست جایگزین کارتابل درخواست‌ها نیست.
      </p>
      {loading ? (
        <Skeleton className="h-20" />
      ) : error ? (
        <Alert
          tone="error"
          title="اعلان‌های منابع انسانی دریافت نشدند"
          description={error}
        />
      ) : notices.length ? (
        renderNotices(notices.slice(0, 10))
      ) : (
        <p className="text-sm text-muted-foreground">
          اعلان خوانده‌نشده‌ای در این فهرست نیست.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
        مشاهده همه
      </Button>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent
          dir="rtl"
          className="max-w-3xl max-h-[85vh] overflow-y-auto"
        >
          <DialogTitle>اعلان‌های منابع انسانی</DialogTitle>
          <DialogDescription>
            همه اعلان‌های خوانده‌نشده در فهرست دریافتی مجاز شما
          </DialogDescription>
          {renderNotices(notices)}
        </DialogContent>
      </Dialog>
      {actionError && (
        <Alert
          tone="error"
          title="وضعیت اعلان ثبت نشد"
          description={actionError}
        />
      )}
    </Card>
  );
}
