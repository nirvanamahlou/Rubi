'use client';
import { AccountingWorkspace } from './accounting-workspace';
import { AccountingRouteTabs } from './accounting-route-tabs';
import { AccountingPageKpis } from './accounting-page-kpis';
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
  Gauge,
  Landmark,
  ReceiptText,
  ScrollText,
  Sparkles,
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
import { cn } from '@/lib/utils';
import styles from './accounting-navigation-workspace.module.css';

export interface AccountingNavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface AccountingNavigationGroup {
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

export const documentListOnlyRoutes = [
  'general-ledger/documents/journals',
  'general-ledger/documents/revaluation',
  'general-ledger/documents/revaluation-templates',
  'general-ledger/documents/automatic-templates',
] as const;

const documentListOnlyRouteSet = new Set<string>(documentListOnlyRoutes);

export const accountingNavigationGroups: readonly AccountingNavigationGroup[] =
  [
    {
      id: 'general-ledger',
      title: 'دفتر کل',
      icon: BookOpenText,
      sections: [
        {
          title: 'اطلاعات پایه',
          items: [
            ...parityItems('general-ledger/base-information/', FolderCog),
          ],
        },
        {
          title: 'حساب‌ها',
          items: parityItems('general-ledger/accounts/', Landmark),
        },
        {
          title: 'اسناد',
          items: [
            ...parityItems('general-ledger/documents/', FileText).filter(
              (item) =>
                !documentListOnlyRouteSet.has(
                  item.href.replace('/finance/accounting/', ''),
                ),
            ),
          ],
        },
        {
          title: 'عملیات پایان سال',
          items: parityItems('general-ledger/year-end/', FileClock),
        },
        {
          title: 'گزارش‌ها',
          items: [...parityItems('general-ledger/reports/', ClipboardList)],
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
          items: parityItems(
            'receipts-payments/base-information/',
            ReceiptText,
          ),
        },
      ],
    },
    {
      id: 'taxpayer-system',
      title: 'سامانه مودیان',
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
    {
      id: 'dashboard',
      title: 'داشبورد حسابداری',
      icon: Gauge,
      sections: [
        {
          title: 'داشبورد',
          items: [
            {
              title: 'داشبورد حسابداری',
              href: '/finance/accounting/dashboard',
              icon: Gauge,
            },
          ],
        },
      ],
    },
  ];

const accountingTabItems = Array.from(
  new Map(
    [
      ...accountingNavigationGroups.flatMap((group) =>
        group.sections.flatMap((section) => section.items),
      ),
      ...accountingParityDefinitions.map((definition) => ({
        href: `/finance/accounting/${definition.route}`,
        title: definition.title,
        icon: FileText,
      })),
    ].map((item) => [
      item.href,
      {
        href: item.href,
        title: item.href.includes('/lists/')
          ? `فهرست ${item.title}`
          : item.title,
      },
    ]),
  ).values(),
);

export function findSelectedAccountingSection(pathname: string) {
  const definition = accountingParityDefinitions.find(
    (item) => pathname === `/finance/accounting/${item.route}`,
  );
  const matches = [];
  for (const group of accountingNavigationGroups) {
    for (const section of group.sections) {
      const child = section.items.find(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + '/'),
      );
      if (child)
        matches.push({
          groupTitle: group.title,
          sectionTitle: section.title,
          title: definition?.title ?? child.title,
          href: child.href,
        });
    }
  }
  const match = matches.sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return match;
  if (definition) {
    const group = accountingNavigationGroups.find((item) =>
      definition.route.startsWith(`${item.id}/`),
    );
    return {
      groupTitle: group?.title,
      sectionTitle: definition.sourcePath.split(' / ').at(-2),
      title: definition.title,
    };
  }
  const group = accountingNavigationGroups.find(
    (item) => pathname === `/finance/accounting/${item.id}`,
  );
  for (const parent of accountingNavigationGroups) {
    const section = parent.sections.find((candidate) =>
      candidate.items.some((item) => item.href.startsWith(`${pathname}/`)),
    );
    if (
      !group &&
      section &&
      pathname !== '/finance' &&
      pathname !== '/finance/accounting'
    )
      return {
        groupTitle: parent.title,
        sectionTitle: section.title,
        title: section.title,
      };
  }
  return group
    ? { groupTitle: group.title, sectionTitle: undefined, title: group.title }
    : null;
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
      data-accounting-navigation
      className={cn(
        'shrink-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1f2f] text-white shadow-[0_24px_70px_rgba(4,21,32,0.24)] transition-[width] duration-200 lg:sticky lg:top-20',
        collapsed ? 'w-full lg:w-[76px]' : 'w-full lg:w-[304px]',
      )}
    >
      <div className="relative flex min-h-[76px] items-center justify-between gap-2 overflow-hidden border-b border-white/10 bg-gradient-to-l from-cyan-400/15 via-transparent to-emerald-300/10 px-4">
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              ACCOUNTING
            </p>
            <p className="mt-1 truncate text-sm font-black text-white">
              راهبری حسابداری
            </p>
          </div>
        ) : null}
        <Button
          aria-label={
            collapsed ? 'بازکردن منوی حسابداری' : 'جمع‌کردن منوی حسابداری'
          }
          className="shrink-0 border-white/10 bg-white/5 text-white hover:bg-white/10"
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

      <nav aria-label="منوی داخلی حسابداری" className="space-y-2 p-3">
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
                    'flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-transparent px-3 text-start text-sm font-black text-slate-100 outline-none transition hover:border-white/10 hover:bg-white/7 focus-visible:ring-2 focus-visible:ring-cyan-300',
                    collapsed && 'justify-center px-0',
                  )}
                  onClick={() => toggleGroup(group.id)}
                  title={collapsed ? group.title : undefined}
                  type="button"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/8 text-cyan-300">
                    <GroupIcon className="size-[17px]" />
                  </span>
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
                  <div className="mt-1 space-y-3 border-s border-white/10 ps-2">
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
                              'group flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300',
                              active
                                ? 'border-cyan-300/30 bg-gradient-to-l from-cyan-300/18 to-emerald-300/8 text-white shadow-[inset_-3px_0_0_#67e8f9]'
                                : 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/6 hover:text-white',
                            )}
                            href={
                              selectedBook
                                ? `${item.href}?bookId=${selectedBook}`
                                : item.href
                            }
                            key={item.href}
                          >
                            <ItemIcon className="size-4 shrink-0 text-cyan-300/90 transition group-hover:text-cyan-200" />
                            <span>{item.title}</span>
                          </Link>
                        );
                      };
                      return (
                        <div className="space-y-1" key={section.title}>
                          <button
                            aria-expanded={!sectionClosed}
                            className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-start text-[11px] font-black text-slate-400 outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300"
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
                                    className="flex min-h-9 w-full items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-200/5 px-3 text-start text-xs font-bold text-amber-100 outline-none hover:bg-amber-200/10 focus-visible:ring-2 focus-visible:ring-amber-200"
                                    onClick={() => toggleList(sectionId)}
                                    type="button"
                                  >
                                    <ClipboardList className="size-4 text-amber-300" />
                                    <span className="min-w-0 flex-1">
                                      فهرست
                                    </span>
                                    {listClosed ? (
                                      <ChevronDown className="size-3.5" />
                                    ) : (
                                      <ChevronUp className="size-3.5" />
                                    )}
                                  </button>
                                  {!listClosed ? (
                                    <div className="space-y-1 border-s border-amber-200/20 ps-2">
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
  const selected = findSelectedAccountingSection(pathname);
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
    <main
      className={cn('space-y-5 p-1 sm:p-2', styles.workspace)}
      data-accounting-workspace
    >
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className="relative flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-cyan-200 shadow-inner backdrop-blur">
              <Gauge className="size-7" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-cyan-200">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {selectedGroupTitle ?? 'حسابداری'}
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {selectedTitle ?? 'فضای کار حسابداری'}
              </h1>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2 text-[11px] font-bold text-slate-200">
            <span className="rounded-full border border-cyan-200/15 bg-cyan-200/8 px-3 py-1.5">
              دفترمحور
            </span>
            <span className="rounded-full border border-emerald-200/15 bg-emerald-200/8 px-3 py-1.5">
              کنترل‌پذیر
            </span>
            <span className="rounded-full border border-amber-200/15 bg-amber-200/8 px-3 py-1.5">
              یکپارچه
            </span>
          </div>
        </div>
      </header>
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <AccountingSecondaryNavigation
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <section
          className={cn('min-w-0 flex-1', styles.contentColumn)}
          aria-live="polite"
        >
          <AccountingRouteTabs items={accountingTabItems} />
          <div
            data-accounting-inline-surface
            className={cn(
              'min-h-[32rem] rounded-b-[1.75rem] border border-border/80 bg-surface/95 p-5 shadow-[0_24px_70px_rgba(15,45,66,0.1)] backdrop-blur sm:p-7',
              styles.formSurface,
            )}
          >
            <Suspense fallback={<p role="status">در حال بارگذاری…</p>}>
              {pathname !== '/finance/accounting/dashboard' && (
                <AccountingPageKpis pathname={pathname} />
              )}
              <AccountingWorkspace key={pathname} pathname={pathname} />
            </Suspense>
          </div>
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
