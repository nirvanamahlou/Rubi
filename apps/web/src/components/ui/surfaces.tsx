import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-muted', className)}
      {...props}
    />
  );
}

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  tone?: 'info' | 'warning' | 'error';
}

export function Alert({
  children,
  className,
  description,
  title,
  tone = 'info',
  ...props
}: AlertProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5'
          : tone === 'warning'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-primary/20 bg-primary/5',
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
      {...props}
    >
      <p className="font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

interface StateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

export function EmptyState({
  action,
  description,
  icon: Icon = Inbox,
  title,
}: StateProps) {
  return (
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
      <div>
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 font-bold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({ action, description, title }: StateProps) {
  return (
    <EmptyState
      action={action}
      description={description}
      icon={AlertCircle}
      title={title}
    />
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataTableShell({
  columns,
  empty,
}: {
  columns: readonly string[];
  empty: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className="hidden grid-cols-[repeat(var(--column-count),minmax(0,1fr))] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-xs font-bold text-muted-foreground md:grid"
        style={{ '--column-count': columns.length } as React.CSSProperties}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="p-4">{empty}</div>
    </div>
  );
}

export function PaginationShell({
  currentPage = 1,
  totalLabel = '۰ مورد',
}: {
  currentPage?: number;
  totalLabel?: string;
}) {
  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex items-center justify-between text-sm text-muted-foreground"
    >
      <span>{totalLabel}</span>
      <span>صفحه {currentPage.toLocaleString('fa-IR')}</span>
    </nav>
  );
}
