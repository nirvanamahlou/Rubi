'use client';

import {
  Bell,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Languages,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getNavigationBreadcrumbs,
  isNavigationItemActive,
  navigationItems,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { faMessages } from '@/messages/fa';
import {
  LegalEntityContextSelector,
  LegalEntityProvider,
  useLegalEntityContext,
} from '@/modules/legal-entities/components/legal-entity-context';
import { legalEntityBrand } from '@/modules/legal-entities/model/context';
import { useTheme } from '../theme-provider';
import { Button } from '../ui/button';
import { Input } from '../ui/form-controls';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/overlays';

function Brand({ compact = false }: { compact?: boolean }) {
  const { context } = useLegalEntityContext();
  const brand = legalEntityBrand(context?.selection);
  return (
    <Link
      className={cn(
        'min-w-0 rounded-2xl bg-white p-1.5 shadow-lg shadow-blue-950/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
        compact ? 'grid size-11 place-items-center p-1' : 'block w-full',
      )}
      data-active-company-brand={context?.selection ?? 'LOADING'}
      href="/dashboard"
    >
      <Image
        alt={brand.alt}
        className={cn('w-full object-contain', compact ? 'h-8' : 'h-[54px]')}
        height={brand.height}
        priority
        src={brand.src}
        width={brand.width}
      />
      {!compact ? (
        <span className="block truncate px-2 pb-1 text-center text-[10px] font-black text-[#25247f]">
          {brand.label}
        </span>
      ) : null}
    </Link>
  );
}

function Navigation({
  compact = false,
  mobile = false,
}: {
  compact?: boolean;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="منوی اصلی"
      className={cn(
        'grid min-w-0 content-start gap-0.5 overflow-x-hidden',
        mobile
          ? 'auto-rows-[44px]'
          : 'h-full grid-rows-[repeat(17,minmax(32px,1fr))]',
      )}
    >
      {navigationItems.map(({ href, icon: Icon, title }) => {
        const active = isNavigationItemActive(href, pathname);
        const link = (
          <Link
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300',
              mobile
                ? 'h-11 text-sm'
                : 'h-full min-h-8 text-[clamp(12px,1.35vh,15px)]',
              mobile
                ? active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : active
                  ? 'bg-cyan-300/20 text-white ring-1 ring-inset ring-cyan-100/30 shadow-md shadow-blue-950/20'
                  : 'text-blue-50/75 hover:bg-white/10 hover:text-white',
              compact && 'justify-center px-0',
            )}
            href={href}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                'shrink-0',
                mobile ? 'size-[18px]' : 'size-[clamp(17px,1.7vh,21px)]',
              )}
            />
            {!compact ? (
              <span className="min-w-0 truncate whitespace-nowrap">
                {title}
              </span>
            ) : (
              <span className="sr-only">{title}</span>
            )}
          </Link>
        );
        if (mobile)
          return (
            <DrawerClose asChild key={href}>
              {link}
            </DrawerClose>
          );
        if (!compact) return <div key={href}>{link}</div>;
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="left">{title}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function SearchDialog() {
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => navigationItems.filter((item) => item.title.includes(query.trim())),
    [query],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('global-search-trigger')?.click();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring lg:max-w-md"
          id="global-search-trigger"
          type="button"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="truncate">{faMessages.common.search}</span>
          <kbd className="ms-auto hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] lg:inline">
            Ctrl K
          </kbd>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{faMessages.common.search}</DialogTitle>
        <DialogDescription>{faMessages.common.searchHint}</DialogDescription>
        <Input
          aria-label={faMessages.common.search}
          autoFocus
          className="mt-4"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={faMessages.common.searchHint}
          value={query}
        />
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {results.map(({ description, href, icon: Icon, title }) => (
            <DialogClose asChild key={href}>
              <Link
                className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={href}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <strong className="block text-sm">{title}</strong>
                  <span className="text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Link>
            </DialogClose>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeaderActions() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  async function signOut() {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (api) {
      await fetch(`${api}/iam/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined);
    }
    router.replace('/login');
    router.refresh();
  }
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={faMessages.shell.language}
            size="icon"
            variant="ghost"
          >
            <Languages aria-hidden="true" className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Check aria-hidden="true" className="size-4 text-primary" />
            {faMessages.shell.persian}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {faMessages.shell.englishSoon}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        aria-label={
          theme === 'light'
            ? faMessages.shell.darkTheme
            : faMessages.shell.lightTheme
        }
        onClick={toggleTheme}
        size="icon"
        variant="ghost"
      >
        {theme === 'light' ? (
          <Moon aria-hidden="true" className="size-5" />
        ) : (
          <Sun aria-hidden="true" className="size-5" />
        )}
      </Button>
      <Button
        aria-label={faMessages.shell.notifications}
        className="relative"
        size="icon"
        variant="ghost"
      >
        <Bell aria-hidden="true" className="size-5" />
        <span className="absolute end-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-surface" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={faMessages.shell.userMenu}
            className="rounded-full"
            size="icon"
            variant="secondary"
          >
            <UserRound aria-hidden="true" className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>{faMessages.shell.profile}</DropdownMenuItem>
          <DropdownMenuItem>{faMessages.shell.preferences}</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => void signOut()}
          >
            <LogOut aria-hidden="true" className="size-4" />
            {faMessages.shell.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const breadcrumbs = getNavigationBreadcrumbs(pathname);
  return (
    <nav
      aria-label="مسیر صفحه"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Link className="hover:text-foreground" href="/dashboard">
        {faMessages.shell.workspace}
      </Link>
      {breadcrumbs.length ? (
        breadcrumbs.map((item, index) => {
          const current = index === breadcrumbs.length - 1;
          return (
            <span className="contents" key={item.href}>
              <span aria-hidden="true">/</span>
              {current ? (
                <span
                  aria-current="page"
                  className="font-semibold text-foreground"
                >
                  {item.title}
                </span>
              ) : (
                <Link className="hover:text-foreground" href={item.href}>
                  {item.title}
                </Link>
              )}
            </span>
          );
        })
      ) : (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-foreground">
            {faMessages.common.unavailable}
          </span>
        </>
      )}
    </nav>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#123f8c_0%,#0e2f6e_55%,#092354_100%)] p-2.5 text-white shadow-2xl shadow-blue-950/20 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-[290px]',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center',
            collapsed ? 'h-14 justify-center' : 'min-h-[82px]',
          )}
        >
          <Brand compact={collapsed} />
        </div>
        <div className="mt-1 min-h-0 flex-1 overflow-hidden">
          <Navigation compact={collapsed} />
        </div>
        <div className="mt-1 grid shrink-0 grid-cols-[1fr_auto] gap-1 border-t border-white/10 pt-1">
          <Link
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg px-2 text-[11px] font-semibold text-blue-100/80 hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
            href="/status"
          >
            <Command aria-hidden="true" className="size-3.5" />
            {!collapsed ? (
              'وضعیت سامانه'
            ) : (
              <span className="sr-only">وضعیت سامانه</span>
            )}
          </Link>
          <Button
            aria-label={
              collapsed
                ? faMessages.shell.expandSidebar
                : faMessages.shell.collapseSidebar
            }
            className="size-8 min-h-8 p-0 text-blue-100 hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed((value) => !value)}
            size="icon"
            variant="ghost"
          >
            {collapsed ? (
              <ChevronsLeft aria-hidden="true" className="size-4" />
            ) : (
              <ChevronsRight aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-surface/90 shadow-sm shadow-blue-900/5 backdrop-blur-xl dark:border-blue-900/50">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  aria-label={faMessages.shell.openNavigation}
                  className="lg:hidden"
                  size="icon"
                  variant="ghost"
                >
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DialogTitle className="sr-only">
                  {faMessages.shell.openNavigation}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  منوی ناوبری اصلی سامانه
                </DialogDescription>
                <div className="mb-6 flex items-center justify-between">
                  <Brand />
                  <DrawerClose asChild>
                    <Button
                      aria-label={faMessages.common.close}
                      size="icon"
                      variant="ghost"
                    >
                      <ChevronsRight aria-hidden="true" className="size-5" />
                    </Button>
                  </DrawerClose>
                </div>
                <Navigation mobile />
              </DrawerContent>
            </Drawer>
            <LegalEntityContextSelector />
            <div className="min-w-0 flex-1">
              <SearchDialog />
            </div>
            <HeaderActions />
          </div>
        </header>
        <div className="px-4 pt-3 sm:px-6 lg:px-7">
          <Breadcrumb />
        </div>
        <main className="px-4 pb-6 pt-3 sm:px-6 lg:px-7" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LegalEntityProvider>
      <AppShellContent>{children}</AppShellContent>
    </LegalEntityProvider>
  );
}
