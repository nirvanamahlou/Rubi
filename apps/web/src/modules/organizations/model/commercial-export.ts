import {
  B2B_AGREEMENT_TYPES,
  type B2bAgreementCaseV1,
  type B2bAgencyAgreedRateV1,
  type B2bAgreedRateKind,
} from '@rubi/contracts';
import { reviewLabels, serviceLabels } from './agreement-terms';
import {
  inDossierDateRange,
  type DossierDateRange,
} from './dossier-date-range';

export type AgreementExportView =
  'agreements' | 'credit' | 'guarantees' | 'temporary';
export interface CommercialReport {
  title: string;
  context: string[];
  sections: { title: string; columns: string[]; rows: string[][] }[];
}
export function agreementMatchesRange(
  record: B2bAgreementCaseV1,
  view: AgreementExportView,
  range: DossierDateRange,
) {
  const revision = record.revisions[0];
  const dates =
    view === 'guarantees'
      ? (revision?.guarantees.map((g) => g.receivedAt) ?? [])
      : view === 'credit' || view === 'temporary'
        ? (revision?.creditPolicies.map((p) => p.effectiveFrom) ?? [])
        : [revision?.startsAt ?? record.startsAt];
  return (
    (!range.from && !range.to) ||
    dates.some((date) => inDossierDateRange(date, range))
  );
}
export async function collectAgreementExport(
  readPage: (
    page: number,
  ) => Promise<{ data: B2bAgreementCaseV1[]; meta: { totalPages: number } }>,
  isCurrent: () => boolean,
) {
  const records = new Map<string, B2bAgreementCaseV1>();
  for (let page = 1, pages = 1; page <= pages; page++) {
    if (!isCurrent()) throw new Error('خروجی به دلیل تغییر فیلتر لغو شد.');
    const result = await readPage(page);
    if (!isCurrent()) throw new Error('خروجی به دلیل تغییر فیلتر لغو شد.');
    pages = result.meta.totalPages;
    if (pages > 500)
      throw new Error('تعداد قراردادها زیاد است؛ خروجی را محدود کنید.');
    result.data.forEach((record) => records.set(record.id, record));
  }
  return [...records.values()];
}
export function agreementReport(
  records: readonly B2bAgreementCaseV1[],
  view: AgreementExportView,
  range: DossierDateRange,
  context: string[],
): CommercialReport {
  const title = {
    agreements: 'قراردادهای همکاری',
    credit: 'سیاست‌های اعتبار',
    guarantees: 'تضمین‌های قرارداد',
    temporary: 'افزایش موقت اعتبار',
  }[view];
  const selected = records.filter((record) =>
    agreementMatchesRange(record, view, range),
  );
  const base = ['کد قرارداد', 'عنوان', 'نسخه', 'وضعیت بررسی', 'نسخه فعال'];
  const contracts: CommercialReport['sections'][number] = {
    title,
    columns: [
      ...base,
      'نوع قرارداد',
      'شروع',
      'پایان',
      'ارزها',
      'خدمات',
      'روش پرداخت',
      'شیوه پرداخت',
      'دوره تسویه',
      'مهلت تسویه (روز)',
      'روز بستن حساب',
      'مهلت پاسخ (ساعت)',
      'شرایط لغو',
      'شرایط استرداد',
      'یادداشت',
      'دلیل نسخه',
      'سند',
      'نتیجه بررسی',
    ],
    rows: [],
  };
  const credit: CommercialReport['sections'][number] = {
    title: view === 'temporary' ? title : 'سیاست‌های اعتبار',
    columns: [
      ...base,
      'ارز',
      'سقف اعتبار',
      'مهلت بدهی (روز)',
      'بدهی سررسیدگذشته',
      'شروع',
      'پایان',
    ],
    rows: [],
  };
  const guarantees: CommercialReport['sections'][number] = {
    title: 'تضمین‌ها',
    columns: [
      ...base,
      'نوع',
      'شماره مرجع',
      'مبلغ',
      'ارز',
      'صادرکننده',
      'تاریخ دریافت',
      'انقضا',
      'وضعیت تضمین',
      'سند',
    ],
    rows: [],
  };
  for (const record of selected) {
    const r = record.revisions[0];
    if (!r) continue;
    const common = [
      record.code,
      r.title,
      String(r.number),
      reviewLabels[r.status],
      record.activeRevisionId === r.id ? 'بله' : 'خیر',
    ];
    contracts.rows.push([
      ...common,
      B2B_AGREEMENT_TYPES[r.agreementType],
      r.startsAt,
      r.endsAt ?? '',
      r.currencyCodes.join('، '),
      r.services.map((s) => serviceLabels[s]).join('، '),
      r.paymentMethodName ?? '',
      { PREPAID: 'پیش‌پرداخت', CREDIT: 'اعتباری', MIXED: 'ترکیبی' }[
        r.paymentMethod
      ],
      {
        PER_ORDER: 'هر سفارش',
        WEEKLY: 'هفتگی',
        MONTHLY: 'ماهانه',
        CUSTOM: 'روز مشخص',
      }[r.settlementCycle],
      String(r.settlementDays),
      String(r.cutoffDay ?? ''),
      String(r.slaHours ?? ''),
      r.cancellationTerms,
      r.refundTerms,
      r.notes,
      r.changeReason,
      r.documentVersionId ? 'پیوست دارد' : 'بدون پیوست',
      r.reviewReason ?? '',
    ]);
    for (const p of r.creditPolicies) {
      if (view !== 'agreements' && !inDossierDateRange(p.effectiveFrom, range))
        continue;
      credit.rows.push([
        ...common,
        p.currencyCode,
        p.creditLimit,
        String(p.dueDays),
        p.overdueAction === 'BLOCK' ? 'توقف' : 'هشدار',
        p.effectiveFrom,
        p.expiresAt ?? '',
      ]);
    }
    for (const g of r.guarantees) {
      if (view === 'guarantees' && !inDossierDateRange(g.receivedAt, range))
        continue;
      guarantees.rows.push([
        ...common,
        {
          BANK_GUARANTEE: 'ضمانت‌نامه بانکی',
          CHEQUE: 'چک تضمین',
          DEPOSIT_REQUIREMENT: 'شرط سپرده',
          OTHER: 'سایر',
        }[g.kind],
        g.reference,
        g.amount,
        g.currencyCode,
        g.issuer,
        g.receivedAt,
        g.expiresAt ?? '',
        g.status === 'RECEIVED' ? 'دریافت‌شده' : 'موردنیاز',
        g.documentVersionId ? 'پیوست دارد' : 'بدون پیوست',
      ]);
    }
  }
  return {
    title,
    context: [
      ...context,
      'آخرین نسخه ثبت‌شده هر قرارداد؛ تأیید نسخه به معنی فعال بودن آن در تاریخ گزارش نیست.',
      `از تاریخ: ${range.from || 'بدون محدودیت'} — تا تاریخ: ${range.to || 'بدون محدودیت'}`,
    ],
    sections:
      view === 'agreements'
        ? [contracts, credit, guarantees]
        : view === 'guarantees'
          ? [guarantees]
          : [credit],
  };
}
export function ratesReport(
  rows: readonly B2bAgencyAgreedRateV1[],
  kind: B2bAgreedRateKind,
  range: DossierDateRange,
  context: string[],
): CommercialReport {
  const title = {
    FIXED_AMOUNT: 'نرخ توافقی',
    DISCOUNT_PERCENT: 'تخفیف',
    COMMISSION_PERCENT: 'پورسانت',
  }[kind];
  return {
    title,
    context: [
      ...context,
      `از تاریخ: ${range.from || 'بدون محدودیت'} — تا تاریخ: ${range.to || 'بدون محدودیت'}`,
    ],
    sections: [
      {
        title,
        columns: [
          'کد',
          'عنوان',
          'خدمت',
          'مبلغ / درصد',
          'واحد',
          'شروع اعتبار',
          'پایان اعتبار',
          'وضعیت',
        ],
        rows: rows
          .filter(
            (r) => r.kind === kind && inDossierDateRange(r.validFrom, range),
          )
          .map((r) => [
            r.code,
            r.title,
            serviceLabels[r.serviceReference as keyof typeof serviceLabels] ??
              r.serviceReference,
            r.value,
            r.currencyCode ?? 'درصد',
            r.validFrom,
            r.validTo ?? '',
            r.isActive ? 'فعال' : 'پیش‌نویس / غیرفعال',
          ]),
      },
    ],
  };
}
export function commercialWorkbookRows(report: CommercialReport): string[][] {
  return [
    [report.title],
    ...report.context.map((text) => [text]),
    ...report.sections.flatMap((section) => [
      [],
      [section.title],
      section.columns,
      ...section.rows,
    ]),
  ];
}
