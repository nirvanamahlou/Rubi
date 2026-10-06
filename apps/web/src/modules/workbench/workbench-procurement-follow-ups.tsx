'use client';

import { ClipboardCheck, PackageCheck } from 'lucide-react';
import Link from '@/components/access-link';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import { workbenchDate } from './model';
import { workbenchPersonalApi } from './workbench-personal-api';
import { useEffect, useState } from 'react';

type FollowUp = Awaited<
  ReturnType<typeof workbenchPersonalApi.procurementFollowUps>
>['items'][number];

export function WorkbenchProcurementFollowUps() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void workbenchPersonalApi
      .procurementFollowUps()
      .then(({ items: tasks }) => {
        if (active) setItems(tasks);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'پیگیری‌های خرید دریافت نشدند.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Skeleton className="h-24" />;
  if (error)
    return (
      <Card className="border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        <p className="font-bold">پیگیری‌های خرید دریافت نشدند</p>
        <p className="mt-1">{error}</p>
      </Card>
    );
  if (!items.length)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="پیگیری خریدی به شما تخصیص داده نشده است"
        description="درخواست‌های خریدی که برای پیگیری به شما سپرده شوند، اینجا نمایش داده می‌شوند."
      />
    );

  return (
    <section
      className="space-y-3"
      aria-labelledby="procurement-follow-ups-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="procurement-follow-ups-title" className="font-black">
          درخواست‌های خرید برای پیگیری
        </h2>
        <Badge>{items.length.toLocaleString('fa-IR')} مورد</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className="flex items-center justify-between gap-4 border-sky-200/80 bg-gradient-to-br from-surface via-surface to-sky-500/10 p-4 dark:border-sky-800"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <PackageCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-bold">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  موعد پیگیری:{' '}
                  {item.dueAt ? workbenchDate(item.dueAt) : 'تعیین نشده'}
                </p>
              </div>
            </div>
            <Link
              href={`/purchases?section=requests&request=${encodeURIComponent(item.requestId)}`}
              className="shrink-0 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              مشاهده درخواست
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
