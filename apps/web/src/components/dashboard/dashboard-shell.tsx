import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  ListChecks,
  PlaneTakeoff,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { faMessages } from '@/messages/fa';

const kpiIcons: LucideIcon[] = [
  TrendingUp,
  WalletCards,
  PlaneTakeoff,
  ListChecks,
];

export function DashboardShell() {
  const messages = faMessages.dashboard;

  return (
    <div className="space-y-3.5">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#123f8c_0%,#155fc5_58%,#188fbd_100%)] px-5 py-4 text-white shadow-xl shadow-blue-900/15 sm:px-6">
        <div className="absolute -left-10 -top-20 size-56 rounded-full border-[34px] border-white/5" />
        <div className="absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-l from-transparent via-cyan-200/60 to-transparent" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-100">
              <span className="size-2 rounded-full bg-[#27c1b5] shadow-[0_0_0_5px_rgb(39_193_181_/_0.16)]" />
              CRM شرکت نیایش سیر سحر
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">
              {messages.title}
            </h1>
            <p className="mt-1 text-xs leading-6 text-blue-50/80 sm:text-sm">
              {messages.description}
            </p>
          </div>
          <Select defaultValue="week">
            <SelectTrigger
              aria-label={messages.period}
              className="w-40 border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/15"
            >
              <CalendarDays
                aria-hidden="true"
                className="size-4 text-cyan-200"
              />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{messages.periods.week}</SelectItem>
              <SelectItem value="month">{messages.periods.month}</SelectItem>
              <SelectItem value="quarter">
                {messages.periods.quarter}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section
        aria-label="شاخص‌های کلیدی"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {messages.kpis.map((title, index) => {
          const Icon = kpiIcons[index] ?? CircleDollarSign;
          return (
            <Card
              className="group relative overflow-hidden border-blue-100/90 p-3.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-blue-300 dark:border-blue-900/70"
              key={title}
            >
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-[#1557b8] to-[#24bdb1]" />
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-[#1557b8] transition group-hover:bg-[#1557b8] group-hover:text-white dark:bg-blue-950/70 dark:text-blue-300">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <Badge className="px-2 py-0.5 text-[10px]">
                  {faMessages.common.demo}
                </Badge>
              </div>
              <p className="mt-2.5 text-xs font-bold text-muted-foreground">
                {title}
              </p>
              <div className="mt-1.5 flex items-end justify-between gap-3">
                <p
                  className="text-2xl font-black text-foreground"
                  aria-label="بدون داده"
                >
                  —
                </p>
                <Skeleton className="mb-1 h-1.5 w-16" />
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card className="min-h-56 overflow-hidden border-blue-100/90 p-4 shadow-[var(--shadow-card)] dark:border-blue-900/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <ChartNoAxesCombined aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-black">{messages.chartTitle}</h2>
                <p className="text-[10px] text-muted-foreground">
                  داده‌های تأییدشده پس از اتصال Backend
                </p>
              </div>
            </div>
            <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              به‌روزرسانی لحظه‌ای
            </Badge>
          </div>
          <div className="mt-3 grid h-36 place-items-center rounded-2xl border border-dashed border-blue-200 bg-[linear-gradient(180deg,rgb(239_246_255_/_0.72),transparent)] text-xs text-muted-foreground dark:border-blue-900 dark:bg-blue-950/20">
            <div className="text-center">
              <TrendingUp className="mx-auto mb-2 size-7 text-blue-300" />
              محل نمودار عملکرد فروش و رزرواسیون
            </div>
          </div>
        </Card>

        <Card className="min-h-56 border-blue-100/90 p-4 shadow-[var(--shadow-card)] dark:border-blue-900/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Clock3 aria-hidden="true" className="size-4" />
              </span>
              <h2 className="text-sm font-black">{messages.recentActivity}</h2>
            </div>
            <span className="text-[10px] font-bold text-primary">
              مشاهده همه
            </span>
          </div>
          <EmptyState
            description="پس از اتصال Backend، آخرین فعالیت‌های شرکت در این بخش نمایش داده می‌شوند."
            title={faMessages.common.noData}
          />
        </Card>
      </section>
    </div>
  );
}
