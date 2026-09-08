'use client';

import {
  Building2,
  KeyRound,
  type LucideIcon,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { legalEntitySelectionLabel } from '@/modules/legal-entities/model/context';
import {
  loadAuthenticatedProfile,
  ProfileUnauthorizedError,
} from '../api/client';
import {
  activeProfileSessions,
  formatProfileDate,
  normalizeProfileTab,
  profileInitials,
  safeProfileDisplayName,
  summarizePermissions,
  type AuthenticatedProfile,
  type ProfileTab,
} from '../model/profile';

type ProfileLoadState =
  | { status: 'loading' }
  | { status: 'ready'; profile: AuthenticatedProfile }
  | { status: 'empty' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

const profileTabs: ReadonlyArray<{
  value: ProfileTab;
  label: string;
  href: string;
}> = [
  { value: 'overview', label: 'پروفایل من', href: '/profile' },
  {
    value: 'preferences',
    label: 'تنظیمات شخصی',
    href: '/profile?tab=preferences',
  },
  {
    value: 'security',
    label: 'امنیت و نشست‌ها',
    href: '/profile?tab=security',
  },
];

export function ProfileWorkspace() {
  const searchParams = useSearchParams();
  const tab = normalizeProfileTab(searchParams.get('tab'));
  const [state, setState] = useState<ProfileLoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const profile = await loadAuthenticatedProfile();
      setState(profile ? { status: 'ready', profile } : { status: 'empty' });
    } catch (reason) {
      if (reason instanceof ProfileUnauthorizedError) {
        setState({ status: 'unauthorized' });
        return;
      }
      setState({
        status: 'error',
        message:
          reason instanceof Error
            ? reason.message
            : 'دریافت پروفایل ناموفق بود.',
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (state.status === 'loading') return <ProfileLoading />;
  if (state.status === 'unauthorized')
    return (
      <ErrorState
        action={
          <Button asChild>
            <Link href="/login?next=%2Fprofile">ورود به سامانه</Link>
          </Button>
        }
        description="نشست شما معتبر نیست یا پایان یافته است. دوباره وارد سامانه شوید."
        title="برای مشاهده پروفایل وارد شوید"
      />
    );
  if (state.status === 'error')
    return (
      <ErrorState
        action={
          <Button onClick={() => void load()}>
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </Button>
        }
        description={state.message}
        title="پروفایل دریافت نشد"
      />
    );
  if (state.status === 'empty')
    return (
      <EmptyState
        description="نشست معتبر است اما اطلاعات قابل‌نمایش پروفایل در پاسخ عمومی IAM وجود ندارد."
        title="اطلاعات پروفایل خالی است"
      />
    );

  return <ProfileContent profile={state.profile} tab={tab} />;
}

function ProfileContent({
  profile,
  tab,
}: {
  profile: AuthenticatedProfile;
  tab: ProfileTab;
}) {
  const legalEntity = useLegalEntityContext();
  const displayName = safeProfileDisplayName(profile.user.displayName);
  const sessions = activeProfileSessions(profile.sessions);
  const permissionGroups = summarizePermissions(profile.user.permissions);
  const activeCompany = legalEntity.loading
    ? 'در حال دریافت شرکت فعال'
    : legalEntity.context?.selection
      ? legalEntitySelectionLabel(
          legalEntity.context.selection,
          legalEntity.entities,
        )
      : 'در دسترس نیست';

  return (
    <section className="min-w-0 space-y-5" dir="rtl">
      <PageHeader
        description="نمای فقط‌خواندنی اطلاعات حساب، دسترسی‌ها و امنیت نشست شما"
        eyebrow="حساب کاربری"
        title={
          tab === 'preferences'
            ? 'تنظیمات شخصی'
            : tab === 'security'
              ? 'امنیت و نشست‌ها'
              : 'پروفایل من'
        }
      />
      <nav
        aria-label="بخش‌های پروفایل"
        className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border bg-surface p-2"
      >
        {profileTabs.map((item) => (
          <Link
            aria-current={tab === item.value ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-xl px-4 py-2 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
              tab === item.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            href={item.href}
            key={item.value}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === 'preferences' ? (
        <Alert
          description="API عمومی امن برای ویرایش ترجیحات شخصی منتشر نشده است؛ بنابراین این صفحه تنظیم ساختگی یا ذخیره‌سازی مرورگر ایجاد نمی‌کند."
          title="تنظیمات شخصی فقط‌خواندنی است"
        />
      ) : null}

      <Card className="overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#0e3a86,#1768c4)] p-5 text-white sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl font-black ring-1 ring-white/25">
              {profileInitials(displayName)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black sm:text-2xl">
                {displayName}
              </h2>
              <p className="mt-1 truncate text-sm text-blue-100" dir="ltr">
                @{profile.user.username}
              </p>
            </div>
          </div>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          <ProfileField icon={UserRound} label="نام نمایشی">
            {displayName}
          </ProfileField>
          <ProfileField icon={KeyRound} label="نام کاربری" valueDirection="ltr">
            {profile.user.username}
          </ProfileField>
          <ProfileField
            icon={Mail}
            label="ایمیل"
            valueDirection={profile.user.email ? 'ltr' : 'rtl'}
          >
            {profile.user.email ?? 'ثبت نشده است'}
          </ProfileField>
          <ProfileField icon={Building2} label="شرکت فعال">
            {activeCompany}
          </ProfileField>
          <ProfileField icon={ShieldCheck} label="ساعت ورود">
            {formatProfileDate(profile.loggedInAt)}
          </ProfileField>
          <ProfileField icon={ShieldCheck} label="وضعیت MFA">
            {profile.mfa.enabled
              ? 'فعال'
              : profile.mfa.setupPending
                ? 'در انتظار تکمیل'
                : 'غیرفعال'}
          </ProfileField>
        </dl>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0 p-5">
          <h2 className="font-black">شعب مجاز</h2>
          {profile.user.branches.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.user.branches.map((branch) => (
                <Badge key={branch.id}>{branch.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              هیچ شعبهٔ مجاز برای این حساب در Session ثبت نشده است.
            </p>
          )}
        </Card>
        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black">خلاصه Permissionها</h2>
            <Badge>
              {profile.user.permissions.length.toLocaleString('fa-IR')} مورد
            </Badge>
          </div>
          {permissionGroups.length ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {permissionGroups.map((group) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm"
                  key={group.key}
                >
                  <span className="truncate font-semibold">{group.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {group.count.toLocaleString('fa-IR')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Permission قابل‌نمایشی در Session وجود ندارد.
            </p>
          )}
        </Card>
      </div>

      <Card
        className={cn(
          'min-w-0 p-5',
          tab === 'security' && 'ring-2 ring-primary/25',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black">نشست‌های فعال</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              فقط زمان‌های امنیتی نمایش داده می‌شوند و اطلاعات حساس ورود در این
              صفحه قرار نمی‌گیرند.
            </p>
          </div>
          <Badge>{sessions.length.toLocaleString('fa-IR')} نشست</Badge>
        </div>
        {sessions.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {sessions.map((session, index) => (
              <li
                className="rounded-2xl border border-border bg-muted/30 p-4"
                key={session.id}
              >
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-emerald-600"
                  />
                  نشست فعال {Number(index + 1).toLocaleString('fa-IR')}
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <SessionTime label="ایجاد" value={session.createdAt} />
                  <SessionTime
                    label="آخرین استفاده"
                    value={session.lastUsedAt}
                  />
                  <SessionTime label="انقضا" value={session.expiresAt} />
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              description="IAM در حال حاضر نشست فعالی برای این حساب برنگردانده است."
              title="نشست فعالی وجود ندارد"
            />
          </div>
        )}
        <Alert
          className="mt-4"
          description="API فعلی نشست جاری را مشخص نمی‌کند و عملیات عمومی «خروج از سایر نشست‌ها» ندارد؛ برای جلوگیری از خروج اشتباهی، دکمه ساختگی نمایش داده نمی‌شود."
          title="مدیریت نشست‌ها فقط‌خواندنی است"
        />
      </Card>
    </section>
  );
}

function ProfileLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="در حال دریافت پروفایل"
      className="space-y-5"
    >
      <div>
        <p className="text-sm font-bold text-primary">حساب کاربری</p>
        <h1 className="mt-1 text-2xl font-black">در حال دریافت پروفایل</h1>
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </section>
  );
}

function ProfileField({
  children,
  icon: Icon,
  label,
  valueDirection,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  valueDirection?: 'ltr' | 'rtl';
}) {
  return (
    <div className="min-w-0 bg-surface p-4">
      <dt className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="mt-2 truncate text-sm font-bold" dir={valueDirection}>
        {children}
      </dd>
    </div>
  );
}

function SessionTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-semibold">{formatProfileDate(value)}</dd>
    </div>
  );
}
