import {
  ArrowLeft,
  Building2,
  Coins,
  Hotel,
  Luggage,
  MapPinned,
  Megaphone,
  PlaneTakeoff,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Card, PageHeader } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { getMasterDataDefinition } from '../model/catalog';
import {
  masterDataSections,
  type MasterDataSectionSlug,
  type MasterDataSectionTone,
} from '../model/sections';

const iconBySection: Record<MasterDataSectionSlug, LucideIcon> = {
  finance: Coins,
  geography: MapPinned,
  'organizations-suppliers': Building2,
  accommodation: Hotel,
  transportation: PlaneTakeoff,
  insurance: ShieldCheck,
  'tours-travel-services': Luggage,
  'sales-references': Megaphone,
};

const toneClasses: Record<
  MasterDataSectionTone,
  { icon: string; glow: string }
> = {
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-400/14',
  },
  sky: {
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    glow: 'from-sky-400/14',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    glow: 'from-violet-400/14',
  },
  orange: {
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
    glow: 'from-orange-400/14',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    glow: 'from-blue-400/14',
  },
  cyan: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
    glow: 'from-cyan-400/14',
  },
  rose: {
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    glow: 'from-rose-400/14',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300',
    glow: 'from-purple-400/14',
  },
};

const visibleSubsections: Partial<
  Record<MasterDataSectionSlug, readonly string[]>
> = {
  finance: [
    'ارزها و تاریخچه نرخ',
    'گردش تأیید نرخ',
    'بانک‌ها',
    'شعب بانک',
    'روش پرداخت',
  ],
  geography: ['کشورها', 'شهرها و استان‌ها', 'فرودگاه‌ها', 'ترمینال‌ها'],
  'organizations-suppliers': ['تأمین‌کنندگان', 'کارگزاران', 'وضعیت همکاری'],
};

export function MasterDataHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="مدیریت یکپارچه داده‌های مرجع سازمان؛ برای ورود به هر حوزه، کارت مربوط را انتخاب کنید."
        title="اطلاعات پایه"
      />

      <section aria-labelledby="master-data-sections-title">
        <h2 className="sr-only" id="master-data-sections-title">
          بخش‌های اصلی اطلاعات پایه
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {masterDataSections.map((section) => {
            const Icon = iconBySection[section.slug];
            const tone = toneClasses[section.tone];
            const resourceLabels =
              visibleSubsections[section.slug] ??
              section.resources.map(
                (resource) => getMasterDataDefinition(resource).label,
              );

            return (
              <Link
                aria-label={`ورود به بخش ${section.title}`}
                className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href={`/master-data/${section.slug}`}
                key={section.slug}
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
                          {section.title}
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {resourceLabels.slice(0, 3).map((label) => (
                        <span
                          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                          key={label}
                        >
                          {label}
                        </span>
                      ))}
                      {resourceLabels.length > 3 ? (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          +{(resourceLabels.length - 3).toLocaleString('fa-IR')}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4 text-sm">
                      <span className="font-semibold text-muted-foreground">
                        {resourceLabels.length.toLocaleString('fa-IR')}{' '}
                        زیرمجموعه
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
