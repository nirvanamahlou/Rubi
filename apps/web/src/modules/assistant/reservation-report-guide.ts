import {
  loadReservationIssuedTickets,
  ReservationReportHttpError,
} from '@/modules/ticket-catalog/api/issued-tickets';
import {
  countIssuedTicketsByRoute,
  initialIssuedTicketQuery,
  queryIssuedTickets,
  type IssuedTicketQuery,
  type IssuedTicketReadModel,
} from '@/modules/ticket-catalog/model/issued-tickets';
import type { ReservationReportSnapshot } from '@/modules/ticket-catalog/model/reservation-report-context';
import catalog from './reservation-report-guide.json';
import { normalizeQuestion } from './question-text';

export type ReservationReportTopic = keyof typeof catalog.topics;
const copy = catalog.labels;
export const reservationReportPermissionMessage = copy.permission;
const metrics = {
  '/total': copy.total,
  '/active': copy.active,
  '/cancelled': copy.cancelled,
  '/routes': copy.routes,
  '/issued': copy.issued,
  '/routeRows': copy.routeRows,
  '/refunds': copy.status.refunded,
  '/voids': copy.status.voided,
};
type Metric = keyof typeof metrics;
type Lookup = { contractNumber: string } | { documentNumber: string };

export function resolveReservationReportQuestion(
  message: string,
  onPanel: boolean,
  previous?: ReservationReportTopic,
) {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text))
    return { kind: 'guide' as const, topic: previous, followUp: true };
  if (
    /تعریف تور|ثبت بلیط|صدور بلیط.*چطور|تغییر رزرو|تحویل مدارک|ثبت قرارداد|قرارداد (?:جدید )?ثبت/.test(
      text,
    )
  )
    return;
  const explicit = /گزارش رزرواسیون|گزارش بلی[تط]|گزارش خدمات سفر/.test(text);
  if (
    !explicit &&
    (!onPanel ||
      !/گزارش|فیلتر|اکسل|pdf|استرداد|ابطال|بلی[تط]|پرواز|مسیر|خدمت|خدمات|فعال و تغییر|کارت|ردیف|رزرو|pnr|مسافر|مبنای تاریخ|صفحه|قرارداد/.test(
        text,
      ))
  )
    return;
  const procedure = /چطور|چگونه|چجور|نحوه|راهنما|کجا|از کجا/.test(text);
  const dates = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(
    (match) => match[0],
  );
  const priorWeek = /هفته (?:قبل|گذشته)/.test(text);
  const hasRange = dates.length > 0 || priorWeek;
  const basis = /مبنای سفر|حرکت|ورود هتل/.test(text)
    ? 'TRAVEL'
    : /مبنای صدور|ثبت درخواست|تاریخ صدور/.test(text)
      ? 'ISSUED'
      : undefined;
  const metric: Metric | undefined = /فعال و تغییر/.test(text)
    ? '/active'
    : /استرداد.*ابطال|ابطال.*استرداد/.test(text)
      ? '/cancelled'
      : /استرداد/.test(text)
        ? '/refunds'
        : /ابطال/.test(text)
          ? '/voids'
          : /تعداد مسیر|چند مسیر/.test(text)
            ? '/routes'
            : /هر مسیر|قطعه.*مسیر/.test(text)
              ? '/routeRows'
              : /صادر|صدور/.test(text) && /بلی[تط]|قطعه|پرواز/.test(text)
                ? '/issued'
                : /خدمت|خدمات/.test(text)
                  ? '/total'
                  : undefined;
  const contract = text.match(
    /(?:^|\s)قرارداد\s+(?:شماره\s+)?(sc-\d{4}-[a-z\d-]+|\d{5,14})(?=\s|$)/,
  )?.[1];
  const document = text.match(
    /(?:pnr|شماره بلی[تط])\s+([a-z\d-]{4,24})(?=\s|$)/,
  )?.[1];
  const lookup: Lookup | undefined = contract
    ? { contractNumber: contract }
    : document
      ? { documentNumber: document }
      : undefined;
  if (!procedure && /چند|تعداد|چقدر|جمع/.test(text)) {
    if (!metric) return { kind: 'clarify' as const, text: copy.unit };
    if (
      (!hasRange &&
        /امروز|دیروز|این هفته|ماه|امسال|سال گذشته|روز گذشته|اخیر/.test(text)) ||
      /(?:از|به) شهر|مسیر (?!ها|های|در)|ایرلاین|هتل|نام مسافر/.test(
        text.replace(/هر مسیر|چند مسیر|تعداد مسیر|ورود هتل/g, ''),
      )
    )
      return { kind: 'clarify' as const, text: copy.missing };
    return {
      kind: 'read' as const,
      metric,
      dates,
      priorWeek,
      hasRange,
      basis,
      lookup,
    };
  }
  if (
    !procedure &&
    (lookup || /وضعیت.*(?:بلی[تط]|خدمت|رزرو)|ردیف.*چیه/.test(text))
  )
    return {
      kind: 'read' as const,
      metric: undefined,
      dates,
      priorWeek,
      hasRange,
      basis,
      lookup,
    };
  const topic: ReservationReportTopic = /اکسل|pdf|پی دی اف|دانلود|خروجی/.test(
    text,
  )
    ? 'exports'
    : /مبنای تاریخ|بازه تاریخ|تاریخ حرکت|تاریخ صدور/.test(text)
      ? 'dates'
      : /شمارش|اختلاف.*عدد|کارت|تعداد مسیر|جمع قطعه/.test(text)
        ? 'cards'
        : /صفحه بندی|ردیف|pnr مشترک|تخصیص یافته/.test(text)
          ? 'rows'
          : /فیلتر|استرداد|ابطال|مسافر|pnr|ایرلاین|شماره قرارداد/.test(text)
            ? 'filters'
            : 'start';
  return { kind: 'guide' as const, topic, followUp: false };
}

export function renderReservationReportGuide(
  topic: ReservationReportTopic,
  followUp: boolean,
) {
  const [title, steps, recovery] = catalog.topics[topic];
  return [
    catalog.path,
    title,
    ...(followUp ? [recovery] : [steps, recovery]),
  ].join('\n\n');
}

type ReportRead = Extract<
  ReturnType<typeof resolveReservationReportQuestion>,
  { kind: 'read' }
>;
const dateMs = 86400000;
const day = (time: number) => new Date(time).toISOString().slice(0, 10);

function dateBounds(intent: ReportRead, now: number) {
  if (intent.priorWeek && !intent.dates.length) {
    const tehran = now + 12600000;
    const saturday = tehran - ((new Date(tehran).getUTCDay() + 1) % 7) * dateMs;
    return [day(saturday - 7 * dateMs), day(saturday - dateMs)] as const;
  }
  const [from, to = from] = intent.dates;
  if (!from || !to || from > to || intent.dates.length > 2) return;
  if (
    ![from, to].every((d) => {
      const time = Date.parse(d);
      return Number.isFinite(time) && day(time) === d;
    })
  )
    return;
  return [from, to] as const;
}

function matchesLookup(row: IssuedTicketReadModel, lookup?: Lookup) {
  if (!lookup) return true;
  if ('contractNumber' in lookup)
    return normalizeQuestion(row.contractNumber) === lookup.contractNumber;
  return [row.ticketNumber, row.pnr].some(
    (value) => value && normalizeQuestion(value) === lookup.documentNumber,
  );
}

function summarize(rows: readonly IssuedTicketReadModel[], metric?: Metric) {
  if (!metric) {
    if (rows.length !== 1) return copy.ambiguous;
    const row = rows[0]!;
    return [
      row.contractNumber,
      row.hotelName || row.serviceTitle,
      [row.origin, row.destination].filter(Boolean).join(' ← '),
      row.reportStatus === 'ALLOCATED'
        ? copy.status.allocated
        : copy.status[row.status],
      row.departureAt,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const routes =
    metric === '/routes' || metric === '/routeRows'
      ? countIssuedTicketsByRoute(rows)
      : [];
  if (metric === '/routeRows')
    return [
      copy.routeRows,
      ...routes.map(
        (route) =>
          `${route.origin} ← ${route.destination} · ${route.count.toLocaleString('fa-IR')}`,
      ),
    ].join('\n');
  const count =
    metric === '/total'
      ? rows.length
      : metric === '/routes'
        ? routes.length
        : rows.filter((row) =>
            metric === '/active'
              ? ['issued', 'changed'].includes(row.status)
              : metric === '/cancelled'
                ? ['refunded', 'voided'].includes(row.status)
                : metric === '/refunds'
                  ? row.status === 'refunded'
                  : metric === '/voids'
                    ? row.status === 'voided'
                    : (row.serviceKind ?? 'FLIGHT') === 'FLIGHT' &&
                      row.reportStatus === 'ISSUED' &&
                      !!row.ticketNumber?.trim(),
          ).length;
  return `${metrics[metric]} · ${count.toLocaleString('fa-IR')}`;
}

export async function readReservationReportAnswer(
  intent: ReportRead,
  snapshot: ReservationReportSnapshot | undefined,
  signal: AbortSignal,
  now = Date.now(),
  load = loadReservationIssuedTickets,
) {
  if (intent.metric === '/refunds' || intent.metric === '/voids')
    return copy.combinedOnly;
  const basis = intent.basis ?? snapshot?.query.dateBasis;
  const bounds = intent.hasRange ? dateBounds(intent, now) : undefined;
  if (intent.hasRange && (!bounds || !basis)) return copy.missing;
  if (!snapshot && !bounds) return copy.missing;
  if (!bounds && snapshot?.state === 'loading') return copy.loading;
  if (!bounds && snapshot?.state === 'error') return copy.error;
  const base = snapshot?.query ?? initialIssuedTicketQuery;
  const query: IssuedTicketQuery = {
    ...base,
    page: 1,
    ...intent.lookup,
    ...(bounds ? { issuedFrom: bounds[0], issuedTo: bounds[1] } : {}),
    ...(basis ? { dateBasis: basis } : {}),
  };
  if (
    !intent.metric &&
    !intent.lookup &&
    !query.contractNumber &&
    !query.documentNumber
  )
    return copy.record;
  try {
    const changed =
      bounds ||
      intent.lookup ||
      (intent.basis && intent.basis !== snapshot?.query.dateBasis);
    const rows = changed ? (await load(signal, query)).data : snapshot!.rows;
    signal.throwIfAborted();
    const matched = queryIssuedTickets(rows, query).matchedRows.filter((row) =>
      matchesLookup(row, intent.lookup),
    );
    const filterLabels = [
      query.serviceKind,
      query.status !== 'all' ? copy.status[query.status] : undefined,
      query.hotelId !== 'all' ? catalog.topics.filters[0] : undefined,
      query.originCityId !== 'all' ||
      query.destinationCityId !== 'all' ||
      query.airlineId !== 'all'
        ? copy.routeRows
        : undefined,
      query.search ||
      query.passenger ||
      query.contractNumber ||
      query.documentNumber
        ? copy.masked
        : undefined,
    ].filter((v) => v && v !== 'all');
    return [
      matched.length ? summarize(matched, intent.metric) : copy.empty,
      `${copy.scope} · ${query.issuedFrom} → ${query.issuedTo} · ${query.dateBasis === 'TRAVEL' ? copy.travel : copy.issueDate}`,
      `${copy.filters} · ${filterLabels.join('، ') || copy.none}`,
    ].join('\n');
  } catch (error) {
    signal.throwIfAborted();
    return error instanceof ReservationReportHttpError &&
      [401, 403].includes(error.status)
      ? copy.permission
      : copy.error;
  }
}
