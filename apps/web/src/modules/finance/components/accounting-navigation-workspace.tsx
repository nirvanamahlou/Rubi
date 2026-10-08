'use client';
import { AccountingWorkspace } from './accounting-workspace';
import { accountingParityDefinitions } from './accounting-parity-definitions';

import {
  ArrowLeftRight,
  BookOpenText,
  Calculator,
  ChevronDown,
  ChevronUp,
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
import Link from '@/components/access-link';
import {
  useRouteAccess,
  useAccessPermissions,
} from '@/modules/iam/access-context';
import { hasManagedAccess } from '@nora/contracts';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { usePageBreadcrumbs } from '@/components/layout/page-breadcrumbs';
import { AccountingButton as Button } from './accounting-operations';
import { Card, PageHeader } from '@/components/ui/surfaces';
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
  sections: readonly {
    title: string;
    items: readonly AccountingNavigationItem[];
  }[];
}

const parityItems = (
  prefix: string,
  icon: LucideIcon,
): AccountingNavigationItem[] =>
  accountingParityDefinitions
    .filter((definition) => definition.route.startsWith(prefix))
    .map((definition) => ({
      title: definition.sourcePath.endsWith(
        'گزارش ها / اعلامیه بدهکار / بستانکار',
      )
        ? 'اعلامیه بدهکار / بستانکار'
        : definition.sourcePath.endsWith('جمع آوری / ارسال صورتحساب')
          ? 'جمع آوری / ارسال صورتحساب'
          : (definition.sourcePath.split(' / ').at(-1) ?? definition.title),
      href: `/finance/accounting/${definition.route}`,
      icon,
    }));

const accountingNavigationGroups: readonly AccountingNavigationGroup[] = [
  {
    id: 'general-ledger',
    title: 'دفتر کل',
    icon: BookOpenText,
    sections: [
      {
        title: 'اطلاعات پایه',
        items: [...parityItems('general-ledger/base-information/', FolderCog)],
      },
      {
        title: 'حساب‌ها',
        items: parityItems('general-ledger/accounts/', Landmark),
      },
      {
        title: 'اسناد',
        items: [
          {
            title: 'سند حسابداری',
            href: '/finance/accounting/general-ledger/documents/list',
            icon: ClipboardList,
          },
          ...parityItems('general-ledger/documents/', FileText),
          {
            title: 'الگوهای تخصیص داخلی روبی',
            href: '/finance/accounting/general-ledger/documents/allocation-templates',
            icon: Calculator,
          },
          {
            title: 'بسته انتقال حسابداری روبی',
            href: '/finance/accounting/general-ledger/documents/transfer-batches',
            icon: ArrowLeftRight,
          },
        ],
      },
      {
        title: 'عملیات پایان سال',
        items: parityItems('general-ledger/year-end/', FileClock),
      },
      {
        title: 'گزارش‌ها',
        items: [
          ...parityItems('general-ledger/reports/', ClipboardList),
          {
            title: 'فهرست گزارش‌های روبی',
            href: '/finance/accounting/general-ledger/reports/catalog',
            icon: ClipboardList,
          },
        ],
      },
    ],
  },
  {
    id: 'receipts-payments',
    title: 'دریافت و پرداخت',
    icon: ArrowLeftRight,
    sections: [
      {
        title: 'اطلاعات پایه',
        items: parityItems('receipts-payments/base-information/', ReceiptText),
      },
      {
        title: 'گزارش‌ها',
        items: [
          {
            title: 'گزارش پرداخت و دریافت روبی',
            href: '/finance/accounting/receipts-payments/reports',
            icon: ReceiptText,
          },
        ],
      },
    ],
  },
  {
    id: 'taxpayer-system',
    title: 'ارتباط با سامانه مودیان مالیاتی',
    icon: ScrollText,
    sections: [
      {
        title: 'فرم‌ها',
        items: parityItems('taxpayer-system/', ScrollText).filter(
          (item) =>
            !item.href.includes('/lists/') &&
            !item.href.includes('/operations/') &&
            !item.href.includes('/reports/'),
        ),
      },
      {
        title: 'فهرست‌ها',
        items: parityItems('taxpayer-system/lists/', ClipboardList),
      },
      {
        title: 'عملیات',
        items: parityItems('taxpayer-system/operations/', FileClock),
      },
      {
        title: 'گزارش‌ها',
        items: parityItems('taxpayer-system/reports/', ClipboardList),
      },
    ],
  },
  {
    id: 'tax-accounting',
    title: 'حسابداری مالیاتی',
    icon: Calculator,
    sections: [
      {
        title: 'اطلاعات پایه',
        items: parityItems('tax-accounting/base-information/', FolderCog),
      },
      {
        title: 'مالیات بر ارزش افزوده',
        items: parityItems('tax-accounting/vat/', Calculator),
      },
    ],
  },
];

function findSelected(pathname: string) {
  for (const group of accountingNavigationGroups) {
    for (const section of group.sections) {
      const child = section.items.find(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + '/'),
      );
      if (child)
        return {
          groupTitle: group.title,
          sectionTitle: section.title,
          title: child.title,
        };
    }
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
  const selectedBook = useSearchParams().get('bookId');
  const allowed = useRouteAccess();
  const permissions = useAccessPermissions();
  const [closedGroups, setClosedGroups] = useState<string[]>(() =>
    accountingNavigationGroups
      .filter((group) =>
        group.sections.every((section) =>
          section.items.every(
            (item) =>
              pathname !== item.href && !pathname.startsWith(item.href + '/'),
          ),
        ),
      )
      .map((group) => group.id),
  );
  const [closedSections, setClosedSections] = useState<string[]>(() =>
    accountingNavigationGroups.flatMap((group) =>
      group.sections
        .filter((section) =>
          section.items.every(
            (item) =>
              pathname !== item.href && !pathname.startsWith(item.href + '/'),
          ),
        )
        .map((section) => `${group.id}:${section.title}`),
    ),
  );
  const [closedLists, setClosedLists] = useState<string[]>([]);
  const toggleGroup = (id: string) =>
    setClosedGroups((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleSection = (id: string) =>
    setClosedSections((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleList = (id: string) =>
    setClosedLists((current) =>
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
        {accountingNavigationGroups
          .filter(
            (group) =>
              !permissions ||
              !hasManagedAccess(permissions) ||
              group.sections.some((section) =>
                section.items.some((item) => allowed(item.href)),
              ),
          )
          .map((group) => {
            const GroupIcon = group.icon;
            const groupClosed = closedGroups.includes(group.id);
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
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronUp className="size-4 shrink-0" />
                      )}
                    </>
                  ) : null}
                </button>
                {!collapsed && !groupClosed ? (
                  <div className="mt-1 space-y-3 border-s border-border ps-2">
                    {group.sections.map((section) => {
                      const sectionId = `${group.id}:${section.title}`;
                      const sectionClosed = closedSections.includes(sectionId);
                      const directItems = section.items.filter(
                        (item) => !item.href.includes('/lists/'),
                      );
                      const listItems = section.items.filter((item) =>
                        item.href.includes('/lists/'),
                      );
                      const listClosed = closedLists.includes(sectionId);
                      const renderItem = (item: AccountingNavigationItem) => {
                        const ItemIcon = item.icon;
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(item.href + '/');
                        return (
                          <Link
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                              active
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            href={
                              selectedBook
                                ? `${item.href}?bookId=${selectedBook}`
                                : item.href
                            }
                            key={item.href}
                          >
                            <ItemIcon className="size-4 shrink-0" />
                            <span>{item.title}</span>
                          </Link>
                        );
                      };
                      return (
                        <div className="space-y-1" key={section.title}>
                          <button
                            aria-expanded={!sectionClosed}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-start text-[11px] font-black text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => toggleSection(sectionId)}
                            type="button"
                          >
                            <span className="min-w-0 flex-1">
                              {section.title}
                            </span>
                            {sectionClosed ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronUp className="size-3.5" />
                            )}
                          </button>
                          {!sectionClosed ? (
                            <div className="space-y-1 ps-1">
                              {directItems.map(renderItem)}
                              {listItems.length ? (
                                <div className="space-y-1">
                                  <button
                                    aria-expanded={!listClosed}
                                    className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-start text-xs font-bold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => toggleList(sectionId)}
                                    type="button"
                                  >
                                    <ClipboardList className="size-4 text-primary" />
                                    <span className="min-w-0 flex-1">
                                      فهرست‌ها
                                    </span>
                                    {listClosed ? (
                                      <ChevronDown className="size-3.5" />
                                    ) : (
                                      <ChevronUp className="size-3.5" />
                                    )}
                                  </button>
                                  {!listClosed ? (
                                    <div className="space-y-1 border-s border-border ps-2">
                                      {listItems.map(renderItem)}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
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

function AccountingNavigationWorkspaceContent() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const selected = findSelected(pathname);
  const selectedGroupTitle = selected?.groupTitle;
  const selectedSectionTitle = selected?.sectionTitle;
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
            ...(selectedSectionTitle &&
            selectedSectionTitle !== selectedGroupTitle
              ? [
                  {
                    key: 'accounting-subgroup',
                    title: selectedSectionTitle,
                  },
                ]
              : []),
            {
              key: 'accounting-section',
              title: selectedTitle ?? 'بخش حسابداری',
            },
          ],
    [pathname, selectedGroupTitle, selectedSectionTitle, selectedTitle],
  );
  usePageBreadcrumbs(pathname, breadcrumbs);

  return (
    <main className="space-y-6">
      <PageHeader
        description="دفاتر، حساب‌ها، اسناد و گزارش‌های حسابداری"
        eyebrow="Nora Accounting"
        title="حسابداری"
      />
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <AccountingSecondaryNavigation
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <section className="min-w-0 flex-1" aria-live="polite">
          <Card className="min-h-[32rem] p-5 sm:p-7">
            <Suspense fallback={<p role="status">در حال بارگذاری…</p>}>
              <AccountingWorkspace key={pathname} pathname={pathname} />
            </Suspense>
          </Card>
        </section>
      </div>
    </main>
  );
}

export function AccountingNavigationWorkspace() {
  return (
    <Suspense fallback={<p role="status">در حال بارگذاری…</p>}>
      <AccountingNavigationWorkspaceContent />
    </Suspense>
  );
}
