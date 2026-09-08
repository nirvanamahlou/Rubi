import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { HrBootstrapDto } from '@rubi/contracts';
import { Card, PageHeader } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { hrHubCards, type HrSectionId, type Tone } from './hr.model';
import { employeeGroups, hrGroups } from './hr-navigation';

// Match the Master Data hub's shared Card, palette, spacing and interactions.
const toneClasses: Record<Tone, { icon: string; glow: string }> = {
  green: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-400/14',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    glow: 'from-blue-400/14',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    glow: 'from-violet-400/14',
  },
  orange: {
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
    glow: 'from-orange-400/14',
  },
  teal: {
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    glow: 'from-sky-400/14',
  },
  cyan: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
    glow: 'from-cyan-400/14',
  },
  rose: {
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    glow: 'from-rose-400/14',
  },
  slate: {
    icon: 'bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300',
    glow: 'from-purple-400/14',
  },
};

const sectionLabels: Partial<Record<HrSectionId, readonly string[]>> = {
  dashboard: ['شاخص‌های کارکنان', 'حضور و مرخصی', 'هشدار قراردادها'],
  employees: employeeGroups.map((group) => group.label),
  organization: ['چارت سازمانی', 'شعبه‌ها', 'واحدها', 'شغل و سمت', 'رده شغلی'],
  requests: ['کارتابل', 'درخواست‌ها', 'تأییدها'],
  reports: ['گزارش کارکنان', 'گزارش بخش‌ها', 'تاریخچه تغییرات'],
  hrSettings: [
    'گردش‌کار',
    'دسترسی‌ها',
    'اعلان‌ها',
    'فیلدها',
    'اتصال‌ها',
    'شرکت‌ها',
  ],
};

export function HrHub({ data }: { data: HrBootstrapDto }) {
  return (
    <div className="space-y-6" data-hr-hub>
      <PageHeader
        title="منابع انسانی"
        description="پرونده کارکنان و فرایندهای مرتبط در یک فضای کاری؛ برای ورود به هر حوزه، کارت مربوط را انتخاب کنید."
      />
      <section aria-labelledby="hr-sections-title">
        <h2 className="sr-only" id="hr-sections-title">
          بخش‌های اصلی منابع انسانی
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {hrHubCards
            .filter((card) => card.id !== 'finance')
            .map((card) => {
              const Icon = card.icon;
              const tone = toneClasses[card.tone];
              const labels =
                sectionLabels[card.id] ??
                hrGroups[card.id]?.map((group) => group.label) ??
                [];
              const count =
                card.id === 'employees'
                  ? data.employees.length
                  : data.records.filter((record) =>
                      card.id === 'requests'
                        ? /انتظار|بررسی/.test(record.status)
                        : record.section === card.id,
                    ).length;
              const title =
                card.id === 'payroll' ? 'حقوق و ارتباط مالی' : card.title;
              return (
                <Link
                  aria-label={`ورود به بخش ${title}`}
                  className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={`/hr?section=${card.id}`}
                  key={card.id}
                >
                  <Card className="relative h-full min-h-52 overflow-hidden p-5 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-[var(--shadow-card)]">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-80',
                        tone.glow,
                      )}
                    />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start gap-4">
                        <span
                          className={cn(
                            'grid size-14 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105',
                            tone.icon,
                          )}
                        >
                          <Icon aria-hidden="true" className="size-7" />
                        </span>
                        <div className="min-w-0 pt-1">
                          <h3 className="text-base font-black leading-7 text-foreground">
                            {title}
                          </h3>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {labels.slice(0, 3).map((label) => (
                          <span
                            className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                            key={label}
                          >
                            {label}
                          </span>
                        ))}
                        {labels.length > 3 ? (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                            +{(labels.length - 3).toLocaleString('fa-IR')}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4 text-sm">
                        <span className="font-semibold text-muted-foreground">
                          {labels.length.toLocaleString('fa-IR')} زیرمجموعه
                          {!['dashboard', 'reports', 'hrSettings'].includes(
                            card.id,
                          ) ? (
                            <span className="mt-1 block text-[11px] font-normal">
                              {count.toLocaleString('fa-IR')} رکورد
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2 font-bold text-primary">
                          ورود به بخش
                          <ArrowLeft
                            aria-hidden="true"
                            className="size-4 transition-transform group-hover:-translate-x-1"
                          />
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
