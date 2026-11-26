import { normalizeQuestion } from './question-text';
import { historicalReportPeriod } from './historical-report-period';

const cards = {
  customers: [
    'مشتریان b2c',
    /^(?:کل )?(?:مشتریان|مشتری های) (?:b2c|حقیقی|شخصی)$/u,
  ],
  passengers: ['مسافران b2c', /^(?:کل )?مسافران (?:b2c|مشتریان حقیقی)$/u],
  newCustomers: [
    'مشتریان جدید سه ماه اخیر',
    /^مشتریان جدید (?:b2c )?سه ماه اخیر(?: b2c)?$/u,
  ],
  returnRate: ['نرخ بازگشت مشتری', /^نرخ بازگشت مشتری(?:ان)? (?:b2c|حقیقی)$/u],
  agencies: ['آژانس‌های همکار', /^(?:کل )?آژانس(?: ها| های)? همکار(?: b2b)?$/u],
  corporations: [
    'مشتریان سازمانی',
    /^(?:کل )?مشتری(?:ان| های)? سازمانی(?: b2b)?$/u,
  ],
  purchases: ['کل خریدهای خدمات', /^(?:کل )?خرید(?:های| های) خدمات$/u],
  pending: [
    'در انتظار ثبت خرید',
    /^(?:خرید(?:های| های) خدمات )?در انتظار ثبت خرید$/u,
  ],
  registered: [
    'خریدهای ثبت‌شده',
    /^خرید(?:های| های)(?: خدمات)? ثبت شده(?: خدمات)?$/u,
  ],
  uncertain: [
    'خریدهای با وضعیت نامشخص',
    /^خرید(?:های| های)(?: خدمات)? با وضعیت نامشخص$/u,
  ],
  today: ['تماس‌های امروز', /^تماس(?: های|ات| ها)? امروز(?: کال سنتر)?$/u],
  week: ['تماس‌های این هفته', /^تماس(?: های|ات| ها)? این هفته(?: کال سنتر)?$/u],
  withoutOutcome: [
    'تماس‌های بدون نتیجه',
    /^تماس(?: های|ات| ها)? بدون نتیجه(?: کال سنتر)?$/u,
  ],
  needsFollowUp: [
    'تماس‌های ازدست‌رفتهٔ نیازمند تماس مجدد',
    /^تماس(?: های|ات| ها)? (?:از دست|ازدست) رفته نیازمند تماس مجدد(?: کال سنتر)?$/u,
  ],
} as const;

export type PanelIntent =
  | { kind: 'employees'; names: boolean }
  | { kind: 'card'; key: keyof typeof cards; label: string }
  | { kind: 'b2b-status'; role: 'AGENCY' | 'CORPORATE_CUSTOMER'; code: string }
  | { kind: 'b2c-status'; name: string }
  | { kind: 'unsupported' };

export function panelIntent(question: string): PanelIntent | null {
  const text = normalizeQuestion(question).replace(/^لطفا /u, '');
  if (/راهنما|چطور|چجور|چگونه|چرا|از کجا|نحوه|مراحل/u.test(text)) return null;
  if (
    /^(?:الان )?تعداد (?:کارکنان|پرسنل|کارمندان) فعال (?:چنده|چندتاست|چند است)$/u.test(
      text,
    )
  )
    return { kind: 'employees', names: false };
  if (/^اسم همه (?:کارکنان|پرسنل|کارمندان) فعال و تعدادشون رو بده$/u.test(text))
    return { kind: 'employees', names: true };
  const status =
    /^وضعیت (آژانس(?: همکار)?|مشتری سازمانی) (?:با )?کد ([a-z0-9][a-z0-9_-]{0,79})(?: (?:چیست|چیه|رو بگو|را بگو))?$/u.exec(
      text,
    );
  if (status)
    return {
      kind: 'b2b-status',
      role: status[1]!.startsWith('آژانس') ? 'AGENCY' : 'CORPORATE_CUSTOMER',
      code: status[2]!,
    };
  const customer =
    /^(?:لطفا )?وضعیت پرونده مشتری (?:B2C|حقیقی) [«"]([^«»"\r\n]{2,100})[»"](?: (?:چیست|چیه|رو بگو|را بگو))?[؟?]?$/iu.exec(
      question.trim(),
    );
  if (customer) return { kind: 'b2c-status', name: customer[1]!.trim() };
  const phrase = text
    .replace(/^(?:الان )?(?:تعداد|چند تا|چند) /u, '')
    .replace(
      / (?:چنده|چند(?: تا)?(?:ست| است| هستند| داریم)?|چندتاست|چقدره|چقدر است|چقدر بوده|را بگو|رو بگو|داریم|هستند|هست)$/u,
      '',
    );
  for (const [id, [label, pattern]] of Object.entries(cards)) {
    if (pattern.test(phrase))
      return { kind: 'card', key: id as keyof typeof cards, label };
  }
  // The calendar-based call report has its own owner reader. Preserve it only when the
  // whole question is that metric + its range, not when an extra condition was added.
  if (
    /تماس.*(?:بدون نتیجه|نتیجه ثبت نشده)/u.test(text) &&
    /1[34]\d{2}/u.test(text)
  ) {
    const period = historicalReportPeriod(text);
    if (period) {
      const rest = text
        .replace(period.label, ' ')
        .replace(/(?:^| )(?:تو|در|بازه|کال سنتر|تعداد)(?= |$)/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
      if (
        /^تماس(?:ای| های| ها)? (?:بدون نتیجه|نتیجه ثبت نشده)(?: (?:چقده|چقدره|چند تاست|چند تا بود|چقدر است))?$/u.test(
          rest,
        )
      )
        return null;
    }
    return { kind: 'unsupported' };
  }
  if (/وضعیت (?:آژانس(?: همکار)?|مشتری سازمانی) (?:با )?کد /u.test(text))
    return { kind: 'unsupported' };
  const countRequest = /تعداد|چند|چن تا|چقدر|چقده|نرخ بازگشت/u.test(text);
  const directoryCount =
    /(?:آژانس(?: های| ها)? همکار|مشتری(?:ان| های)? سازمانی|(?:مشتری(?:ان| های)?|مسافر(?:ان| های)?) (?:حقیقی|b2c|b2b)|نرخ بازگشت مشتری)/u.test(
      text,
    );
  const purchaseCount =
    /خرید(?:های| های)(?: ثبت شده)? خدمات|در انتظار ثبت خرید/u.test(text);
  const callCard =
    /تماس(?:ای|ات| های| ها)?.*(?:امروز|این هفته|بدون نتیجه|تماس مجدد)|کال سنتر.*تماس/u.test(
      text,
    );
  if (
    countRequest &&
    (directoryCount || purchaseCount || callCard) &&
    !/(?:تعداد|چند) (?:قرارداد|درخواست|تیکت)/u.test(text)
  )
    return { kind: 'unsupported' };
  return null;
}
export const isOperationalPanelQuestion = (question: string) =>
  panelIntent(question) !== null;
