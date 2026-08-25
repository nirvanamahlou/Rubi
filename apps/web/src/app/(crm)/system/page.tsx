import { ArrowLeft, Building2, Settings2, UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card } from '@/components/ui/surfaces';
import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';

export const metadata: Metadata = { title: 'مدیریت سیستم' };

export default function Page() {
  return (
    <div className="space-y-5">
      <ModuleFoundationWorkspace config={foundationModules['system']} />

      <section
        aria-label="دسترسی‌های عملیاتی مدیریت سیستم"
        className="grid gap-4 lg:grid-cols-3"
      >
        <Card className="group p-5 transition-colors hover:border-primary/40">
          <Link className="flex items-center gap-4" href="/users">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UsersRound aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-foreground">
                ورود به مدیریت کاربران
              </strong>
              <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                مدیریت حساب‌ها، نقش‌ها و دسترسی‌های عملیاتی موجود
              </span>
            </span>
            <ArrowLeft
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1"
            />
          </Link>
        </Card>

        <Card className="group p-5 transition-colors hover:border-primary/40">
          <Link className="flex items-center gap-4" href="/settings">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
              <Settings2 aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-foreground">
                ورود به تنظیمات سامانه
              </strong>
              <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                تنظیمات فعلی سازمان، امنیت و رفتار سامانه
              </span>
            </span>
            <ArrowLeft
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1"
            />
          </Link>
        </Card>
        <Card className="group p-5 transition-colors hover:border-primary/40">
          <Link
            className="flex items-center gap-4"
            href="/system/legal-entities"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-foreground">
                مدیریت شرکت‌های صادرکننده
              </strong>
              <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                مشخصات حقوقی، Branding، Preview و Audit
              </span>
            </span>
            <ArrowLeft
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1"
            />
          </Link>
        </Card>
      </section>
    </div>
  );
}
