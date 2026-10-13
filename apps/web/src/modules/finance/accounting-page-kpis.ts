import type { AccountingBookV1, AccountingSnapshotV1 } from '@nora/contracts';

export interface AccountingPageKpi {
  label: string;
  value: number | null;
}
const cards = (labels: string[], values?: number[]): AccountingPageKpi[] =>
  labels.map((label, index) => ({ label, value: values?.[index] ?? null }));
const records = (
  label: string,
  rows?: { active: boolean; titleEn?: string | null }[],
) =>
  cards(
    [label, 'فعال', 'غیرفعال', 'دارای عنوان انگلیسی'],
    rows && [
      rows.length,
      rows.filter((r) => r.active).length,
      rows.filter((r) => !r.active).length,
      rows.filter((r) => r.titleEn?.trim()).length,
    ],
  );

/** Counts use only the authorized book snapshot; absent data is never zero. */
export function accountingSnapshotKpis(
  route: string,
  snapshot: AccountingSnapshotV1 | undefined,
  books: AccountingBookV1[] | undefined,
): AccountingPageKpi[] {
  const leaf = route.split('/').at(-1);
  if (leaf === 'ledgers')
    return cards(
      ['دفاتر کل', 'دفاتر فعال', 'دفاتر اصلی', 'مجاز به ثبت سند'],
      books && [
        books.length,
        books.filter((b) => b.active).length,
        books.filter((b) => b.isMain).length,
        books.filter((b) => b.allowsPosting).length,
      ],
    );
  if (leaf === 'fiscal-years')
    return cards(
      ['سال‌های مالی', 'دوره‌های مالی', 'دوره‌های باز', 'دوره‌های بسته'],
      snapshot && [
        snapshot.configurations.filter((c) => c.kind === 'fiscal-years').length,
        snapshot.periods.length,
        snapshot.periods.filter((p) => p.status === 'OPEN').length,
        snapshot.periods.filter((p) => p.status === 'CLOSED').length,
      ],
    );
  if (leaf === 'voucher-types' || leaf === 'detail-types')
    return records(
      leaf === 'voucher-types' ? 'انواع سند' : 'انواع تفصیلی',
      snapshot?.configurations.filter((c) => c.kind === leaf),
    );
  if (leaf === 'details')
    return cards(
      [
        'حساب‌های تفصیلی',
        'تفصیلی‌های فعال',
        'تفصیلی‌های غیرفعال',
        'انواع تفصیلی استفاده‌شده',
      ],
      snapshot && [
        snapshot.details.length,
        snapshot.details.filter((d) => d.active).length,
        snapshot.details.filter((d) => !d.active).length,
        new Set(snapshot.details.map((d) => d.typeId)).size,
      ],
    );
  if (leaf === 'account-groups' || leaf === 'detail-groups') {
    const groups =
      leaf === 'account-groups'
        ? snapshot?.accountGroups
        : snapshot?.detailGroups;
    return cards(
      ['گروه‌ها', 'گروه‌های فعال', 'اعضای گروه‌ها', 'گروه‌های بدون عضو'],
      groups && [
        groups.length,
        groups.filter((g) => g.active).length,
        groups.reduce((n, g) => n + g.members.length, 0),
        groups.filter((g) => !g.members.length).length,
      ],
    );
  }
  if (leaf === 'mappings') {
    const rows = snapshot?.subsidiaryMappings;
    return cards(
      [
        'ارتباط‌های معین',
        'معین‌های مبدأ',
        'معین‌های مقصد',
        'ارتباط‌های دارای تفصیلی',
      ],
      rows && [
        rows.length,
        new Set(rows.map((r) => r.sourceAccountId)).size,
        new Set(rows.map((r) => r.targetAccountId)).size,
        rows.filter((r) => r.detail4Id || r.detail5Id || r.detail6Id).length,
      ],
    );
  }
  if (leaf === 'detail-type-converter' || leaf === 'detail-type-converters') {
    const rows = snapshot?.detailConversions;
    return cards(
      ['تعریف‌های تبدیل', 'ثبت‌شده', 'تبدیل‌شده', 'انواع تفصیلی مبدأ'],
      rows && [
        rows.length,
        rows.filter((r) => r.state === 'REGISTERED').length,
        rows.filter((r) => r.state === 'CONVERTED').length,
        new Set(rows.map((r) => r.userTypeId)).size,
      ],
    );
  }
  if (route.includes('templates')) {
    const kind = route.includes('closing')
      ? 'CLOSING'
      : route.includes('revaluation')
        ? 'REVALUATION'
        : 'AUTOMATIC';
    const rows = snapshot?.templates.filter((t) => t.kind === kind);
    return cards(
      [
        'الگوهای تعریف‌شده',
        'الگوهای فعال',
        'ردیف‌های الگو',
        'ردیف‌های قابل استفاده',
      ],
      rows && [
        rows.length,
        rows.filter((t) => t.active).length,
        rows.reduce((n, t) => n + t.lines.length, 0),
        rows.reduce((n, t) => n + t.lines.filter((l) => l.include).length, 0),
      ],
    );
  }
  if (route.includes('/year-end'))
    return cards(
      ['حساب‌های موقت', 'حساب‌های دائمی', 'دوره‌های باز', 'الگوهای بستن فعال'],
      snapshot && [
        snapshot.accounts.filter((a) => !a.permanent).length,
        snapshot.accounts.filter((a) => a.permanent).length,
        snapshot.periods.filter((p) => p.status === 'OPEN').length,
        snapshot.templates.filter((t) => t.kind === 'CLOSING' && t.active)
          .length,
      ],
    );
  if (route.startsWith('receipts-payments/'))
    return records('تعریف‌های ثبت‌شده', undefined);
  if (route.startsWith('tax-accounting/'))
    return cards([
      'رکوردهای مالیاتی',
      'ثبت‌شده',
      'نیازمند تکمیل',
      'ویرایش‌شده',
    ]);
  return cards(
    ['حساب‌های گروه', 'حساب‌های کل', 'حساب‌های معین', 'حساب‌های فعال'],
    snapshot && [
      snapshot.accounts.filter((a) => a.level === 'GROUP').length,
      snapshot.accounts.filter((a) => a.level === 'GENERAL').length,
      snapshot.accounts.filter((a) => a.level === 'SUBSIDIARY').length,
      snapshot.accounts.filter((a) => a.active).length,
    ],
  );
}
