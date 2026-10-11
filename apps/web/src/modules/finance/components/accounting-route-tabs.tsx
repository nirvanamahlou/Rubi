'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X, Plus, FileText } from 'lucide-react';
import Link from '@/components/access-link';
import { useRouteAccess } from '@/modules/iam/access-context';

type Tab = { path: string; title: string; href: string };
const storageKey = 'rubi:accounting:route-tabs:v1';
const emptyTabs: Tab[] = [];
let tabSnapshot = emptyTabs;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function publishTabs(tabs: Tab[]) {
  tabSnapshot = tabs;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(tabs));
  } catch {
    /* Optional session persistence. */
  }
  listeners.forEach((listener) => listener());
}

export function AccountingRouteTabs({
  items,
}: {
  items: readonly { href: string; title: string }[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const allowed = useRouteAccess();
  const tabs = useSyncExternalStore(
    subscribe,
    () => tabSnapshot,
    () => emptyTabs,
  );
  const current = items.find((item) => item.href === pathname);
  const bookId = params.get('bookId');
  useEffect(() => {
    let stored: Tab[] = [];
    try {
      const parsed: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) ?? '[]',
      );
      if (Array.isArray(parsed))
        stored = parsed.filter(
          (tab): tab is Tab =>
            typeof tab?.path === 'string' &&
            typeof tab?.href === 'string' &&
            items.some((item) => item.href === tab.path) &&
            (tab.href === tab.path ||
              tab.href.startsWith(`${tab.path}?bookId=`)) &&
            allowed(tab.path),
        );
    } catch {
      /* Storage can be unavailable in private browser sessions. */
    }
    const next = stored.map((tab) => ({
      ...tab,
      title: items.find((item) => item.href === tab.path)!.title,
    }));
    if (current && allowed(pathname)) {
      const tab = {
        path: pathname,
        title: current.title,
        href: `${pathname}${bookId ? `?bookId=${encodeURIComponent(bookId)}` : ''}`,
      };
      const index = next.findIndex((entry) => entry.path === pathname);
      if (index < 0) next.push(tab);
      else next[index] = tab;
    }
    publishTabs(next);
  }, [pathname, bookId, current, items, allowed]);

  const close = (tab: Tab) => {
    const index = tabs.findIndex((entry) => entry.path === tab.path);
    const next = tabs.filter((entry) => entry.path !== tab.path);
    publishTabs(next);
    if (pathname === tab.path)
      router.push(next[Math.min(index, next.length - 1)]?.href ?? '/finance');
  };
  return (
    <nav
      aria-label="تب‌های باز حسابداری"
      className="flex items-center gap-1 overflow-x-auto border-b border-primary/20 bg-primary/10 p-1"
      dir="rtl"
    >
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={`flex shrink-0 items-center gap-1 rounded-t-md border px-2 ${pathname === tab.path ? 'border-primary/30 border-t-2 border-t-primary bg-surface text-primary' : 'border-transparent bg-primary/10 text-muted-foreground'}`}
        >
          <Link
            href={tab.href}
            aria-current={pathname === tab.path ? 'page' : undefined}
            className="flex items-center gap-2 py-2 text-sm"
            title={tab.title}
          >
            <FileText className="size-4" aria-hidden="true" />
            <span className="max-w-52 truncate">{tab.title}</span>
          </Link>
          <button
            type="button"
            onClick={() => close(tab)}
            aria-label={`بستن تب ${tab.title}`}
            title={`بستن تب ${tab.title}`}
            className="rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      <Link
        href="/finance"
        aria-label="بازکردن بخش دیگر حسابداری"
        title="بازکردن بخش دیگر حسابداری"
        className="shrink-0 rounded p-2 hover:bg-primary/20"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
