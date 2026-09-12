import { BadRequestException } from '@nestjs/common';
import type {
  OrganizationActivityEvent,
  OrganizationActivityQuery,
  OrganizationActivitySource,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

export interface ActivityWindow {
  from?: Date | undefined;
  to?: Date | undefined;
  asOf: Date;
  before?: { time: string; id: string } | undefined;
  outcome?: string | undefined;
  category?: string | undefined;
}
export interface ActivityRow {
  id: string;
  action: string;
  outcome: string;
  entityId: string | null;
  entityType: string;
  actorUserId: string;
  occurredAt: Date;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  category: OrganizationActivityEvent['category'];
}
const validDate = (s: string) => Number.isFinite(new Date(s).getTime());
export function activityWindow(
  query: OrganizationActivityQuery,
): ActivityWindow {
  for (const [key, value] of Object.entries(query)) {
    if (
      ![
        'from',
        'to',
        'source',
        'category',
        'outcome',
        'cursor',
        'asOf',
      ].includes(key) ||
      typeof value !== 'string' ||
      value.length > 400
    )
      throw new BadRequestException('فیلتر گزارش نامعتبر است.');
  }
  const day = (s?: string, end = false) => {
    if (!s) return undefined;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      !validDate(s) ||
      new Date(s).toISOString().slice(0, 10) !== s
    )
      throw new BadRequestException('تاریخ گزارش نامعتبر است.');
    // Rubi date filters are calendar days in Asia/Tehran (UTC+03:30).
    return new Date(`${s}T${end ? '23:59:59.999' : '00:00:00.000'}+03:30`);
  };
  const from = day(query.from),
    to = day(query.to, true);
  if (from && to && from > to)
    throw new BadRequestException('تاریخ پایان قبل از شروع است.');
  if (
    query.source &&
    !['B2B', 'MASTER_DATA', 'DOCUMENTS'].includes(query.source)
  )
    throw new BadRequestException('منبع نامعتبر است.');
  if (
    query.category &&
    !['PROFILE', 'ACCESS', 'CONTRACT', 'CREDIT', 'RATE', 'DOCUMENT'].includes(
      query.category,
    )
  )
    throw new BadRequestException('بخش نامعتبر است.');
  if (
    query.outcome &&
    !['SUCCESS', 'FAILURE', 'DENIED'].includes(query.outcome)
  )
    throw new BadRequestException('نتیجه نامعتبر است.');
  if (
    query.asOf &&
    (!validDate(query.asOf) ||
      new Date(query.asOf).getTime() > Date.now() + 1000)
  )
    throw new BadRequestException('زمان گزارش نامعتبر است.');
  const asOf = query.asOf ? new Date(query.asOf) : new Date();
  let before: ActivityWindow['before'];
  if (query.cursor) {
    try {
      if (!query.asOf || query.cursor.length > 400) throw new Error();
      const parsed = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString(),
      ) as { time: string; id: string };
      if (
        !validDate(parsed.time) ||
        !/^(B2B|MASTER_DATA|DOCUMENTS):[0-9a-f-]{36}$/.test(parsed.id)
      )
        throw new Error();
      before = { time: new Date(parsed.time).toISOString(), id: parsed.id };
    } catch {
      throw new BadRequestException('نشانگر صفحه نامعتبر است.');
    }
  }
  return {
    from,
    to,
    asOf,
    before,
    outcome: query.outcome,
    category: query.category,
  };
}
/** Input is a normalized owner query aliased as e; all values remain bound parameters. */
export function activityPredicate(
  w: ActivityWindow,
  source: OrganizationActivitySource,
) {
  return Prisma.sql`e."occurredAt" <= ${w.asOf}
    ${w.from ? Prisma.sql`AND e."occurredAt" >= ${w.from}` : Prisma.empty}
    ${w.to ? Prisma.sql`AND e."occurredAt" <= ${w.to}` : Prisma.empty}
    ${w.outcome ? Prisma.sql`AND e.outcome::text = ${w.outcome}` : Prisma.empty}
    ${w.category ? Prisma.sql`AND e.category = ${w.category}` : Prisma.empty}
    ${w.before ? Prisma.sql`AND (e."occurredAt", (${source} || ':' || e.id::text) COLLATE "C") < (${new Date(w.before.time)}, ${w.before.id} COLLATE "C")` : Prisma.empty}`;
}
const fieldLabels: Record<string, string> = {
  name: 'نام سازمان',
  nationalId: 'شناسه ملی',
  legalType: 'نوع شخصیت',
  roles: 'نقش‌ها',
  label: 'عنوان شعبه',
  addressLine: 'نشانی',
  cityId: 'شهر',
  countryId: 'کشور',
  isPrimary: 'شعبه اصلی',
  fullName: 'نام نماینده',
  jobTitle: 'سمت',
  emailEncrypted: 'ایمیل',
  phoneEncrypted: 'تلفن',
  email: 'ایمیل',
  phone: 'تلفن',
  accountManagerUserId: 'مدیر حساب',
  status: 'وضعیت',
  isActive: 'فعال بودن',
  displayOrder: 'ترتیب نمایش',
  role: 'نقش همکاری',
  roleName: 'نقش کاربر',
  sections: 'بخش‌های مجاز',
  userId: 'کاربر',
  title: 'عنوان',
  agreementType: 'نوع قرارداد',
  startsAt: 'تاریخ شروع',
  endsAt: 'تاریخ پایان',
  paymentMethodId: 'روش پرداخت',
  paymentTerms: 'شرایط پرداخت',
  guarantees: 'تضمین‌ها',
  creditPolicies: 'سقف‌های اعتبار',
  creditLimit: 'سقف اعتبار',
  currencyCode: 'ارز',
  effectiveFrom: 'شروع اعتبار',
  expiresAt: 'انقضا',
  dueDays: 'مهلت پرداخت',
  overdueAction: 'اقدام بدهی معوق',
  documentReference: 'سند',
  documentVersionId: 'نسخه سند',
  value: 'مقدار نرخ',
  kind: 'نوع نرخ',
  serviceReference: 'خدمت',
  validFrom: 'تاریخ اعتبار',
  validTo: 'پایان اعتبار',
  contactId: 'نماینده',
  documentTypes: 'دامنه امضا',
  authorityLimit: 'حد اختیار',
  notes: 'توضیحات',
  reason: 'دلیل تغییر',
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const obj = value as Record<string, unknown>;
  return obj.record && typeof obj.record === 'object'
    ? record(obj.record)
    : obj;
}
export function activityEvent(
  row: ActivityRow,
  source: OrganizationActivitySource,
): OrganizationActivityEvent {
  const before = record(row.beforeSnapshot),
    after = record(row.afterSnapshot);
  return {
    id: `${source}:${row.id}`,
    source,
    category: row.category,
    action: row.action,
    outcome: row.outcome,
    entityId: row.entityId,
    entityType: row.entityType,
    actorUserId: row.actorUserId,
    actorName: 'کاربر ثبت‌شده',
    occurredAt: row.occurredAt.toISOString(),
    // Field names only: never publish contact values, notes, credentials, proofs or raw snapshots.
    changedFields: [
      ...new Set(
        Object.keys(fieldLabels)
          .filter(
            (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
          )
          .map((key) => fieldLabels[key]!),
      ),
    ],
  };
}
