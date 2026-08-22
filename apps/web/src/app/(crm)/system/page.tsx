import type { Metadata } from 'next';
import { ArrowLeft, Settings2, ShieldCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Card, PageHeader } from '@/components/ui/surfaces';

export const metadata: Metadata = { title: 'مدیریت سیستم' };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="درگاه عملی مدیریت دسترسی IAM و تنظیمات سامانه؛ این دو حوزه در Backend مرز مستقل خود را حفظ می‌کنند."
        eyebrow="مدیریت و امنیت"
        title="مدیریت سیستم"
      />

      <section
        aria-label="گزینه‌های مدیریت سیستم"
        className="grid gap-4 lg:grid-cols-2"
      >
        <Card className="flex h-full flex-col p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <UsersRound aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-black text-foreground">
            مدیریت کاربران، نقش‌ها و دسترسی‌ها
          </h2>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            ورود به رابط عملی IAM برای مدیریت وضعیت کاربران، نقش‌ها، مجوزها و
            دسترسی شعب.
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/users"
          >
            ورود به مدیریت کاربران
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
        </Card>

        <Card className="flex h-full flex-col p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <Settings2 aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-black text-foreground">
            تنظیمات سامانه
          </h2>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            دسترسی به تنظیمات عمومی سامانه، بدون ترکیب مسئولیت‌های Backend
            تنظیمات با IAM.
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/settings"
          >
            ورود به تنظیمات سامانه
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
        </Card>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-sm leading-7 text-foreground">
        <ShieldCheck
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-primary"
        />
        <p>
          این تجمیع فقط در سطح ناوبری است؛ قراردادها، داده‌ها و کنترل‌های امنیتی
          IAM و تنظیمات مستقل باقی می‌مانند.
        </p>
      </div>
    </div>
  );
}
