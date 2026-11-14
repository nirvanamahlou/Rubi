import type {
  SalesContractDetail,
  SalesContractSummary,
  SalesContractListQuery,
} from '@nora/contracts';
import { ledgerEvidence } from './contract-ledger';
import { itineraryEvidence, currentOfferEvidence } from './contract-itinerary';
import { salesApi } from '@/modules/sales/api/client';
import { paymentReceiptsApi } from '@/modules/sales/api/payment-receipts';
import { normalizeContractQuestion } from './contract-guides';
const date = (value: string) =>
  new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });
export function actionReason(row: SalesContractSummary) {
  if (['COMPLETED', 'CANCELLED'].includes(row.status)) return '';
  if (
    row.reservationStatus === 'REJECTED' ||
    row.reservationStatus === 'NEEDS_REVIEW'
  )
    return 'فروش و رزرواسیون: بررسی علت درخواست اصلاح';
  if (row.reservationContractChanged) return 'رزرواسیون: تطبیق اصلاحات قرارداد';
  if (row.reservationStatus === 'NOT_SENT') return 'فروش: بررسی تکمیل و ارسال';
  if (row.reservationStatus === 'PARTIALLY_FULFILLED')
    return 'رزرواسیون: پیگیری خدمات باقی‌مانده';
  if (row.settlementStatus === 'OVERPAID') return 'مالی: بررسی اضافه‌پرداخت';
  if (row.reservationStatus === 'QUEUED')
    return 'رزرواسیون: بررسی درخواست در صف';
  return '';
}
export function portfolioKind(message: string) {
  const q = normalizeContractQuestion(message);
  if (!/قرارداد/.test(q) || /قرارداد\s*(?:شماره\s*)?[a-z0-9]/i.test(q)) return;
  if (/قراردادها|قرارداد های|کدام قرارداد|چه قرارداد/.test(q)) {
    if (/مغایرت|رسید|مالی/.test(q)) return 'finance';
    if (/مدارک|خدمات|خدمت/.test(q)) return 'services';
    if (/تاریخچه|تغییرات/.test(q)) return 'history';
  }
  if (
    /متوقف|راکد|معطل/.test(q) &&
    /قراردادها|قرارداد های|کدام قرارداد|چه قرارداد/.test(q)
  )
    return 'stalled';
  if (
    /(?:^|\s)(?:من|خودم)(?:\s|$)|کارهایم/.test(q) &&
    /اقدام|پیگیری|کارهای/.test(q)
  )
    return 'mine';
}
export function readPortfolioScope(): SalesContractListQuery {
  if (typeof document === 'undefined') return {};
  try {
    const raw = JSON.parse(
      document.querySelector<HTMLElement>('[data-nora-sales-filters]')?.dataset
        .noraSalesFilters || '{}',
    );
    const keys = [
      'branchId',
      'ownerUserId',
      'status',
      'settlementStatus',
      'reservationStatus',
      'currencyCode',
      'travelFrom',
      'travelTo',
      'createdFrom',
      'createdTo',
      'customerType',
      'agencyCustomerId',
      'supplyType',
      'serviceKind',
      'destinationId',
      'originId',
      'search',
    ];
    return Object.fromEntries(
      keys
        .filter((key) => typeof raw?.[key] === 'string' && raw[key])
        .map((key) => [key, raw[key]]),
    );
  } catch {
    return {};
  }
}
function scopeHeader(filters: SalesContractListQuery) {
  return [
    'محدوده: شرکت و شعب مجاز حساب فعلی؛ شعبه: ' +
      (filters.branchId || 'همه مجاز') +
      '؛ فروشنده: ' +
      (filters.ownerUserId || 'همه مجاز') +
      '؛ وضعیت: ' +
      (filters.status || 'همه') +
      '؛ ارز: ' +
      (filters.currencyCode || 'همه'),
    'بازه ثبت: ' +
      (filters.createdFrom || 'بدون حد آغاز') +
      ' تا ' +
      (filters.createdTo || 'بدون حد پایان') +
      '؛ بازه سفر: ' +
      (filters.travelFrom || 'بدون حد آغاز') +
      ' تا ' +
      (filters.travelTo || 'بدون حد پایان'),
  ];
}
export async function portfolioReport(
  message: string,
  userId: string,
  link?: (row: SalesContractSummary) => void,
  signal?: AbortSignal,
) {
  const kind = portfolioKind(message);
  const q = normalizeContractQuestion(message);
  const page = Math.max(1, Number(q.match(/صفحه\s+(\d{1,5})/)?.[1] ?? 1));
  const scope = readPortfolioScope();
  const filters = {
    ...scope,
    ...(kind === 'stalled' && /(?:^|\s)(?:من|خودم)(?:\s|$)/.test(q)
      ? { ownerUserId: userId }
      : {}),
  };
  if (kind === 'finance' || kind === 'services' || kind === 'history') {
    // Page Sales first, then read evidence for this page only. Each source enforces its own scope.
    const list = await salesApi.list({
      ...filters,
      page,
      pageSize: 10,
      sortBy: 'createdAt',
      sortDirection: 'asc',
    });
    const lines = [
      ...scopeHeader(filters),
      'صفحه ' +
        page +
        '؛ تعداد قراردادهای محدوده: ' +
        list.meta.total +
        '؛ زمان خواندن (تهران): ' +
        date(new Date().toISOString()),
    ];
    for (const row of list.data) {
      signal?.throwIfAborted();
      try {
        const detail = (await salesApi.detail(row.id)).data;
        link?.(row);
        lines.push(
          row.contractNumber,
          await recordReport(
            kind === 'finance'
              ? 'مغایرت مالی و رسید'
              : kind === 'services'
                ? 'خدمات و مدارک'
                : 'تاریخچه و تغییرات',
            detail,
            signal,
          ),
        );
      } catch (error) {
        signal?.throwIfAborted();
        lines.push(row.contractNumber, reportError(error));
      }
    }
    if (!list.data.length) lines.push('در این صفحه قراردادی یافت نشد.');
    return lines.join('\n');
  }
  const seen = new Set<string>();
  const hits: { row: SalesContractSummary; reason: string }[] = [];
  for (let sourcePage = 1; ; sourcePage++) {
    signal?.throwIfAborted();
    const list = await salesApi.list({
      ...filters,
      page: sourcePage,
      pageSize: 100,
      sortBy: 'createdAt',
      sortDirection: 'asc',
    });
    if (sourcePage !== list.meta.page) throw Error('pagination');
    for (const row of list.data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const reason = actionReason(row);
      if (!reason) continue;
      // An employee who sold a contract is not necessarily its finance or reservation approver.
      if (
        kind === 'mine' &&
        !(
          row.assignedUserId === userId ||
          (!row.assignedUserId &&
            row.ownerUserId === userId &&
            reason.startsWith('فروش'))
        )
      )
        continue;
      hits.push({ row, reason });
    }
    if (sourcePage * list.meta.pageSize >= list.meta.total) break;
    if (!list.data.length) throw Error('incomplete page');
  }
  const lines = [
    ...scopeHeader(filters),
    'صفحه ' +
      page +
      ' از ' +
      Math.max(1, Math.ceil(hits.length / 10)) +
      '؛ تعداد موارد: ' +
      hits.length +
      '؛ زمان خواندن (تهران): ' +
      date(new Date().toISOString()),
  ];
  for (const { row, reason } of hits.slice((page - 1) * 10, page * 10)) {
    signal?.throwIfAborted();
    link?.(row);
    let time = '';
    if (kind === 'stalled')
      try {
        const events = (await salesApi.statusHistory(row.id)).data;
        const event = events
          .filter((e) => e.toStatus === row.status)
          .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt))[0];
        const days = event
          ? Math.floor((Date.now() - Date.parse(event.changedAt)) / 86400000)
          : NaN;
        time =
          Number.isFinite(days) && days >= 0
            ? days +
              ' روز از ورود به وضعیت قرارداد؛ زمان توقف خدمت ممکن است متفاوت باشد.'
            : 'زمان ورود به وضعیت ثبت نشده';
      } catch (error) {
        time = reportError(error);
      }
    if (kind === 'stalled' && row.reservationStatus === 'QUEUED') {
      try {
        const { data: intake } = await salesApi.documentReadiness(row.id);
        const days = Math.floor(
          (Date.now() - Date.parse(intake.receivedAt)) / 86400000,
        );
        if (Number.isFinite(days) && days >= 0)
          time += ' — ' + days + ' روز از دریافت درخواست در رزرواسیون';
      } catch (error) {
        time += ' — ' + reportError(error);
      }
    }
    lines.push([row.contractNumber, reason, time].filter(Boolean).join(' — '));
  }
  if (!hits.slice((page - 1) * 10, page * 10).length)
    lines.push('در این صفحه مورد نیازمند اقدام یافت نشد.');
  return lines.join('\n');
}
function reportError(error: unknown) {
  const status =
    typeof error === 'object' && error && 'status' in error
      ? error.status
      : undefined;
  return status === 403 || status === 401
    ? 'دسترسی به جزئیات این بخش برقرار نیست.'
    : status === 404
      ? 'منبع این بخش در محدوده مجاز پیدا نشد.'
      : 'دریافت جزئیات این بخش ناموفق بود.';
}
function changedFields(before: unknown, after: unknown) {
  if (
    !before ||
    !after ||
    typeof before !== 'object' ||
    typeof after !== 'object'
  )
    return [];
  const labels: Record<string, string> = {
    totals: 'مبلغ',
    status: 'وضعیت',
    reservationStatus: 'وضعیت رزرواسیون',
    payments: 'پرداخت‌ها',
    passengers: 'مسافران',
    departureDate: 'تاریخ رفت',
    services: 'خدمات',
    hotelSelection: 'اقامت',
    ticketSelections: 'پروازها',
    priceComponents: 'قیمت',
  };
  return Object.entries(labels)
    .filter(
      ([key]) =>
        Object.hasOwn(before, key) &&
        Object.hasOwn(after, key) &&
        JSON.stringify((before as Record<string, unknown>)[key]) !==
          JSON.stringify((after as Record<string, unknown>)[key]),
    )
    .map(([, v]) => v + ' تغییر کرد');
}
const reportTopics = {
  summary: /خلاصه|پرونده کامل/,
  history: /تاریخچه|تغییرات|توقف|متوقف/,
  audit: /تغییرات|ممیزی/,
  payment: /رسید|مغایرت|وصول|سررسید|مالی|مانده|تخفیف|کمیسیون|پرداخت/,
  itinerary: /تخصیص|مسافر|مسیر|اقامت|رده سنی|تاریخ سفر/,
  offer: /ظرفیت|نرخ فعلی|قیمت فعلی|اعتبار قیمت/,
  service: /مدرک|مدارک|خدمت|خدمات|ناقص/,
};
export function isContractReportQuestion(message: string) {
  const question = normalizeContractQuestion(message);
  return Object.values(reportTopics).some((pattern) => pattern.test(question));
}

export async function recordReport(
  message: string,
  data: SalesContractDetail,
  signal: AbortSignal = new AbortController().signal,
) {
  const q = normalizeContractQuestion(message);
  const lines: string[] = [];
  const summary = /خلاصه|پرونده کامل/.test(q);
  if (reportTopics.itinerary.test(q)) lines.push(...itineraryEvidence(data));
  if (reportTopics.offer.test(q)) {
    try {
      lines.push(...(await currentOfferEvidence(data, signal)));
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (reportTopics.history.test(q)) {
    try {
      const events = (await salesApi.statusHistory(data.id)).data;
      lines.push(
        'تاریخچه وضعیت قرارداد (زمان تهران)',
        ...events.map((e) =>
          [date(e.changedAt), e.toStatus, e.reason, e.changedByUserId]
            .filter(Boolean)
            .join(' — '),
        ),
      );
      if (!events.length) lines.push('رویداد تغییر وضعیت ثبت نشده است.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (reportTopics.audit.test(q)) {
    try {
      const audit = (await salesApi.contractAudit(data.id)).data;
      lines.push(
        ...audit.map((e) =>
          [
            date(e.occurredAt),
            e.action,
            e.outcome,
            e.actorUserId,
            ...changedFields(e.beforeSnapshot, e.afterSnapshot),
          ]
            .filter(Boolean)
            .join(' — '),
        ),
      );
      if (!audit.length) lines.push('رویداد ممیزی ثبت نشده است.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (summary || reportTopics.payment.test(q)) {
    try {
      const entries = await paymentReceiptsApi
        .entries(data.id)
        .then((response) => response.data)
        .catch((error: unknown) => {
          lines.push(reportError(error));
          return undefined;
        });
      if (entries) lines.push(...ledgerEvidence(data));
      for (const payment of data.payments) {
        const entry = entries?.find((item) => item.id === payment.id);
        const count = entry
          ? await paymentReceiptsApi
              .list(data.id, payment.id)
              .then(async (response) => {
                let incomplete = response.data.filter(
                  (d) => d.isIncomplete,
                ).length;
                for (
                  let page = 2;
                  (page - 1) * response.meta.pageSize < response.meta.total;
                  page++
                ) {
                  signal.throwIfAborted();
                  const more = await paymentReceiptsApi.list(
                    data.id,
                    payment.id,
                    page,
                  );
                  if (more.meta.page !== page || !more.data.length)
                    throw Error('incomplete page');
                  incomplete += more.data.filter((d) => d.isIncomplete).length;
                }
                if (incomplete)
                  lines.push('مدارک ناقص این پرداخت: ' + incomplete);
                return response.meta.total;
              })
              .catch((error: unknown) => {
                lines.push(reportError(error));
                return undefined;
              })
          : undefined;
        lines.push(
          [
            payment.amount + ' ' + payment.currencyCode,
            {
              SCHEDULED: 'برنامه‌ریزی‌شده',
              PENDING_FINANCE_CONFIRMATION: 'در انتظار تأیید مالی',
              FINANCE_CONFIRMED: 'تأیید مالی',
              FINANCE_REJECTED: 'رد مالی',
              FINANCE_VOIDED: 'باطل‌شده',
            }[payment.status],
            payment.status === 'SCHEDULED' &&
            Date.parse(payment.dueAt) < Date.now()
              ? 'سررسید گذشته'
              : '',
            'سررسید ' + date(payment.dueAt),
            count === undefined
              ? 'مدرک در فهرست قابل بررسی نیست'
              : 'تعداد مدارک ثبت‌شده: ' + count,
            payment.financeDecisionReason,
          ]
            .filter(Boolean)
            .join(' — '),
        );
      }
      if (entries && !data.payments.length) lines.push('پرداخت ثبت‌شده ندارد.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (summary || reportTopics.service.test(q)) {
    lines.push(
      data.customerDocumentDeliveryApproved === undefined
        ? 'اطلاعات تأیید تحویل در این پاسخ موجود نیست.'
        : data.customerDocumentDeliveryApproved
          ? 'مجوز مالی تحویل ثبت شده؛ صدور هر مدرک را جداگانه در پرونده بررسی کنید.'
          : 'تحویل مدارک هنوز تأیید مالی ندارد.',
    );
    for (const service of data.servicesDetail ?? [])
      lines.push(
        [service.titleSnapshot || service.kind, service.status]
          .filter(Boolean)
          .join(' — '),
      );
    if (data.reservationStatus !== 'NOT_SENT' && data.servicesDetail?.length) {
      try {
        const { data: d } = await salesApi.documentReadiness(data.id);
        lines.push(
          d.deliverable
            ? 'مجوز تحویل برقرار است.'
            : d.financeApproved
              ? 'تحویل به دلیل وضعیت لغو مسدود است.'
              : 'مالی هنوز اجازه تحویل نداده است.',
        );
        if (data.services.includes('FLIGHT'))
          lines.push(
            'تعداد اسناد بلیت ثبت‌شده: ' +
              d.tickets +
              '؛ پروازهایی که مدرک مستقل ندارند باید توسط رزرواسیون بررسی شوند.',
          );
        if (data.services.includes('HOTEL'))
          lines.push(
            d.voucher ? 'واچر صادر شده است.' : 'واچر هنوز صادر نشده است.',
          );
        if (data.services.includes('INSURANCE'))
          lines.push(
            d.insured ? 'بیمه صادر شده است.' : 'بیمه هنوز صادر نشده است.',
          );
        if (data.services.includes('VISA'))
          lines.push(
            'صدور ویزا از وضعیت قرارداد قابل تأیید نیست؛ پرونده ویزا را بررسی کنید.',
          );
        if (d.appliedVersion !== null && d.contractVersion > d.appliedVersion)
          lines.push(
            'نسخه مدارک رزرواسیون از نسخه قرارداد عقب‌تر است؛ پیش از تحویل بازبینی شود.',
          );
      } catch (error) {
        lines.push(reportError(error));
      }
    }
    if (data.isFloating && data.status !== 'CANCELLED') {
      try {
        const intake = (await salesApi.readPurchaseContext(data.id)).data;
        if (intake.ticketDocuments)
          lines.push(
            'تعداد بلیت‌های صادرشده: ' + intake.ticketDocuments.length,
          );
        for (const p of intake.servicePurchases ?? [])
          lines.push([p.currencyCode, p.amount, p.finance.status].join(' — '));
      } catch (error) {
        lines.push(reportError(error));
      }
    }
    if (data.reservationContractChanged)
      lines.push(
        'قرارداد پس از ارسال تغییر کرده است؛ نسخه خدمات و مدارک را با رزرواسیون تطبیق دهید.',
      );
    if (data.reservationStatus === 'PARTIALLY_FULFILLED')
      lines.push(
        'بخشی از خدمات اجرا شده؛ از این وضعیت کلی نمی‌توان خدمت اجرا‌نشده را تعیین کرد.',
      );
  }
  return lines.join('\n');
}
