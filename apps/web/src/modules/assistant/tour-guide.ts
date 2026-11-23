import type { TourDepartureV1 } from '@nora/contracts';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import { matchesQuestion, normalizeQuestion } from './question-text';
import catalog from './tour-guide.json';

export const tourGuideHref = '/sales/tours';
export type TourGuideTopic = keyof typeof catalog.topics;
const copy = catalog.copy;
const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const ids = new RegExp(`(?<![a-z0-9-])${uuid}(?![a-z0-9-])`, 'ig');

export function resolveTourGuideQuestion(
  message: string,
  onPanel: boolean,
  previous?: TourGuideTopic,
) {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text))
    return { kind: 'guide' as const, topic: previous, followUp: true };
  if (/قرارداد/.test(text) && /(?:ثبت|بستن|بزن|انتخاب|افزودن)/.test(text))
    return;
  if (/گزارش رزرواسیون|تحویل مدارک|بارگذاری سند/.test(text)) return;
  if (
    !matchesQuestion(text, /تور/) &&
    (!onPanel ||
      !/نوبت|بازه|ظرفیت|قیمت|بلیت|بلیط|هتل|فهرست|راهنما|جست وجو|انتشار/.test(
        text,
      ))
  )
    return;
  if (!onPanel && !matchesQuestion(text, /تور/)) return;

  const [firstId, secondId] = text.match(ids) ?? [];
  const name = message.match(/[«"]([^»"\r\n]{2,120})[»"]/)?.[1]?.trim();
  const date = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const procedure = /چطور|چگونه|چجور|نحوه|راهنما|کجا|مراحل|چیکار/.test(text);
  const website = /سایت|وب سایت|انتشار آنلاین/.test(text);
  const pricing = /قیمت|نرخ|قیمت گذاری/.test(text);
  if (
    /چرا.*(?:نمیاد|نمی آید|نمی یاد|نمی بینم|نمایش داده نمی)/.test(text) &&
    !website &&
    !pricing &&
    !/فهرست|تعریف/.test(text)
  )
    return { kind: 'clarify' as const, text: copy.place };
  if (
    !procedure &&
    !website &&
    !pricing &&
    (name ||
      firstId ||
      /پیش نویس است|منتشر شده|وضعیت تور|چه نوبت|چه ظرفیتی|چند صندلی|ظرفیت .*تور/.test(
        text,
      ))
  ) {
    if ((!name && !firstId) || secondId)
      return { kind: 'clarify' as const, text: copy.missing };
    return {
      kind: 'record' as const,
      name,
      id: name ? undefined : firstId,
      branch: name ? firstId : undefined,
      date,
    };
  }
  const topic: TourGuideTopic = website
    ? 'website'
    : /(?:توقف|فعال سازی|حذف) بازه|بازه.*(?:متوقف|فعال|حذف)/.test(text)
      ? 'period'
      : /نوبت و قیمت/.test(text)
        ? 'departure'
        : pricing
          ? 'price'
          : /هتل.*بازه|بازه.*هتل/.test(text)
            ? 'hotel'
            : /ویرایش|حذف تور|تغییر مسیر|تغییر خدمات/.test(text)
              ? 'edit'
              : /ترکیبی|برنامه سفر|جزئیات|فرودگاه|ایرلاین|مدارک لازم|تصویر تور|شرایط اقساط|استرداد تور/.test(
                    text,
                  )
                ? 'details'
                : /نوبت|بلیت|بلیط|ظرفیت|هفته بعد/.test(text) &&
                    !/تورهای|نوبت های/.test(text)
                  ? 'departure'
                  : /شناور/.test(text)
                    ? 'floating'
                    : /تعریف|ساخت|ایجاد|ثبت|جدید/.test(text) &&
                        !/تعریف شده|تعریف تور و خدمات/.test(text)
                      ? 'create'
                      : 'overview';
  return {
    kind: 'guide' as const,
    topic,
    followUp: false,
    floatingPrice: topic === 'price' && /شناور/.test(text),
  };
}

export function renderTourGuide(topic: TourGuideTopic, followUp: boolean) {
  const [title, steps, recovery] = catalog.topics[topic];
  return [
    catalog.path,
    title,
    ...(followUp ? [recovery] : [steps, recovery]),
  ].join('\n\n');
}

export function tourGuideDestination(
  topic: TourGuideTopic,
  floatingPrice = false,
) {
  return topic === 'website'
    ? '/integrations'
    : topic === 'price'
      ? floatingPrice
        ? '/sales/pricing/floating'
        : '/sales/pricing'
      : topic === 'hotel'
        ? '/reservations/hotel-rates'
        : tourGuideHref;
}

type TourRead = Extract<
  ReturnType<typeof resolveTourGuideQuestion>,
  { kind: 'record' }
>;

const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function periodLine(period: TourDepartureV1, today: string) {
  const capacity = Math.min(
    period.outbound.totalCapacity,
    period.returning?.totalCapacity ?? period.outbound.totalCapacity,
  );
  const remaining = Math.max(0, Math.min(capacity, period.remainingCapacity));
  const status = period.isDeleted
    ? copy.removed
    : period.isActive === false
      ? copy.stopped
      : copy.active;
  const phase =
    period.endsOn < today
      ? copy.past
      : period.startsOn > today
        ? copy.upcoming
        : copy.current;
  const availability =
    !remaining || period.isDeleted || period.isActive === false
      ? copy.notSelling
      : undefined;
  return [
    `${period.startsOn} → ${period.endsOn}`,
    phase,
    status,
    `${remaining.toLocaleString('fa-IR')} / ${capacity.toLocaleString('fa-IR')} ${copy.seats}`,
    availability,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function readTourGuideStatus(
  intent: TourRead,
  scope: { branchIds: readonly string[]; permissions: readonly string[] },
  signal: AbortSignal,
  api: Pick<typeof toursApi, 'packages' | 'departures'> = toursApi,
  now = new Date(),
) {
  try {
    const { data: packages } = await api.packages(signal);
    signal.throwIfAborted();
    const matches = packages.filter(
      (tour) =>
        scope.branchIds.includes(tour.branchId) &&
        (!intent.branch || tour.branchId === intent.branch) &&
        (intent.id
          ? tour.id === intent.id
          : normalizeQuestion(tour.name) ===
            normalizeQuestion(intent.name ?? '')),
    );
    if (!matches.length) return { text: copy.empty, href: tourGuideHref };
    if (matches.length !== 1 || (!intent.id && packages.length >= 200))
      return { text: copy.multiple, href: tourGuideHref };
    const tour = matches[0]!;
    const management = scope.permissions.some((permission) =>
      ['ticket_catalog.manage', 'ticket_catalog.tours.manage'].includes(
        permission,
      ),
    );
    const { data } = await api.departures(management, signal);
    signal.throwIfAborted();
    const periods = data
      .filter(
        (period) =>
          period.packageId === tour.id &&
          period.branchId === tour.branchId &&
          (!intent.date || period.startsOn === intent.date),
      )
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const today = tehranDay.format(now);
    return {
      text: [
        tour.name,
        tour.publicationStatus === 'DRAFT' ? copy.draft : copy.published,
        tour.details?.isFloating ? copy.floating : copy.regular,
        ...(tour.details?.isCombined ? [copy.combined] : []),
        ...(periods.length
          ? periods.slice(0, 5).map((period) => periodLine(period, today))
          : [copy.noPeriod]),
        ...(periods.length > 5 ? [copy.more] : []),
        copy.source,
      ].join('\n'),
      href: tour.details?.isFloating
        ? `/sales/pricing/floating?tour=${encodeURIComponent(tour.id)}`
        : tourGuideHref,
    };
  } catch {
    signal.throwIfAborted();
    return { text: copy.unavailable, href: tourGuideHref };
  }
}

export const tourGuideUnavailable = copy.unavailable;
