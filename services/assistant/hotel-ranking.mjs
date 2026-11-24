import {
  normalizeSalesText,
  resolvePersianSalesPeriod,
  resolveRelativeSalesPeriods,
  tehranCivilDate,
} from './persian-sales-period.mjs';
import { ServiceError } from './errors.mjs';

export function hotelRankingRequest(message, now) {
  const text = normalizeSalesText(message).replace(/[؟?،.!]/g, '');
  const window = text.match(
    /^(?:لطفا )?پرفروش ?ترین هتل(?: ?های)? (.+?) به تفکیک کشور(?: ?ها)?(?: (?:رو |را )?(?:بنویس|بگو|نشون بده|نشان بده))?$/u,
  )?.[1];
  const defaultPeriod =
    /^(?:لطفا )?(?:پر ?فروش ?ترین هتل(?: ?ها(?:یی|ی)?)?(?: ?(?:را|رو))?(?: که (?:باهاشون|با آن ها) قرارداد (?:بستیم|بستیمو|بسته ایم))?|هتل(?: ?ها(?:یی|ی)?)? که بیش ?ترین قرارداد(?: (?:را|رو))? (?:دارن|دارند|دارندو|دارنو))(?: (?:را |رو )?(?:بده|بنویس|بگو|نشون بده|نشان بده))?$/u.test(
      text,
    );
  if (!window && !defaultPeriod) return null;
  if (defaultPeriod || /^(?:در )?(?:یک|1) ماه اخیر$/u.test(window)) {
    const edge = defaultPeriod
      ? now.getTime()
      : Date.parse(tehranCivilDate(now) + 'T00:00:00+03:30');
    return {
      startUtc: new Date(edge - 30 * 86400000).toISOString(),
      endExclusiveUtc: now.toISOString(),
      partial: true,
      ...(defaultPeriod ? { defaultPeriod: true } : {}),
    };
  }
  if (
    /^(?:در )?(?:این (?:ماه|هفته|سال)|(?:ماه|هفته|سال) (?:قبل|گذشته)|(?:30) روز گذشته)$/u.test(
      window,
    )
  ) {
    if (window.endsWith('30 روز گذشته')) {
      const edge = Date.parse(tehranCivilDate(now) + 'T00:00:00+03:30');
      return {
        startUtc: new Date(edge - 30 * 86400000).toISOString(),
        endExclusiveUtc: new Date(edge).toISOString(),
      };
    }
    return resolveRelativeSalesPeriods(window, now)?.[0] ?? null;
  }
  return /^(?:از|بین) /.test(window)
    ? resolvePersianSalesPeriod(window, now)
    : null;
}

const dates = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'long',
});
const numbers = new Intl.NumberFormat('fa-IR');
const label = (s) => s.replace(/[|*\x60\r\n]/g, ' ').trim();

export function renderHotelRanking(
  result,
  period,
  requestId,
  showMethod = false,
) {
  if (
    !Array.isArray(result.rows) ||
    result.rows.length > 60 ||
    result.rows.some(
      (row) =>
        ![row?.hotel, row?.country].every(
          (s) => typeof s === 'string' && s.trim() && s.length <= 240,
        ) ||
        !Number.isSafeInteger(row.count) ||
        row.count < 1,
    ) ||
    !/^[a-f0-9-]{36}$/.test(result.resultId) ||
    !Number.isFinite(Date.parse(result.observedAt)) ||
    typeof result.truncated !== 'boolean' ||
    !Number.isSafeInteger(result.missing) ||
    result.missing < 0
  )
    throw new ServiceError(502, 'INVALID_AGENT_SOURCE');
  const limitations = [];
  if (result.missing)
    limitations.push(
      'اقامت‌های فاقد نام هتل یا کشور در رتبه‌بندی لحاظ نشده‌اند.',
    );
  const rows = [];
  let size = 0;
  for (const row of result.rows) {
    const line =
      '| ' +
      label(row.country) +
      ' | ' +
      label(row.hotel) +
      ' | ' +
      numbers.format(row.count) +
      ' |';
    size += line.length;
    if (size > 4900) break;
    rows.push(line);
  }
  const truncated = result.truncated || rows.length < result.rows.length;
  if (truncated)
    limitations.push(
      'بخشی از رتبه‌بندی به‌دلیل اندازهٔ گزارش نمایش داده شده است.',
    );
  return {
    version: 3,
    status: 'ANSWER',
    plan: [],
    requestId,
    limitations,
    sources: [
      {
        resultId: result.resultId,
        sources: ['contracts', 'services'],
        observedAt: result.observedAt,
        truncated,
      },
    ],
    text: [
      'پرفروش‌ترین هتل‌ها به تفکیک کشور',
      ...(period.defaultPeriod
        ? ['بازهٔ پیش‌فرض گزارش: ۳۰ روز اخیر، تا زمان سؤال.']
        : []),
      'بازه بر اساس تاریخ ثبت قرارداد به وقت تهران، از ' +
        dates.format(new Date(period.startUtc)) +
        ' تا ' +
        dates.format(new Date(Date.parse(period.endExclusiveUtc) - 1)) +
        (period.partial ? '، تا زمان سؤال' : ''),
      rows.length
        ? [
            '| کشور | هتل | تعداد قرارداد |',
            '| --- | --- | --- |',
            ...rows,
          ].join('\n')
        : 'برای این بازه رتبه‌بندی قابل ارائه نیست.',
      ...(showMethod
        ? [
            'مبنای رتبه‌بندی تعداد قراردادهای قطعی قابل مشاهده است. هتل اصلی و اقامت‌های اضافه بررسی می‌شوند. هر هتل در هر قرارداد یک‌بار شمرده می‌شود و حداکثر پنج هتل در هر کشور نمایش داده می‌شود.',
          ]
        : []),
    ].join('\n\n'),
  };
}
