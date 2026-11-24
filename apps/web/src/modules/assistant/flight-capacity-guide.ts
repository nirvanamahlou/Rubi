import { ticketCalendarDate } from '@nora/contracts';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import catalog from './flight-capacity.generated.json';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

type Topic = (typeof catalog)[number];
type Lookup = {
  number: string;
  date: string;
  cabin?: 'ECONOMY' | 'BUSINESS' | 'FIRST';
};
type Intent =
  | { kind: 'clarify'; text: string }
  | { kind: 'guide'; topic: Topic; followUp: boolean }
  | { kind: 'read'; lookup: Lookup };

export const flightCapacityHref = '/ticket-management';
const followUpQuestion = /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/;
const noLookup =
  'شمارهٔ پرواز و تاریخ حرکت را با قالب میلادی 2026-11-24 بنویسید. اگر کلاس مشخصی مدنظر است، آن را هم ذکر کنید.';

function validDate(date: string) {
  const time = Date.parse(date + 'T00:00:00Z');
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}

export function resolveFlightCapacityQuestion(
  message: string,
  pathname: string | null,
  previous?: string,
): Intent | undefined {
  const text = normalizeQuestion(message);
  if (previous && followUpQuestion.test(text)) {
    const topic = catalog.find((item) => item.id === previous);
    if (topic) return { kind: 'guide', topic, followUp: true };
  }

  const explicit = matchesQuestion(
    text,
    /تعریف و ظرفیت پرواز|تعریف بلی[تط]|لود (?:پرواز )?چارتر|ظرفیت پرواز/,
  );
  const distinctive = matchesQuestion(
    text,
    /کلاس همنام رفت|ویرایش لود|ویرایش روز هفته|تکرار هفتگی|مانده صندلی|رزروهای فعال ظرفیت/,
  );
  const flightSeats =
    matchesQuestion(text, /چند صندلی|ظرفیت باقی مانده/) &&
    matchesQuestion(text, /پرواز/);
  if (
    pathname !== flightCapacityHref &&
    !explicit &&
    !distinctive &&
    !flightSeats
  )
    return;
  if (
    matchesQuestion(
      text,
      /گزارش رزرواسیون|مبلغ قرارداد|فروش هتل|مرخصی|میزکار|کال سنتر|قیمت خرید هتل/,
    ) ||
    (!explicit && matchesQuestion(text, /تعریف تور|قیمت گذاری پرواز/))
  )
    return;

  const procedure = matchesQuestion(
    text,
    /چطور|چجور|چگونه|نحوه|راهنما|کجا|مراحل|تعریف کنم|فرق|چیکار|کدام ویرایش/,
  );
  const data =
    matchesQuestion(
      text,
      /چند صندلی|مانده پرواز|چقدر ظرفیت|ظرفیت باقی مانده|این پرواز|وضعیت پرواز/,
    ) ||
    (matchesQuestion(text, /چند|چقدره|چقدر/) &&
      matchesQuestion(text, /مانده|ظرفیت|صندلی/));
  if (data && !procedure) {
    const number =
      text.match(/(?:^|\s)([a-z\d]{2,3}[- ]?\d{2,5}[a-z]?)(?=\s|$)/i)?.[1] ??
      text.match(/(?:پرواز|شماره پرواز) (\d{2,5})(?=\s|$)/)?.[1];
    const date = text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/)?.[1];
    if (
      !number ||
      !date ||
      Number(date.slice(0, 4)) < 1900 ||
      !validDate(date)
    ) {
      return { kind: 'clarify', text: noLookup };
    }
    const cabin = matchesQuestion(text, /اکونومی|اقتصادی|economy/)
      ? 'ECONOMY'
      : matchesQuestion(text, /بیزینس|تجاری|business/)
        ? 'BUSINESS'
        : matchesQuestion(text, /فرست کلاس|first/)
          ? 'FIRST'
          : undefined;
    return {
      kind: 'read',
      lookup: { number, date, ...(cabin ? { cabin } : {}) },
    };
  }

  if (matchesQuestion(text, /مجوز|دسترسی/)) {
    const topic = catalog.find((item) => item.id === 'access');
    if (topic) return { kind: 'guide', topic, followUp: false };
  }

  const ranked = catalog
    .map((topic) => ({
      topic,
      score: Math.max(
        0,
        ...topic.terms
          .filter((term) => containsQuestionPhrase(text, term))
          .map((term) => normalizeQuestion(term).split(' ').length),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  const [first, second] = ranked;
  if (first && first.score === second?.score)
    return {
      kind: 'clarify',
      text:
        'منظورتان «' +
        first.topic.title +
        '» است یا «' +
        second.topic.title +
        '»؟',
    };
  if (first) return { kind: 'guide', topic: first.topic, followUp: false };
  if (explicit)
    return {
      kind: 'clarify',
      text: 'راهنمای تعریف بلیط، لود چارتر، ویرایش یا بررسی ظرفیت را می‌خواهید؟',
    };
}

export function renderFlightCapacityGuide(topic: Topic, followUp: boolean) {
  return [
    topic.route.join(' ← '),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, i) => i + 1 + '. ' + step)),
  ].join('\n\n');
}

export async function readFlightCapacity(
  lookup: Lookup,
  branchIds: readonly string[],
  signal: AbortSignal,
) {
  const calendarToday = ticketCalendarDate(new Date().toISOString());
  const { data } = await toursApi.managedOffers(
    lookup.date <= calendarToday,
    signal,
  );
  const flightNumber = (value: string) =>
    normalizeQuestion(value).replace(/[\s-]/g, '');
  const offers = data.filter(
    (offer) =>
      branchIds.includes(offer.branchId) &&
      ticketCalendarDate(offer.departureAt) === lookup.date &&
      flightNumber(offer.serviceNumber) === flightNumber(lookup.number) &&
      (!lookup.cabin || offer.cabinClassCode === lookup.cabin),
  );
  if (offers.length === 0)
    return 'پرواز منطبق در فهرست قابل مشاهدهٔ مدیریت بلیط پیدا نشد. شماره، تاریخ، کلاس و شعبه را در لود بررسی کنید.';
  if (offers.length > 1)
    return 'چند ردیف منطبق وجود دارد. اگر کلاس را مشخص نکرده‌اید، آن را بنویسید. برای ردیف‌های یک کلاس، شعبه و مسیر را در لود بررسی کنید.';
  const offer = offers[0]!;
  const format = (value: number) => value.toLocaleString('fa-IR');
  return [
    offer.carrierName + ' · ' + offer.serviceNumber,
    'تاریخ حرکت: ' + lookup.date,
    'کلاس: ' +
      { ECONOMY: 'اقتصادی', BUSINESS: 'تجاری', FIRST: 'فرست کلاس' }[
        offer.cabinClassCode
      ],
    'ظرفیت کل: ' + format(offer.totalCapacity),
    'مانده: ' + format(offer.remainingCapacity),
    'وضعیت فروش: ' + (offer.status === 'ACTIVE' ? 'فعال' : 'متوقف'),
  ].join('\n');
}
