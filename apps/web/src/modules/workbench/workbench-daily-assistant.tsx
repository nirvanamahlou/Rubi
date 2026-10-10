'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpLeft, RefreshCw, Sparkles } from 'lucide-react';
import Link from '@/components/access-link';
import { Alert, Button, Card, Skeleton } from '@/components/ui';
import { tehranDay } from './calendar-model';
import {
  dailyFollowUps,
  followUpNoteInput,
  type DailyFollowUp,
} from './daily-follow-ups';
import { workbenchDate } from './model';
import { workbenchPersonalApi } from './workbench-personal-api';
import type {
  WorkbenchCalendarEventV1,
  WorkbenchNoteV1,
} from '@nora/contracts';
import type { AssignedFollowUp } from './daily-follow-ups';

type Sources = {
  notes: WorkbenchNoteV1[];
  events: WorkbenchCalendarEventV1[];
  procurement: AssignedFollowUp[];
};

const emptySources: Sources = { notes: [], events: [], procurement: [] };
const sourceName: Record<DailyFollowUp['source'], string> = {
  calendar: 'تقویم من',
  note: 'یادداشت من',
  procurement: 'پیگیری خرید',
};

export function WorkbenchDailyAssistant({
  onNoteCreated,
}: {
  onNoteCreated: () => void;
}) {
  const [sources, setSources] = useState<Sources>(emptySources);
  const [day, setDay] = useState(() => tehranDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const saving = useRef(new Set<string>());
  const generation = useRef(0);
  const currentDay = useRef(day);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    const [notes, calendar, procurement] = await Promise.allSettled([
      workbenchPersonalApi.notes(),
      workbenchPersonalApi.calendar(),
      workbenchPersonalApi.procurementFollowUps(),
    ]);
    if (request !== generation.current) return;
    setSources({
      notes: notes.status === 'fulfilled' ? notes.value.data : [],
      events: calendar.status === 'fulfilled' ? calendar.value.data : [],
      procurement:
        procurement.status === 'fulfilled' ? procurement.value.items : [],
    });
    const refreshedDay = tehranDay(new Date());
    currentDay.current = refreshedDay;
    setDay(refreshedDay);
    setSavedIds([]);
    if (
      notes.status === 'rejected' ||
      calendar.status === 'rejected' ||
      procurement.status === 'rejected'
    )
      setError('بخشی از موارد پیگیری دریافت نشد. دوباره تلاش کنید.');
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const dailyCheck = window.setInterval(() => {
      if (tehranDay(new Date()) !== currentDay.current) void load();
    }, 60_000);
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        tehranDay(new Date()) !== currentDay.current
      )
        void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      generation.current += 1;
      window.clearTimeout(timer);
      window.clearInterval(dailyCheck);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const items = dailyFollowUps(sources, day).filter(
    (item) => !savedIds.includes(item.id),
  );

  async function save(item: DailyFollowUp) {
    if (saving.current.has(item.id)) return;
    saving.current.add(item.id);
    setSavingId(item.id);
    setError('');
    try {
      await workbenchPersonalApi.createNote(followUpNoteInput(item));
      setSavedIds((current) => [...current, item.id]);
      onNoteCreated();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ذخیره پیگیری انجام نشد.',
      );
    } finally {
      saving.current.delete(item.id);
      setSavingId(null);
    }
  }

  return (
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-surface to-sky-50 dark:border-violet-800 dark:from-violet-950/30 dark:to-sky-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-200/70 p-5 dark:border-violet-800/70">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold">
              یادداشت‌های هوش مصنوعی برای شما
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              پیگیری‌های پیشنهادی از یادآورها، تقویم و کارهای خرید واگذارشده به
              شما؛ هر روز به‌روز می‌شود.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          به‌روزرسانی پیشنهادها
        </Button>
      </div>
      {error && (
        <div className="p-4 pb-0">
          <Alert
            tone="error"
            title="دریافت یا ذخیره پیگیری کامل نشد"
            description={error}
          />
        </div>
      )}
      {loading ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : items.length ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-violet-200/80 bg-surface p-4 shadow-sm dark:border-violet-800/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{sourceName[item.source]}</span>
                <span>
                  {item.dueAt ? workbenchDate(item.dueAt) : 'بدون موعد'}
                </span>
              </div>
              <h3 className="break-words font-bold">{item.title}</h3>
              <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Link
                  href={item.href}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  مشاهده منبع
                  <ArrowUpLeft className="size-4" aria-hidden="true" />
                </Link>
                {item.source !== 'note' && (
                  <Button
                    size="sm"
                    disabled={savingId === item.id}
                    onClick={() => void save(item)}
                  >
                    افزودن به یادداشت‌ها
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          فعلاً موردی برای پیگیری نزدیک یا عقب‌افتاده در داده‌های شما نیست.
        </p>
      )}
    </Card>
  );
}
