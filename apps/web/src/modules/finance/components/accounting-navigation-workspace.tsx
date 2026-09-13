'use client';

import {
  ArrowLeftRight,
  BookOpenText,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileClock,
  FileText,
  FolderCog,
  Landmark,
  ReceiptText,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { usePageBreadcrumbs } from '@/components/layout/page-breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

interface AccountingNavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface AccountingNavigationGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  items: readonly AccountingNavigationItem[];
}

const accountingNavigationGroups: readonly AccountingNavigationGroup[] = [
  {
    id: 'general-ledger',
    title: 'دفتر کل',
    icon: BookOpenText,
    items: [
      {
        title: 'اطلاعات پایه',
        href: '/finance/accounting/general-ledger/base-information',
        icon: FolderCog,
      },
      {
        title: 'حساب‌ها',
        href: '/finance/accounting/general-ledger/accounts',
        icon: Landmark,
      },
      {
        title: 'اسناد',
        href: '/finance/accounting/general-ledger/documents',
        icon: FileText,
      },
      {
        title: 'عملیات پایان سال',
        href: '/finance/accounting/general-ledger/year-end',
        icon: FileClock,
      },
      {
        title: 'گزارش‌ها',
        href: '/finance/accounting/general-ledger/reports',
        icon: ClipboardList,
      },
    ],
  },
  {
    id: 'receipts-payments',
    title: 'دریافت و پرداخت',
    icon: ArrowLeftRight,
    items: [
      {
        title: 'گزارش پرداخت و دریافت',
        href: '/finance/accounting/receipts-payments/reports',
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 'taxpayer-system',
    title: 'ارتباط با سامانه مودیان مالیاتی',
    href: '/finance/accounting/taxpayer-system',
    icon: ScrollText,
    items: [],
  },
  {
    id: 'tax-accounting',
    title: 'حسابداری مالیاتی',
    href: '/finance/accounting/tax-accounting',
    icon: Calculator,
    items: [],
  },
];

function findSelected(pathname: string) {
  for (const group of accountingNavigationGroups) {
    const child = group.items.find((item) => item.href === pathname);
    if (child) return { groupTitle: group.title, title: child.title };
    if (group.href === pathname)
      return { groupTitle: 'حسابداری', title: group.title };
  }
  return null;
}

function AccountingSecondaryNavigation({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const toggleGroup = (id: string) =>
    setClosedGroups((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  return (
    <aside
      className={cn(
        'shrink-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-[width] duration-200 lg:sticky lg:top-20',
        collapsed ? 'w-full lg:w-[72px]' : 'w-full lg:w-[282px]',
      )}
    >
      <div className="flex min-h-16 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3">
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary">منوی حسابداری</p>
            <p className="truncate text-sm font-black">بخش‌های داخلی</p>
          </div>
        ) : null}
        <Button
          aria-label={
            collapsed ? 'بازکردن منوی حسابداری' : 'جمع‌کردن منوی حسابداری'
          }
          className="shrink-0"
          onClick={onToggle}
          size="icon"
          variant="ghost"
        >
          {collapsed ? (
            <ChevronsLeft className="size-5" />
          ) : (
            <ChevronsRight className="size-5" />
          )}
        </Button>
      </div>

      <nav aria-label="منوی داخلی حسابداری" className="space-y-2 p-2.5">
        {accountingNavigationGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupClosed = closedGroups.includes(group.id);
          if (group.href) {
            const active = pathname === group.href;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted',
                  collapsed && 'justify-center px-0',
                )}
                href={group.href}
                key={group.id}
                title={collapsed ? group.title : undefined}
              >
                <GroupIcon className="size-[18px] shrink-0" />
                {!collapsed ? <span>{group.title}</span> : null}
              </Link>
            );
          }
          return (
            <section className="min-w-0" key={group.id}>
              <button
                aria-expanded={!groupClosed}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-start text-sm font-black outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                  collapsed && 'justify-center px-0',
                )}
                onClick={() => toggleGroup(group.id)}
                title={collapsed ? group.title : undefined}
                type="button"
              >
                <GroupIcon className="size-[18px] shrink-0 text-primary" />
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1">{group.title}</span>
                    {groupClosed ? (
                      <ChevronLeft className="size-4 shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0" />
                    )}
                  </>
                ) : null}
              </button>
              {!collapsed && !groupClosed ? (
                <div className="mt-1 space-y-1 border-s border-border ps-2">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        href={item.href}
                        key={item.href}
                      >
                        <ItemIcon className="size-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

export function AccountingNavigationWorkspace() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const selected = findSelected(pathname);
  const selectedGroupTitle = selected?.groupTitle;
  const selectedTitle = selected?.title;
  const breadcrumbs = useMemo(
    () =>
      pathname === '/finance'
        ? [{ key: 'accounting', title: 'حسابداری' }]
        : [
            { key: 'accounting', title: 'حسابداری', href: '/finance' },
            ...(selectedGroupTitle && selectedGroupTitle !== 'حسابداری'
              ? [
                  {
                    key: 'accounting-group',
                    title: selectedGroupTitle,
                  },
                ]
              : []),
            {
              key: 'accounting-section',
              title: selectedTitle ?? 'بخش حسابداری',
            },
          ],
    [pathname, selectedGroupTitle, selectedTitle],
  );
  usePageBreadcrumbs(pathname, breadcrumbs);

  return (
    <main className="space-y-6">
      <PageHeader
        description="ساختار بخش‌های حسابداری؛ محتوای هر بخش پس از اعلام جزئیات تکمیل می‌شود."
        eyebrow="Rubi Accounting"
        title="حسابداری"
      />
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <AccountingSecondaryNavigation
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <section className="min-w-0 flex-1" aria-live="polite">
          <Card className="min-h-[32rem] p-5 sm:p-7">
            {selected ? (
              <EmptyState
                description="این بخش فقط ایجاد شده است و فرم‌ها، جدول‌ها و عملیات آن پس از اعلام جزئیات شما اضافه می‌شوند."
                title={`${selected.groupTitle} / ${selected.title}`}
              />
            ) : (
              <EmptyState
                description="یکی از زیرگروه‌های منوی حسابداری را انتخاب کنید. محتوای بخش‌ها هنوز تعریف نشده است."
                title="در انتظار تعریف جزئیات"
              />
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
