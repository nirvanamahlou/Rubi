import { rateRequest } from '@/modules/reservations/hotel-rates/controls';
import catalog from './hotel-purchase-rates.generated.json';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

export type HotelPurchaseGuideTopic = (typeof catalog)[number];

export function hotelPurchaseGuideTopic(id: string) {
  return catalog.find((topic) => topic.id === id);
}

export function resolveHotelPurchaseGuide(
  text: string,
  pathname: string | null,
) {
  if (
    matchesQuestion(
      text,
      /قیمت گذاری هتل در بازه|اطلاعات پایه|میزکار|کال سنتر|گزارش رزرواسیون|پرفروش ترین|فروش هتل|مبلغ قرارداد|ثبت قرارداد جدید/,
    )
  )
    return;

  const onPanel = pathname === '/reservations/hotel-rates';
  const explicit = matchesQuestion(
    text,
    /قیمت خرید هتل|بسته نرخ هتل|اکسل نرخ هتل|پنل نرخ هتل/,
  );
  const procedure = matchesQuestion(
    text,
    /چطور|چجور|چگونه|نحوه|راهنما|کجا|فرق|فرقی|چرا|چیکار|مراحل|یعنی/,
  );
  if (!onPanel && !explicit) {
    if (/^(?:(?:چطور|کجا|نحوه) )?قیمت هتل(?: رو بگو| چقدره)?$/.test(text)) {
      return {
        clarification:
          'منظورتان قیمت خرید هتل، قیمت فروش تور یا مبلغ یک قرارداد است؟',
      };
    }
    return;
  }

  // Financial amounts and aggregate questions still belong to the existing data routes.
  if (!procedure && matchesQuestion(text, /چقدر|چند تا|مجموع|تعداد|جمع/))
    return;

  const packId = text.match(
    /(?:^|\s)([a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})(?=\s|$)/,
  )?.[1];
  const inspection =
    Boolean(packId) ||
    matchesQuestion(text, /این بسته|این نرخ|این پرونده|بسته من|فایل من/);
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
    .filter(({ score }) => score > 0);

  // A workflow match is more informative than the name of the panel.
  const matches = ranked.filter(
    ({ topic }) => topic.id !== 'hotel-purchase-start',
  );
  const [first, second] = (matches.length ? matches : ranked).sort(
    (a, b) => b.score - a.score,
  );
  if (first && first.score === second?.score) {
    return {
      clarification: `منظورتان «${first.topic.title}» است یا «${second.topic.title}»؟`,
    };
  }
  const topic =
    first?.topic ??
    (explicit ||
    inspection ||
    (onPanel &&
      procedure &&
      matchesQuestion(text, /این بخش|این صفحه|کدام کارت|از کجا شروع/))
      ? hotelPurchaseGuideTopic(
          packId ? 'hotel-purchase-existing' : 'hotel-purchase-start',
        )
      : undefined);
  if (topic)
    return {
      topic,
      inspection,
      followUp: false,
      ...(packId ? { packId } : {}),
    };
}

export async function readHotelPurchaseGuidePack(
  id: string,
  signal: AbortSignal,
) {
  const pack = await rateRequest<{
    cityName: string;
    version: number;
    checkIn: string;
    checkOut: string;
  }>(`/packs/${encodeURIComponent(id)}`, { signal });
  return [
    `شهر: ${pack.cityName}`,
    `نسخهٔ ذخیره‌شده: ${pack.version.toLocaleString('fa-IR')}`,
    `بازهٔ ذخیره‌شده: ${pack.checkIn} تا ${pack.checkOut} (پایان غیرشامل)`,
  ].join('\n');
}
