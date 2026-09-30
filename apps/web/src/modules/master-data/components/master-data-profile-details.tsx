import type { MasterDataRecord } from '@nora/contracts';
import type { ReactNode } from 'react';

import { Badge, Card } from '@/components/ui/surfaces';
import { MasterDataLogoImage } from './master-data-logo-image';

export function MasterDataProfileIdentity({
  record,
  eyebrow,
  title,
  subtitle,
}: {
  record?: MasterDataRecord;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-l from-sky-50 via-background to-indigo-50/70 p-4 shadow-sm dark:border-sky-900/60 dark:from-sky-950/35 dark:to-indigo-950/20 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        {record ? <MasterDataLogoImage record={record} /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {record ? (
          <div className="flex flex-wrap items-center gap-2">
            {record.code ? (
              <Badge className="font-mono" dir="ltr">
                {record.code}
              </Badge>
            ) : null}
            <Badge
              className={
                record.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {record.status === 'active' ? 'فعال' : 'غیرفعال'}
            </Badge>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MasterDataDetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Card className="space-y-4 border-border/80 p-4 shadow-none sm:p-5">
      <h3 className="border-b border-border/70 pb-3 text-sm font-bold text-foreground">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </Card>
  );
}

export function MasterDataDetailItem({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}) {
  const empty = value === '' || value === null || value === undefined;
  const displayValue =
    typeof value === 'boolean' ? (value ? 'بله' : 'خیر') : value;
  return (
    <div className="min-w-0 border-b border-border/60 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className="mt-1 break-words text-sm font-semibold text-foreground"
        dir={ltr ? 'ltr' : undefined}
      >
        {empty ? '—' : displayValue}
      </dd>
    </div>
  );
}
