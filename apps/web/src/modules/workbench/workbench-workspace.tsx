'use client';

import type { NotificationItemV1 } from '@rubi/contracts';
import {
  Activity,
  ArrowUpLeft,
  Bell,
  CheckCheck,
  ClipboardList,
  FileText,
  Home,
  Layers3,
  MessageSquare,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Star,
  StickyNote,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HeaderToday } from '@/components/layout/header-today';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { legalEntitySelectionLabel } from '@/modules/legal-entities/model/context';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/modules/notifications/api/client';
import { ProfileUnauthorizedError } from '@/modules/profile/api/client';
import { profileInitials } from '@/modules/profile/model/profile';
import { loadWorkbenchHome, markWorkbenchNotificationRead } from './api';
import {
  normalizeWorkbenchTab,
  safeWorkbenchHref,
  workbenchDate,
  workbenchTabs,
  type WorkbenchHome,
  type WorkbenchTab,
} from './model';
import { WorkbenchFiles } from './workbench-files';
import { NoteEditor } from './note-editor';

const tabIcons = [
  Home,
  ClipboardList,
  MessageSquare,
  FileText,
  Star,
  Activity,
  StickyNote,
  Settings2,
];
const ownerDestinations = [
  {
    href: '/hr',
    title: 'درخواست‌های منابع انسانی',
    description: 'مرخصی، مأموریت و پیگیری پرونده‌های کارکنان',
    permission: 'hr.',
  },
  {
    href: '/sales',
    title: 'فروش و قراردادها',
    description: 'ثبت و پیگیری درخواست در پرونده فروش',
    permission: 'sales.',
  },
  {
    href: '/reservations',
    title: 'رزرواسیون و عملیات سفر',
    description: 'پیگیری درخواست‌های اجرایی سفر',
    permission: 'reservations.',
  },
] as const;

export function WorkbenchWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = normalizeWorkbenchTab(params.get('tab'));
  const company = useLegalEntityContext();
  const [home, setHome] = useState<WorkbenchHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [pendingRead, setPendingRead] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setHome(null);
    setError('');
    setUnauthorized(false);
    try {
      const result = await loadWorkbenchHome();
      if (request === generation.current) setHome(result);
    } catch (reason) {
      if (request === generation.current) {
        setUnauthorized(reason instanceof ProfileUnauthorizedError);
        setError(
          reason instanceof Error ? reason.message : 'دریافت میزکار انجام نشد.',
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = noteOpen ? undefined : setTimeout(() => void load(), 0);
    const refresh = () => {
      if (!noteOpen) void load();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearTimeout(timer);
      invalidate();
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [load, invalidate, noteOpen]);
  function selectTab(value: string) {
    const query = new URLSearchParams(params.toString());
    query.set('tab', normalizeWorkbenchTab(value));
    router.replace(`/workbench?${query.toString()}`, { scroll: false });
  }
  async function markRead(id: string) {
    if (pendingRead) return;
    setPendingRead(id);
    setActionError('');
    try {
      await markWorkbenchNotificationRead(id);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : 'وضعیت اعلان ثبت نشد.',
      );
    } finally {
      setPendingRead(null);
    }
  }
  return (
    <div className="space-y-6" data-workbench-native>
      <PageHeader
        title="میزکار من"
        description="کارهای روزانه، فایل‌ها و ارتباط شما با بخش‌های روبی."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!home || loading}
              onClick={() => setNoteOpen(true)}
            >
              <StickyNote className="size-4" aria-hidden="true" />
              یادداشت جدید
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              به‌روزرسانی
            </Button>
          </div>
        }
      />
      {loading ? (
        <div
          aria-label="در حال دریافت میزکار"
          role="status"
          className="space-y-4"
        >
          <Skeleton className="h-28" />
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      ) : error ? (
        <Alert
          tone="error"
          title={
            unauthorized ? 'برای مشاهده میزکار وارد شوید' : 'میزکار دریافت نشد'
          }
          description={error}
        >
          {unauthorized && (
            <Button asChild className="mt-3">
              <Link href="/login?next=%2Fworkbench">ورود به سامانه</Link>
            </Button>
          )}
        </Alert>
      ) : (
        home && (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5 bg-gradient-to-l from-primary/10 to-surface">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                  {profileInitials(home.user.displayName)}
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold break-words">
                    {home.user.displayName}، روزتان بخیر
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {company.loading
                      ? 'در حال دریافت شرکت فعال…'
                      : company.error
                        ? 'شرکت فعال دریافت نشد'
                        : company.context
                          ? legalEntitySelectionLabel(
                              company.context.selection,
                              company.entities,
                            )
                          : 'شرکتی انتخاب نشده است'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <HeaderToday />
                <p className="text-xs text-muted-foreground">
                  {home.user.branches.length.toLocaleString('fa-IR')} شعبه مجاز
                </p>
              </div>
            </Card>
            <Tabs
              dir="rtl"
              value={tab}
              onValueChange={selectTab}
              className="space-y-5"
            >
              <TabsList
                aria-label="بخش‌های میزکار"
                className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-2 sm:grid-cols-4 xl:grid-cols-8"
              >
                {workbenchTabs.map(([id, label], index) => {
                  const Icon = tabIcons[index]!;
                  return (
                    <TabsTrigger
                      key={id}
                      value={id}
                      className="min-h-16 whitespace-normal flex flex-col gap-2 px-2 py-3"
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      <span>{label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <TabsContent value="today" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    title="اعلان‌های خوانده‌نشده"
                    value={
                      home.notifications.status === 'ready'
                        ? home.notifications.data.meta.unreadCount
                        : null
                    }
                    detail="اعلان‌های ارسال‌شده برای شما"
                    icon={Bell}
                  />
                  <Metric
                    title="فایل‌های من"
                    value={
                      home.documents.status === 'ready'
                        ? home.documents.data.meta.total
                        : null
                    }
                    detail={
                      home.documents.status === 'forbidden'
                        ? 'نیازمند دسترسی اسناد'
                        : 'اسناد متعلق به حساب شما'
                    }
                    icon={FileText}
                    onClick={() => selectTab('files')}
                  />
                  <Metric
                    title="کارهای شخصی"
                    value={null}
                    detail="این قابلیت هنوز فعال نشده است"
                    icon={ClipboardList}
                  />
                  <Metric
                    title="گفت‌وگوهای داخلی"
                    value={null}
                    detail="این قابلیت هنوز فعال نشده است"
                    icon={MessageSquare}
                  />
                </div>
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Bell
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <h2 className="font-bold">اعلان‌های من</h2>
                      <Badge className="ms-auto">سامانه</Badge>
                    </div>
                    {actionError && (
                      <Alert
                        title="وضعیت اعلان ثبت نشد"
                        description={actionError}
                        tone="error"
                      />
                    )}
                    <NotificationFeed
                      home={home}
                      pendingRead={pendingRead}
                      onRead={markRead}
                    />
                  </Card>
                  <div className="space-y-5">
                    <Card className="p-5">
                      <h2 className="font-bold mb-4">دسترسی سریع</h2>
                      <div className="grid gap-2">
                        <QuickLink href="/profile" label="پروفایل و حساب من" />
                        <QuickLink
                          href="/workbench?tab=files"
                          label="فایل‌های من"
                        />
                        <QuickLink
                          href="/workbench?tab=requests"
                          label="پیگیری درخواست‌ها"
                        />
                      </div>
                    </Card>
                    <Card className="p-5">
                      <h2 className="font-bold mb-3">آخرین فایل‌های من</h2>
                      {home.documents.status === 'ready' ? (
                        home.documents.data.data.length ? (
                          <ul className="space-y-3">
                            {home.documents.data.data
                              .slice(0, 5)
                              .map((file) => (
                                <li key={file.id}>
                                  <Link
                                    className="block rounded-lg p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                    href={`/documents?document=${encodeURIComponent(file.id)}`}
                                  >
                                    <span className="font-medium text-sm">
                                      {file.title}
                                    </span>
                                    <span className="block text-xs text-muted-foreground mt-1">
                                      {file.archiveCode}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            هنوز سندی متعلق به شما ثبت نشده است.
                          </p>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {home.documents.status === 'error'
                            ? home.documents.message
                            : 'دسترسی اسناد برای شما فعال نیست.'}
                        </p>
                      )}
                    </Card>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="files">
                <WorkbenchFiles
                  key={home.user.id}
                  user={home.user}
                  onChange={() => void load()}
                />
              </TabsContent>
              <TabsContent value="requests" className="space-y-4">
                <Alert
                  title="ثبت و پیگیری در پرونده اصلی"
                  description="کارتابل عمومی درخواست‌ها هنوز فعال نیست. درخواست‌های موجود را از بخش مسئول همان خدمت پیگیری کنید."
                />
                <div className="grid gap-4 md:grid-cols-3">
                  {ownerDestinations
                    .filter((destination) =>
                      home.user.permissions.some((permission) =>
                        permission.startsWith(destination.permission),
                      ),
                    )
                    .map((destination) => (
                      <Card key={destination.href} className="p-5">
                        <h2 className="font-bold">{destination.title}</h2>
                        <p className="text-sm text-muted-foreground my-3 leading-7">
                          {destination.description}
                        </p>
                        <Button asChild variant="outline">
                          <Link href={destination.href}>
                            رفتن به بخش مربوط
                            <ArrowUpLeft
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Link>
                        </Button>
                      </Card>
                    ))}
                </div>
              </TabsContent>
              <TabsContent value="messages">
                <Unavailable tab="messages" />
              </TabsContent>
              <TabsContent value="stars">
                <Unavailable tab="stars" />
              </TabsContent>
              <TabsContent value="notes">
                <Card className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-bold">یادداشت‌های من</h2>
                    <Button onClick={() => setNoteOpen(true)}>
                      <StickyNote className="size-4" aria-hidden="true" />
                      یادداشت جدید
                    </Button>
                  </div>
                  <Alert
                    tone="info"
                    title="فرم یادداشت آماده است"
                    description="برای نوشتن عنوان و متن، یادداشت جدید را باز کنید. ثبت و نگهداری یادداشت در حساب هنوز فعال نشده است."
                  />
                </Card>
              </TabsContent>
              <TabsContent value="activity">
                <Card className="p-5">
                  <h2 className="font-bold mb-2">فعالیت‌های ثبت‌شده شما</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    فعالیت‌هایی که در آخرین اعلان‌های قابل‌مشاهده، با حساب شما
                    ثبت شده‌اند.
                  </p>
                  <NotificationFeed
                    home={home}
                    activityOnly
                    pendingRead={pendingRead}
                    onRead={markRead}
                  />
                </Card>
              </TabsContent>
              <TabsContent value="account">
                <Card className="p-5 space-y-5">
                  <div className="flex items-center gap-3">
                    <UserRound
                      className="text-primary size-6"
                      aria-hidden="true"
                    />
                    <h2 className="font-bold">{home.user.displayName}</h2>
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        نام کاربری
                      </dt>
                      <dd className="mt-1 font-medium">{home.user.username}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">ایمیل</dt>
                      <dd className="mt-1 break-all">
                        {home.user.email || 'ثبت نشده'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        شعب مجاز
                      </dt>
                      <dd className="mt-2 flex flex-wrap gap-2">
                        {home.user.branches.map((branch) => (
                          <Badge key={branch.id}>{branch.name}</Badge>
                        ))}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link href="/profile">
                        <UserRound className="size-4" aria-hidden="true" />
                        پروفایل من
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/profile?tab=security">
                        <ShieldCheck className="size-4" aria-hidden="true" />
                        امنیت و نشست‌ها
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/profile?tab=preferences">
                        <Settings2 className="size-4" aria-hidden="true" />
                        تنظیمات شخصی
                      </Link>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    حالت روشن و تیره از سربرگ اصلی روبی تغییر می‌کند.
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )
      )}
      {home && (
        <NoteEditor
          key={home.user.id}
          open={noteOpen}
          onOpenChange={setNoteOpen}
        />
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: number | null;
  detail: string;
  icon: typeof Bell;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>{title}</span>
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </span>
      <strong className="block my-3 text-3xl font-black text-foreground">
        {value === null ? '—' : value.toLocaleString('fa-IR')}
      </strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </>
  );
  return (
    <Card>
      {onClick ? (
        <button
          type="button"
          className="w-full rounded-2xl p-5 text-start hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <div className="p-5">{content}</div>
      )}
    </Card>
  );
}
function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Layers3 className="size-4 text-primary" aria-hidden="true" />
      {label}
      <ArrowUpLeft className="ms-auto size-4" aria-hidden="true" />
    </Link>
  );
}
function Unavailable({
  tab,
}: {
  tab: Extract<WorkbenchTab, 'stars' | 'messages'>;
}) {
  const content = {
    stars: {
      title: 'ستاره‌دارها هنوز فعال نشده‌اند',
      description:
        'ذخیره میان‌برهای شخصی در حساب شما هنوز فراهم نشده است. فعلاً از دسترسی سریع صفحه امروز استفاده کنید.',
      icon: Star,
    },
    messages: {
      title: 'گفت‌وگوی داخلی هنوز فعال نشده است',
      description:
        'ارسال پیام بین همکاران هنوز در دسترس نیست. اعلان‌های واقعی سامانه در صفحه امروز نمایش داده می‌شوند.',
      icon: MessageSquare,
    },
  }[tab];
  return (
    <Card>
      <EmptyState {...content} />
    </Card>
  );
}
function NotificationFeed({
  home,
  activityOnly = false,
  pendingRead,
  onRead,
}: {
  home: WorkbenchHome;
  activityOnly?: boolean;
  pendingRead: string | null;
  onRead: (id: string) => Promise<void>;
}) {
  if (home.notifications.status !== 'ready')
    return (
      <Alert
        tone="error"
        title="اعلان‌ها دریافت نشدند"
        description={
          home.notifications.status === 'error'
            ? home.notifications.message
            : 'دسترسی به اعلان‌ها فعال نیست.'
        }
      />
    );
  const items = home.notifications.data.data.filter(
    (item) => !activityOnly || item.actor?.id === home.user.id,
  );
  if (!items.length)
    return (
      <EmptyState
        title={
          activityOnly ? 'فعالیتی در این فهرست نیست' : 'اعلانی برای شما نیست'
        }
        description={
          activityOnly
            ? 'آخرین اعلان‌ها، فعالیتی ثبت‌شده با حساب شما ندارند.'
            : 'اعلان‌های جدید سامانه اینجا نمایش داده می‌شوند.'
        }
      />
    );
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          pendingRead={pendingRead}
          onRead={onRead}
          activityOnly={activityOnly}
        />
      ))}
    </ul>
  );
}
function NotificationRow({
  item,
  pendingRead,
  onRead,
  activityOnly,
}: {
  item: NotificationItemV1;
  pendingRead: string | null;
  onRead: (id: string) => Promise<void>;
  activityOnly: boolean;
}) {
  const href = safeWorkbenchHref(item.href);
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={`mt-2 size-2 shrink-0 rounded-full ${item.isRead ? 'bg-muted' : 'bg-primary'}`}
          aria-label={item.isRead ? 'خوانده‌شده' : 'خوانده‌نشده'}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm break-words">{item.title}</h3>
          <p className="my-2 text-sm leading-7 text-muted-foreground break-words">
            {item.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {workbenchDate(item.occurredAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {href && (
              <Button asChild size="sm" variant="outline">
                <Link href={href}>
                  مشاهده پرونده
                  <ArrowUpLeft className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
            {!item.isRead && !activityOnly && (
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(pendingRead)}
                onClick={() => void onRead(item.id)}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                {pendingRead === item.id ? 'در حال ثبت…' : 'خواندم'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
