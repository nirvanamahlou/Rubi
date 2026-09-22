import { ArrowLeft, BadgeDollarSign, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';

import { Card, PageHeader } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

const sections = [
  {
    title: 'مدیریت قیمت',
    description:
      'محاسبه قیمت فروش، تنظیم سود و کمیسیون، ذخیره پیش‌نویس و انتشار نسخه قیمت پکیج.',
    href: '/sales/pricing/management',
    icon: BadgeDollarSign,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-400/14',
    labels: ['قیمت خرید و فروش', 'پیش‌نویس و انتشار', 'نسخه‌های قیمت'],
  },
  {
    title: 'پک جنریتور',
    description:
      'انتخاب پکیج منتشرشده و ساخت پیش‌نمایش تبلیغاتی فارسی با قالب‌های فعال شعبه.',
    href: '/sales/pricing/generator',
    icon: PanelsTopLeft,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    glow: 'from-violet-400/14',
    labels: ['انتخاب قالب', 'ویرایش محتوای نمایشی', 'پیش‌نمایش زنده RTL'],
  },
] as const;

export function PackagePricingHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="برای قیمت‌گذاری یا آماده‌سازی محتوای تبلیغاتی، بخش موردنظر را انتخاب کنید."
        title="مدیریت قیمت و پکیج‌ها"
      />

      <section aria-labelledby="package-pricing-sections-title">
        <h2 className="sr-only" id="package-pricing-sections-title">
          بخش‌های مدیریت قیمت و پکیج‌ها
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                aria-label={`ورود به بخش ${section.title}`}
                className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href={section.href}
                key={section.href}
              >
                <Card className="relative h-full min-h-64 overflow-hidden p-6 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-[var(--shadow-card)]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent opacity-80',
                      section.glow,
                    )}
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start gap-4">
                      <span
                        className={cn(
                          'grid size-16 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105',
                          section.tone,
                        )}
                      >
                        <Icon aria-hidden="true" className="size-8" />
                      </span>
                      <div className="min-w-0 pt-1">
                        <h3 className="text-lg font-black leading-8 text-foreground">
                          {section.title}
                        </h3>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {section.labels.map((label) => (
                        <span
                          className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                          key={label}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-5 text-sm">
                      <span className="font-semibold text-muted-foreground">
                        پنل اختصاصی
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
