import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FinanceFiscalRequestV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';
const requestStorage = new AsyncLocalStorage<FinanceFiscalRequestV1>();
export const currentFinanceFiscalRequest = () => requestStorage.getStore();
/** For Finance-owned writes, hold the same calendar lock as default/closure commands. */
export async function assertFinanceFiscalWrite(
  tx: Prisma.TransactionClient,
  date: Date | string,
) {
  const fiscal = new FinanceFiscalStorage();
  const scope = fiscal.current();
  if (!scope) return null;
  const selected = fiscal.require()!;
  await tx.$queryRaw`SELECT id FROM accounting_books WHERE id=${selected.bookId}::uuid FOR SHARE`;
  const period = await tx.accountingPeriod.findFirst({
    where: { id: selected.id, bookId: selected.bookId },
    include: { fiscalYear: true },
  });
  if (
    !period ||
    period.version !== selected.version ||
    (scope.mode === 'default' && !period.isDefault)
  )
    throw new ConflictException(
      'سال مالی فعال تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
    );
  fiscal.assertDate(date, true);
  if (!period.fiscalYear.active || period.status !== 'OPEN')
    throw new ConflictException(
      'ثبت عملیات در سال مالی بسته یا بایگانی‌شده مجاز نیست.',
    );
  return period;
}
const dayFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayStarts = new Map<number, number>();
const dayMs = 86_400_000;
function localDayOrdinal(stamp: number) {
  const parts = dayFormatter.formatToParts(new Date(stamp));
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)!.value);
  const day = new Date(0);
  day.setUTCFullYear(part('year'), part('month') - 1, part('day'));
  day.setUTCHours(0, 0, 0, 0);
  return day.getTime();
}
function businessDayStart(ordinal: number) {
  const cached = dayStarts.get(ordinal);
  if (cached !== undefined) return cached;
  // Find the first instant of the business day, including historical DST midnight gaps.
  let low = ordinal - 2 * dayMs,
    high = ordinal + 2 * dayMs;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDayOrdinal(middle) < ordinal) low = middle + 1;
    else high = middle;
  }
  if (dayStarts.size >= 1000) dayStarts.clear();
  dayStarts.set(ordinal, low);
  return low;
}
export function financeFiscalUtcRange(from: string, to: string) {
  if (
    ![from, to].every(
      (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && financeFiscalDay(day) === day,
    )
  )
    throw new UnprocessableEntityException('بازه تاریخ معتبر نیست.');
  return {
    gte: new Date(businessDayStart(Date.parse(from + 'T00:00:00.000Z'))),
    lt: new Date(businessDayStart(Date.parse(to + 'T00:00:00.000Z') + dayMs)),
  };
}

/** Date-only accounting dates are Gregorian; timestamps use the Tehran business day. */
export function financeFiscalDay(value: string | Date): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = dayFormatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** HTTP scope only: internal source-owner calls do not acquire an unrelated UI year. */
@Injectable()
export class FinanceFiscalStorage {
  run<T>(scope: FinanceFiscalRequestV1, next: () => T): T {
    return requestStorage.run(scope, next);
  }
  current() {
    return currentFinanceFiscalRequest();
  }
  range(bookId?: string) {
    const period = this.require(bookId);
    return period
      ? financeFiscalUtcRange(period.startDate, period.endDate)
      : undefined;
  }

  require(bookId?: string) {
    const scope = this.current();
    if (!scope) return null;
    if (bookId && scope.bookId !== bookId)
      throw new NotFoundException('دفتر حسابداری در شرکت فعال در دسترس نیست.');
    if (!scope.period)
      throw new ConflictException({
        code: 'FINANCE_FISCAL_YEAR_UNDEFINED',
        message:
          'سال مالی تعریف نشده است؛ ابتدا سال مالی پیش‌فرض شرکت را انتخاب کنید.',
      });
    return scope.period;
  }

  query(bookId: string, query: Record<string, string>) {
    const period = this.require(bookId);
    if (!period) return query;
    this.assertPeriod(bookId, query.periodId);
    for (const date of [query.from, query.to])
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) || financeFiscalDay(date) !== date)
      )
        throw new UnprocessableEntityException('بازه تاریخ معتبر نیست.');
    const from = query.from
      ? query.from > period.startDate
        ? query.from
        : period.startDate
      : period.startDate;
    const to = query.to
      ? query.to < period.endDate
        ? query.to
        : period.endDate
      : period.endDate;
    if (from > to)
      throw new UnprocessableEntityException(
        'بازهٔ انتخاب‌شده خارج از سال مالی فعال است.',
      );
    return { ...query, periodId: period.id, from, to };
  }

  assertPeriod(bookId: string, periodId?: unknown) {
    const period = this.require(bookId);
    if (period && periodId && periodId !== period.id)
      throw new ConflictException({
        code: 'FINANCE_FISCAL_CONTEXT_CHANGED',
        message:
          'سال مالی عملیات با سال مالی فعال یکسان نیست؛ صفحه را دوباره بارگذاری کنید.',
      });
    return period;
  }

  assertDate(date: string | Date, writable = false) {
    const period = this.require();
    if (!period) return;
    const value = financeFiscalDay(date);
    if (!value || value < period.startDate || value > period.endDate)
      throw new UnprocessableEntityException(
        'تاریخ عملیات باید در بازهٔ سال مالی فعال باشد.',
      );
    if (writable && (period.status !== 'OPEN' || !period.yearActive))
      throw new UnprocessableEntityException(
        'ثبت عملیات در سال مالی بسته یا بایگانی‌شده مجاز نیست.',
      );
  }

  includes(date: string | Date | null | undefined) {
    const period = this.require();
    if (!period) return true;
    if (!date) return false;
    const value = financeFiscalDay(date);
    return !!value && value >= period.startDate && value <= period.endDate;
  }
}
