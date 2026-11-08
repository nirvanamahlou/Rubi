import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

/** Internal producer/consumer contract. Only owning domains read operational tables. */
export interface ReportSourceActor {
  userId: string;
  permissions: readonly string[];
  branchIds: readonly string[];
}
export interface ReportSourceQuery {
  legalEntityId?: string;
  filters: Readonly<Record<string, string | readonly string[]>>;
}
export interface ReportSourceColumn {
  key: string;
  label: string;
  kind: 'TEXT' | 'NUMBER' | 'MONEY';
}
export interface ReportSourceRow {
  /** Owning producer declares identity without currency; never inferred from labels. */
  currencyGroupId?: string;
  distinctCounts?: Readonly<Record<string, readonly string[]>>;
  chartAmounts?: readonly { currencyCode: string; amount: string }[];
  id: string;
  at: Date;
  updatedAt: Date;
  values: Readonly<Record<string, string | number>>;
}
export interface ReportSource {
  projection: `${string}.reporting.${string}.v1`;
  columns: readonly ReportSourceColumn[];
  chartMeasure: string;
  rows: readonly ReportSourceRow[];
  warnings: readonly string[];
}

export function sourceFilters(
  query: ReportSourceQuery,
  allowed: readonly string[],
) {
  if (
    query.legalEntityId ||
    Object.entries(query.filters).some(
      ([key, value]) =>
        (Array.isArray(value) ? value.length > 0 : !!value) &&
        !allowed.includes(key),
    )
  )
    throw new BadRequestException(
      'فیلتر انتخاب‌شده در منبع این گزارش پشتیبانی نمی‌شود.',
    );
  const scalar = (key: string) => {
    const value = query.filters[key];
    if (value !== undefined && typeof value !== 'string')
      throw new BadRequestException(
        'فیلتر این گزارش باید یک مقدار داشته باشد.',
      );
    return typeof value === 'string' && value ? value : undefined;
  };
  const from = scalar('fromUtc'),
    to = scalar('toUtc');
  return {
    scalar,
    range: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lt: new Date(to) } : {}),
    },
  };
}
export function sourceBranches(actor: ReportSourceActor, requested?: string) {
  if (!actor.branchIds.length)
    throw new ForbiddenException('شعبه مجاز گزارش مشخص نیست.');
  return requested
    ? actor.branchIds.filter((id) => id === requested)
    : [...actor.branchIds];
}
export function requireSourcePermission(
  actor: ReportSourceActor,
  permissions: readonly string[],
) {
  if (!permissions.some((p) => actor.permissions.includes(p)))
    throw new ForbiddenException('مجوز مشاهده منبع این گزارش وجود ندارد.');
}
export function boundedSource<T>(rows: T[]): T[] {
  if (rows.length > 10000)
    throw new ConflictException(
      'تعداد رکوردهای منبع بیش از حد مجاز است؛ بازه گزارش را محدود کنید.',
    );
  return rows;
}
export function reportColumn(
  key: string,
  label: string,
  kind: ReportSourceColumn['kind'] = 'TEXT',
): ReportSourceColumn {
  return { key, label, kind };
}
