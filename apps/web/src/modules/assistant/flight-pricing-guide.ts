import type { TicketOfferV1 } from '@nora/contracts';
import { loadTicketPricingOffers } from '../sales/api/ticket-pricing-offers';
import {
  ticketCabinLabel,
  type TicketPriceRow,
  netTicketPrice,
  ticketPriceRows,
} from '../sales/model/ticket-price-rows';
import {
  TicketCatalogRequestError,
  toursApi,
} from '../ticket-catalog/api/tours';
import copy from './flight-pricing-catalog.json';
import { normalizeQuestion } from './question-text';

export const flightPricingLink = {
  href: '/sales/ticket-prices',
  label: copy.label,
};
const topics = copy.topics.map((topic) => ({
  ...topic,
  match: new RegExp(topic.pattern, 'i'),
}));
type Topic = (typeof topics)[number];
const flightDate = (calendar: string) =>
  new Intl.DateTimeFormat('en-CA', {
    calendar,
    numberingSystem: 'latn',
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
const gregorian = flightDate('gregory');
const persian = flightDate('persian');

export function resolveFlightPricingQuestion(
  message: string,
  onPanel: boolean,
  previous?: string,
) {
  const text = normalizeQuestion(message);
  const prior = topics.find((topic) => topic.id === previous);
  if (prior && /^(بعدش|بعدش چی|مرحله بعد|بیشتر توضیح بده)$/.test(text))
    return { kind: 'guide' as const, topic: prior };
  if (
    /خرید صندلی|نرخ مرجع ارز|مبلغ قرارداد|قیمت قرارداد|تعریف پرواز|بارگذاری پرواز کجا/.test(
      text,
    )
  )
    return;
  const explicit =
    /قیمت ?گذاری (?:پرواز|بلی[تط])|قیمت (?:پایه |ثبت شده |کودک |نوزاد |بزرگسال |رفت و برگشت )?پرواز|نرخ کودک پرواز|کمیسیون پرواز/.test(
      text,
    );
  if (
    !explicit &&
    !(
      onPanel &&
      /قیمت|پرواز|جفت|برگشت|درصد|مقصد|اکسل|فیلتر|اطلاعات پایه|انتشار|ذخیره|ظرفیت|پله|صندلی/.test(
        text,
      )
    )
  )
    return;
  const publication = /سایت|انتشار|منتشر|ویترین/.test(text);
  const instruction =
    /چطور|چجور|چگونه|از کجا|کجا|راهنما|چرا|نحوه|تعریف|ثبت کنم|ویرایش کنم/.test(
      text,
    );
  if (
    !instruction &&
    !publication &&
    /قیمت|نرخ/.test(text) &&
    /چند|چقدر|ثبت شده|قیمت پرواز|قیمت پایه پرواز/.test(text)
  ) {
    const number =
      /پرواز\s+(?:شماره\s+)?([a-z0-9][a-z0-9-]{0,19})(?=\s|$)/i.exec(text)?.[1];
    const returning =
      /برگشت\s+(?:شماره\s+)?([a-z0-9][a-z0-9-]{0,19})(?=\s|$)/i.exec(text)?.[1];
    const dates = text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g) ?? [];
    const cabin = /اکونومی|اقتصادی|economy/.test(text)
      ? 'ECONOMY'
      : /بیزینس|business/.test(text)
        ? 'BUSINESS'
        : /فرست|first/.test(text)
          ? 'FIRST'
          : undefined;
    const target = /مقصد فروش\s+(?:کد\s+)?([^\s]+)/.exec(text)?.[1];
    return {
      kind: 'read' as const,
      number,
      returning,
      dates,
      cabin,
      target,
      needsExplicitDate:
        /امروز|فردا|دیروز|این تاریخ|شنبه|جمعه|هفته/.test(text) &&
        dates.length === 0,
      targetRequested: /مقصد فروش/.test(text),
      pair: /رفت.*برگشت|جفت/.test(text),
      group: /نوزاد/.test(text)
        ? ('infant' as const)
        : /کودک/.test(text)
          ? ('child' as const)
          : ('adult' as const),
    };
  }
  const topic = publication
    ? topics.find(({ id }) => id === 'publish')
    : [...topics.slice(3), ...topics.slice(0, 3)].find(({ match }) =>
        match.test(text),
      );
  return { kind: 'guide' as const, topic: topic ?? topics[0]! };
}

export function flightPricingTopicLink(topic: Topic) {
  return topic.id === 'pair'
    ? {
        ...flightPricingLink,
        href: flightPricingLink.href + '#round-trip-price-editor',
      }
    : flightPricingLink;
}

export function renderFlightPricingGuide(topic: Topic) {
  return [topic.title, copy.label + ' ← ' + topic.title, topic.text].join(
    '\n\n',
  );
}

type ReadIntent = Extract<
  ReturnType<typeof resolveFlightPricingQuestion>,
  { kind: 'read' }
>;
function sameDate(offer: TicketOfferV1, requested?: string) {
  if (!requested) return true;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(requested);
  if (!match) return false;
  const [, year, month, day] = match;
  const formatter = Number(year) < 1700 ? persian : gregorian;
  const date = new Date(offer.departureAt);
  if (Number.isNaN(date.getTime())) return false;
  const values = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return (
    Number(year) === Number(values.year) &&
    Number(month) === Number(values.month) &&
    Number(day) === Number(values.day)
  );
}

function rowIdentity(row: TicketPriceRow) {
  return [row.offer, row.returning].flatMap((flight) =>
    flight
      ? [
          flight.carrierName,
          flight.serviceNumber,
          gregorian.format(new Date(flight.departureAt)),
          ticketCabinLabel(flight.cabinClassCode),
        ]
      : [],
  );
}

export async function readFlightPricing(
  intent: ReadIntent,
  signal: AbortSignal,
) {
  if (
    !intent.number ||
    intent.needsExplicitDate ||
    intent.dates.length > (intent.returning ? 2 : 1) ||
    (intent.pair && !intent.returning) ||
    (intent.targetRequested && (!intent.target || intent.group !== 'adult'))
  )
    return copy.identify;
  try {
    const { data } = await loadTicketPricingOffers(signal);
    const matches = ticketPriceRows(data).filter(
      (row) =>
        normalizeQuestion(row.offer.serviceNumber) === intent.number &&
        sameDate(row.offer, intent.dates[0]) &&
        (!intent.cabin || row.offer.cabinClassCode === intent.cabin) &&
        (intent.returning
          ? !!row.returning &&
            normalizeQuestion(row.returning.serviceNumber) ===
              intent.returning &&
            sameDate(row.returning, intent.dates[1])
          : !row.returnOfferId),
    );
    if (matches.length !== 1)
      return matches.length ? copy.ambiguous : copy.missing;
    const row = matches[0]!;
    if (!row.base) return copy.noPrice;
    const base = row.base;
    let amount =
      intent.group === 'child'
        ? (base.childAmount ?? base.amount)
        : intent.group === 'infant'
          ? (base.infantAmount ?? '0')
          : base.amount;
    let label =
      intent.group === 'child'
        ? copy.topics[2]!.title + ' · کودک'
        : intent.group === 'infant'
          ? copy.topics[2]!.title + ' · نوزاد'
          : copy.topics[2]!.title + ' · بزرگسال';
    if (intent.target) {
      const targets = (await toursApi.salePriceTargets(signal)).data.filter(
        (item) =>
          item.isActive &&
          item.branchId === row.offer.branchId &&
          normalizeQuestion(item.code) === intent.target,
      );
      if (targets.length !== 1) return copy.noTarget;
      const target = targets[0]!;
      const commission = row.offer.saleCommissions?.find(
        (item) =>
          item.returnOfferId === row.returnOfferId &&
          item.salePriceTargetId === target.id,
      );
      if (commission?.isHidden || Number(commission?.percent) === 100)
        return copy.hiddenTarget;
      const legacy =
        !row.returnOfferId &&
        row.offer.targetedStandaloneSalePrices?.find(
          (item) => item.salePriceTarget.id === target.id,
        );
      const net =
        !commission && legacy
          ? legacy.amount
          : netTicketPrice(base.amount, commission?.percent ?? '0');
      if (net === undefined) return copy.failed;
      amount = net;
      label = copy.topics[5]!.title + ' · ' + target.name;
      return [
        label,
        ...rowIdentity(row),
        amount,
        !commission && legacy ? legacy.currencyCode : base.currencyCode,
      ].join(' · ');
    }
    return [label, ...rowIdentity(row), amount, base.currencyCode].join(' · ');
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof TicketCatalogRequestError) {
      if (error.status === 401) return copy.session;
      if (error.status === 403) return copy.forbidden;
    }
    return copy.failed;
  }
}
