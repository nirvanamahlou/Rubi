'use client';

import {
  Building2,
  KeyRound,
  type LucideIcon,
  Mail,
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
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
  if (tab === 'preferences') return <PersonalPreferences />;
  if (tab === 'security') return <SessionLogs sessions={profile.sessions} />;
  const displayName = safeProfileDisplayName(profile.user.displayName);

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
        description="اطلاعات حساب کاربری و دسترسی‌های شما"
        eyebrow="حساب کاربری"
        title="پروفایل من"
      />
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

function PersonalPreferences() {
  const { theme, toggleTheme } = useTheme();
  return (
    <section className="min-w-0 space-y-5" dir="rtl">
      <PageHeader
        eyebrow="حساب کاربری"
        title="تنظیمات شخصی"
        description="ظاهر روبی را مطابق سلیقه خود تنظیم کنید."
      />
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-black">ظاهر برنامه</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          انتخاب شما بلافاصله اعمال می‌شود و در همین مرورگر باقی می‌ماند.
        </p>
        <div
          aria-label="انتخاب تم"
          className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2"
          role="group"
        >
          {(
            [
              { value: 'light', label: 'حالت روشن', icon: Sun },
              { value: 'dark', label: 'حالت تیره', icon: Moon },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant="outline"
              aria-pressed={theme === value}
              onClick={() => {
                if (theme !== value) toggleTheme();
              }}
              className={cn(
                'h-auto min-h-28 flex-col justify-center gap-3 text-center text-base',
                theme === value &&
                  'border-primary bg-primary/10 text-primary ring-1 ring-primary',
              )}
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </Button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          تم فعلی: {theme === 'light' ? 'روشن' : 'تیره'}
        </p>
      </Card>
    </section>
  );
}

function SessionLogs({
  sessions,
}: {
  sessions: AuthenticatedProfile['sessions'];
}) {
  const statuses: Record<string, string> = {
    ACTIVE: 'فعال',
    ROTATED: 'تمدیدشده',
    REVOKED: 'باطل‌شده',
    EXPIRED: 'منقضی‌شده',
  };
  return (
    <section className="min-w-0 space-y-5" dir="rtl">
      <PageHeader
        eyebrow="حساب کاربری"
        title="لاگ نشست‌ها"
        description="زمان ایجاد، آخرین استفاده و انقضای نشست‌های ثبت‌شده حساب شما"
      />
      <Card className="overflow-hidden">
        {sessions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-sm">
              <caption className="border-b border-border p-4 text-right font-bold">
                {sessions.length.toLocaleString('fa-IR')} نشست ثبت‌شده
              </caption>
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {[
                    'ردیف',
                    'وضعیت',
                    'ایجاد نشست',
                    'آخرین استفاده',
                    'انقضا',
                  ].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-bold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session, index) => {
                  const status = session.status;
                  return (
                    <tr key={session.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        {(index + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className="px-4 py-4">
                        <Badge>{statuses[status] ?? 'نامشخص'}</Badge>
                      </td>
                      {[
                        session.createdAt,
                        session.lastUsedAt,
                        session.expiresAt,
                      ].map((value, column) => (
                        <td
                          className="whitespace-nowrap px-4 py-4"
                          key={column}
                        >
                          <time dateTime={value}>
                            {formatProfileDate(value)}
                          </time>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لاگ نشستی وجود ندارد"
            description="هنوز نشستی برای نمایش ثبت نشده است."
          />
        )}
      </Card>
    </section>
  );
}
