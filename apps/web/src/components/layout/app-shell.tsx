'use client';

import {
  Bell,
  Building2,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Languages,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { navigationItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { faMessages } from '@/messages/fa';
import { useTheme } from '../theme-provider';
import { Button } from '../ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/form-controls';
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
  return (
    <Link
      className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href="/dashboard"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-md shadow-primary/20">
        ر
      </span>
      {!compact ? (
        <span className="min-w-0">
          <strong className="block truncate text-base font-black">
            {faMessages.brand.name}
          </strong>
          <span className="block truncate text-[11px] text-muted-foreground">
            {faMessages.brand.product}
          </span>
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
    <nav aria-label="منوی اصلی" className="space-y-1">
      {navigationItems.map(({ href, icon: Icon, title }) => {
        const active = pathname === href;
        const link = (
          <Link
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              compact && 'justify-center px-0',
            )}
            href={href}
          >
            <Icon aria-hidden="true" className="size-[18px] shrink-0" />
            {!compact ? (
              <span>{title}</span>
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
          <DropdownMenuItem className="text-destructive">
            {faMessages.shell.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const current = navigationItems.find((item) => item.href === pathname);
  return (
    <nav
      aria-label="مسیر صفحه"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Link className="hover:text-foreground" href="/dashboard">
        {faMessages.shell.workspace}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="font-semibold text-foreground">
        {current?.title ?? faMessages.common.unavailable}
      </span>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-s border-border bg-surface p-3 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-20' : 'w-72',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center',
            collapsed ? 'justify-center' : 'justify-between px-2',
          )}
        >
          <Brand compact={collapsed} />
        </div>
        <div className="mt-3 flex-1 overflow-y-auto pb-4">
          <Navigation compact={collapsed} />
        </div>
        <Link
          className={cn(
            'flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
          href="/status"
        >
          <Command aria-hidden="true" className="size-4" />
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
          className="mt-2"
          onClick={() => setCollapsed((value) => !value)}
          size={collapsed ? 'icon' : 'md'}
          variant="ghost"
        >
          {collapsed ? (
            <ChevronsLeft aria-hidden="true" className="size-5" />
          ) : (
            <>
              <ChevronsRight aria-hidden="true" className="size-5" />
              {faMessages.shell.collapseSidebar}
            </>
          )}
        </Button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
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
            <div className="hidden min-w-40 md:block">
              <Select defaultValue="main">
                <SelectTrigger
                  aria-label={faMessages.shell.branchLabel}
                  className="border-0 bg-muted/70"
                >
                  <Building2
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">
                    {faMessages.shell.branch}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <SearchDialog />
            </div>
            <HeaderActions />
          </div>
        </header>
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <Breadcrumb />
        </div>
        <main className="px-4 pb-10 pt-5 sm:px-6 lg:px-8" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
