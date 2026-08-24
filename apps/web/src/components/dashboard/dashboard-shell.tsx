'use client';

import {
  BadgePercent,
  Banknote,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gauge,
  Headphones,
  ListChecks,
  PlaneTakeoff,
  Search,
  TicketCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Badge, Card, EmptyState } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

type DashboardGroup =
  'sales' | 'reservations' | 'capacity' | 'finance' | 'management';

interface DashboardCard {
  title: string;
  detail: string;
  icon: LucideIcon;
}

const dashboardGroups: Record<
  DashboardGroup,
  { title: string; cards: readonly DashboardCard[] }
> = {
  sales: {
    title: 'فروش',
    cards: [
      {
        title: 'درخواست‌های جدید',
        detail: 'ورودی واجد بررسی Customer Affairs',
        icon: ListChecks,
      },
      {
        title: 'قراردادهای منتظر اقدام',
        detail: 'مدیر، مشتری، مالی یا رزرواسیون',
        icon: FileCheck2,
      },
      {
        title: 'فروش روزانه، هفتگی و ماهانه',
        detail: 'از View تأییدشده Reporting',
        icon: TrendingUp,
      },
      {
        title: 'نرخ تبدیل درخواست به قرارداد',
        detail: 'بدون تکثیر مبلغ یا مسافر',
        icon: ChartNoAxesCombined,
      },
    ],
  },
  reservations: {
    title: 'رزرواسیون',
    cards: [
      {
        title: 'استعلام‌های جدید',
        detail: 'بلیت، هتل، تور و Provider',
        icon: Search,
      },
      {
        title: 'صدورهای در انتظار',
        detail: 'بلیت، واچر و بیمه سامان',
        icon: TicketCheck,
      },
      {
        title: 'Manifestهای منتظر',
        detail: 'ساخت، بازبینی، ارسال یا پاسخ',
        icon: PlaneTakeoff,
      },
      {
        title: 'پاسخ‌های در انتظار کارگزار',
        detail: 'هتل، Confirmation و اصلاح',
        icon: Clock3,
      },
    ],
  },
  capacity: {
    title: 'ظرفیت',
    cards: [
      {
        title: 'ظرفیت بلیت‌های شرکت',
        detail: 'کل ظرفیت تعریف‌شده',
        icon: Gauge,
      },
      {
        title: 'ظرفیت Holdشده',
        detail: 'با نمایش زمان انقضا',
        icon: Clock3,
      },
      {
        title: 'قطعی و فروخته‌شده',
        detail: 'محورهای مستقل ظرفیت',
        icon: TicketCheck,
      },
      {
        title: 'ظرفیت باقی‌مانده',
        detail: 'کنترل جلوگیری از Oversell',
        icon: PlaneTakeoff,
      },
    ],
  },
  finance: {
    title: 'مالی',
    cards: [
      {
        title: 'چک‌های نزدیک سررسید',
        detail: 'یادآوری سیاست‌محور',
        icon: CalendarDays,
      },
      {
        title: 'چک‌های برگشتی',
        detail: 'نیازمند اقدام خزانه‌داری',
        icon: WalletCards,
      },
      {
        title: 'بدهی کارگزاران',
        detail: 'از payableهای approved',
        icon: Banknote,
      },
      {
        title: 'قراردادهای مسدود مالی',
        detail: 'Financial Release مستقل',
        icon: CircleDollarSign,
      },
    ],
  },
  management: {
    title: 'مدیریتی',
    cards: [
      {
        title: 'سود قرارداد و خدمت',
        detail: 'فروش snapshot منهای خرید خالص',
        icon: BadgePercent,
      },
      {
        title: 'عملکرد شعب و کاربران',
        detail: 'Permission-aware و grain-safe',
        icon: UsersRound,
      },
      {
        title: 'فعالیت دو سایت',
        detail: 'Sales Channelهای مستقل',
        icon: Building2,
      },
      {
        title: 'Ticket و Task عقب‌افتاده',
        detail: 'SLA، اولویت و Escalation',
        icon: Headphones,
      },
    ],
  },
};

const queueItems = [
  {
    title: 'Holdهای نزدیک انقضا',
    owner: 'رزرواسیون',
    status: 'نیازمند بررسی',
  },
  {
    title: 'قراردادهای منتظر Financial Release',
    owner: 'مالی',
    status: 'منتظر تأیید',
  },
  {
    title: 'Manifestهای آماده بازبینی',
    owner: 'رزرواسیون',
    status: 'آماده اقدام',
  },
  {
    title: 'وظایف و Ticketهای عقب‌افتاده',
    owner: 'پشتیبانی',
    status: 'خارج SLA',
  },
] as const;

export function DashboardShell() {
  const [activeGroup, setActiveGroup] = useState<DashboardGroup>('sales');
  const group = dashboardGroups[activeGroup];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#123f8c_0%,#155fc5_58%,#188fbd_100%)] px-5 py-5 text-white shadow-xl shadow-blue-900/15 sm:px-6">
        <div className="absolute -left-10 -top-20 size-56 rounded-full border-[34px] border-white/5" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-blue-100">
              <span className="size-2 rounded-full bg-[#27c1b5] shadow-[0_0_0_5px_rgb(39_193_181_/_0.16)]" />
              CRM شرکت نیایش سیر سحر
              <Badge className="bg-white/15 text-white">
                نمونه طراحی و ذخیره‌نشده
              </Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">
              داشبورد مدیریتی
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-blue-50/85">
              نمای Preview فروش، رزرواسیون، ظرفیت، مالی و مدیریت؛ همه مقدارهای
              متصل‌نشده با خط تیره نمایش داده می‌شوند.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute end-3 top-3 size-4 text-blue-100"
              />
              <Input
                aria-label="جست‌وجوی داشبورد"
                className="border-white/20 bg-white/10 pe-10 text-white placeholder:text-blue-100"
                placeholder="جست‌وجوی کارت یا صف"
              />
            </div>
            <Select defaultValue="month">
              <SelectTrigger
                aria-label="بازه داشبورد"
                className="border-white/20 bg-white/10 text-white"
              >
                <CalendarDays aria-hidden="true" className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">امروز</SelectItem>
                <SelectItem value="week">این هفته</SelectItem>
                <SelectItem value="month">این ماه</SelectItem>
                <SelectItem value="year">امسال</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            Object.entries(dashboardGroups) as [
              DashboardGroup,
              (typeof dashboardGroups)[DashboardGroup],
            ][]
          ).map(([key, value]) => (
            <button
              aria-selected={activeGroup === key}
              className={cn(
                'min-h-10 rounded-xl px-4 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                activeGroup === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
              key={key}
              onClick={() => setActiveGroup(key)}
              role="tab"
              type="button"
            >
              {value.title}
            </button>
          ))}
        </div>
      </Card>

      <section
        aria-label={`کارت‌های داشبورد ${group.title}`}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {group.cards.map(({ detail, icon: Icon, title }) => (
          <Card
            className="group relative overflow-hidden border-blue-100/90 p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-blue-300 dark:border-blue-900/70"
            key={title}
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-[#1557b8] to-[#24bdb1]" />
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#1557b8] transition group-hover:bg-[#1557b8] group-hover:text-white dark:bg-blue-950/70 dark:text-blue-300">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <Badge className="text-[10px]">Preview</Badge>
            </div>
            <p className="mt-3 text-sm font-black">{title}</p>
            <p className="mt-2 text-2xl font-black" aria-label="بدون داده">
              —
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              {detail}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-black">صف اقدام سراسری</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reference بین‌ماژولی؛ بدون Query مستقیم جدول ماژول دیگر
              </p>
            </div>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Preview
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {queueItems.map((item) => (
              <article
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={item.title}
              >
                <div>
                  <p className="text-sm font-black">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    مالک: {item.owner} · داده نمونه بدون PII
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{item.status}</Badge>
                  <Button size="sm" variant="outline">
                    مشاهده مسیر
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined
              aria-hidden="true"
              className="size-5 text-primary"
            />
            <h2 className="font-black">عملکرد دو سایت و شعب</h2>
          </div>
          <div className="mt-4 grid min-h-48 place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center dark:border-blue-900 dark:bg-blue-950/20">
            <div>
              <TrendingUp className="mx-auto size-8 text-blue-300" />
              <p className="mt-3 text-sm font-bold">محل نمودار grain-safe</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                فروش دو سایت، شعب و کاربران پس از اتصال approved Reporting View
                نمایش داده می‌شود.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-black">فیلترهای مشترک Dashboard</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            تاریخ، سایت، شعبه، کارشناس، کانال، خدمت، آژانس، Provider، ارز و
            وضعیت در قرارداد Backend آینده به‌صورت snapshot ثبت می‌شوند.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              'تاریخ',
              'سایت',
              'شعبه',
              'کارشناس',
              'کانال',
              'خدمت',
              'آژانس',
              'Provider',
              'ارز',
              'وضعیت',
            ].map((filter) => (
              <Badge key={filter}>{filter}</Badge>
            ))}
          </div>
        </Card>
        <EmptyState
          description="آخرین فعالیت‌ها پس از اتصال Backend و با Permission کاربر در این بخش نمایش داده می‌شوند."
          title="Timeline فعالیت بدون داده متصل"
        />
      </section>
    </div>
  );
}
