'use client';

import type { LoginResponse } from '@rubi/contracts';
import {
  LayoutDashboard,
  MessageSquare,
  StickyNote,
  Plus,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  formatHeaderDate,
  headerDateKey,
  subscribeHeaderDate,
} from '@/lib/header-today';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { legalEntitySelectionLabel } from '@/modules/legal-entities/model/context';
import { isAuthenticatedProfileUser } from '@/modules/profile/model/profile';
import {
  canAccessWorkbench,
  inboxViews,
  todayMetrics,
  unavailableCopy,
  workbenchTab,
  workbenchTabs,
} from './model';

type Identity =
  | { status: 'loading' | 'error' | 'unauthorized' }
  | { status: 'ready'; user: LoginResponse['user'] };
const subscribeNetwork = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
const onlineSnapshot = () => navigator.onLine;
const serverOnline = () => true;
const serverDay = () => null;

export function WorkbenchWorkspace() {
  const [identity, setIdentity] = useState<Identity>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const online = useSyncExternalStore(
    subscribeNetwork,
    onlineSnapshot,
    serverOnline,
  );
  const day = useSyncExternalStore(
    subscribeHeaderDate,
    headerDateKey,
    serverDay,
  );
  const { context, entities } = useLegalEntityContext();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tab = workbenchTab(params.get('tab'));
  useEffect(() => {
    let active = true;
    async function load() {
      setIdentity({ status: 'loading' });
      try {
        const base = getPublicApiBaseUrl();
        if (!base) throw new Error('API unavailable');
        const session = await refreshAuthenticatedSession(base);
        if (!active) return;
        if (!session) {
          setIdentity({ status: 'unauthorized' });
          return;
        }
        if (!isAuthenticatedProfileUser(session.user))
          throw new Error('Invalid identity');
        setIdentity({ status: 'ready', user: session.user });
      } catch {
        if (active) setIdentity({ status: 'error' });
      }
    }
    if (online) void load();
    return () => {
      active = false;
    };
  }, [attempt, online]);
  const switchTab = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('tab', value);
    router.push(`${pathname}?${next}`, { scroll: false });
  };
  const panel = 'rounded-2xl border border-border bg-surface p-5 shadow-sm';

  if (!online)
    return (
      <section className={panel} role="status">
        <h1 className="text-xl font-bold">میزکار من</h1>
        <p>
          اتصال اینترنت قطع است. پس از اتصال دوباره، دسترسی شما بررسی می‌شود.
        </p>
      </section>
    );
  if (identity.status === 'loading')
    return (
      <section className={panel} aria-busy="true" role="status">
        در حال بررسی دسترسی میزکار…
      </section>
    );
  if (identity.status === 'unauthorized')
    return (
      <section className={panel}>
        <h1 className="text-xl font-bold">ورود به میزکار</h1>
        <p className="my-3">برای مشاهده میزکار، دوباره وارد حساب شوید.</p>
        <Button asChild>
          <Link href="/login?next=%2Fworkbench">ورود به حساب</Link>
        </Button>
      </section>
    );
  if (identity.status !== 'ready')
    return (
      <section className={panel} role="alert">
        <p>دریافت هویت کاربر ناموفق بود.</p>
        <Button className="mt-3" onClick={() => setAttempt((a) => a + 1)}>
          تلاش دوباره
        </Button>
      </section>
    );
  if (!canAccessWorkbench(identity.user.permissions))
    return (
      <section className={panel}>
        <h1 className="text-xl font-bold">میزکار من</h1>
        <p className="my-3">مجوز دسترسی به میزکار برای این حساب فعال نیست.</p>
        <Button variant="secondary" asChild>
          <Link href="/profile">مشاهده حساب و دسترسی‌ها</Link>
        </Button>
      </section>
    );

  return (
    <div className="min-w-0 space-y-5" dir="rtl">
      <header
        className={`${panel} flex flex-wrap items-start justify-between gap-4`}
      >
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-muted-foreground">فضای شخصی شما در روبی</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LayoutDashboard
              aria-hidden="true"
              className="size-6 text-primary"
            />
            میزکار من
          </h1>
          <p className="break-words font-semibold">
            {identity.user.displayName}
          </p>
          <p className="text-sm text-muted-foreground">
            سمت و واحد: در دسترس نیست
          </p>
          <p className="text-sm">
            شعبه جاری: مشخص نشده · شعب مجاز را در حساب مشاهده کنید
          </p>
          <p className="text-sm">
            شرکت فعال:{' '}
            {context
              ? legalEntitySelectionLabel(context.selection, entities)
              : 'در دسترس نیست'}
          </p>
          <p className="text-sm text-muted-foreground">
            {day ? (
              <>
                <time dateTime={day}>{formatHeaderDate(day)}</time> ·{' '}
                <span dir="ltr">{day}</span>
              </>
            ) : (
              'در حال دریافت تاریخ…'
            )}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          aria-describedby="workbench-availability"
        >
          <Button disabled>
            <Plus aria-hidden="true" className="size-4" />
            درخواست جدید
          </Button>
          <Button disabled variant="secondary">
            <MessageSquare aria-hidden="true" className="size-4" />
            پیام جدید
          </Button>
          <Button disabled variant="secondary">
            <StickyNote aria-hidden="true" className="size-4" />
            یادداشت جدید
          </Button>
        </div>
      </header>
      <p
        id="workbench-availability"
        className="rounded-xl border border-border bg-muted p-4 text-sm"
        role="status"
      >
        میزکار در حال آماده‌سازی است. ثبت درخواست، پیام و اطلاعات شخصی هنوز فعال
        نیست.
      </p>
      <Tabs dir="rtl" value={tab} onValueChange={switchTab}>
        <TabsList
          aria-label="بخش‌های میزکار من"
          className="mb-5 flex h-auto flex-wrap justify-start gap-1"
        >
          {workbenchTabs.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {workbenchTabs.map(([key, label]) => (
          <TabsContent
            key={key}
            value={key}
            className="space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {key === 'today' && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {todayMetrics.map((metric) => (
                  <article key={metric} className={panel}>
                    <h2 className="text-sm font-medium">{metric}</h2>
                    <p
                      className="my-2 text-2xl"
                      aria-label="داده در دسترس نیست"
                    >
                      —
                    </p>
                    <p className="text-xs text-muted-foreground">
                      در انتظار اتصال سرویس
                    </p>
                  </article>
                ))}
              </div>
            )}
            <section className={panel}>
              <h2 className="mb-3 text-lg font-bold">{label}</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {unavailableCopy[key]}
              </p>
              {key === 'requests' && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {inboxViews.map((view) => (
                    <li key={view} className="rounded-lg bg-muted p-3 text-sm">
                      {view}
                      <span className="ms-2 text-muted-foreground">
                        · در دسترس نیست
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {key === 'files' && (
                <Button variant="secondary" className="mt-4" asChild>
                  <Link href="/documents">
                    <FolderOpen aria-hidden="true" className="size-4" />
                    رفتن به اسناد
                  </Link>
                </Button>
              )}
              {key === 'account' && (
                <Button variant="secondary" className="mt-4" asChild>
                  <Link href="/profile">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                    حساب، نشست‌ها و امنیت
                  </Link>
                </Button>
              )}
            </section>
            {key === 'today' && (
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  'کارهای اولویت‌دار من',
                  'درخواست‌های ارسالی منتظر پاسخ',
                  'آخرین پرونده‌های بازشده',
                  'میان‌برهای ستاره‌دار',
                  'اعلان‌های مهم',
                  'فعالیت‌های اخیر من',
                ].map((title) => (
                  <section key={title} className={panel}>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      اطلاعات این بخش هنوز قابل دریافت نیست.
                    </p>
                  </section>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
