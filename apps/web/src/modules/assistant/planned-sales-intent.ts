import { normalizeQuestion } from './question-text';

type SalesSource =
  'passengers' | 'services' | 'amounts' | 'payments' | 'contracts';
const passenger = /مسافر|بزرگسال|گروه سنی/u;
const service = /خدمات|سرویس/u;
const payment = /پرداخت|دریافتی|وصول/u;
const amount = /مبلغ|مبالغ|قیمت|بها|تخفیف/u;
const contract = /قرارداد|فروش/u;
const grouping =
  /تفکیک|جدا از|جداگانه|به ازای|برای هر|گروه بندی|دسته بندی|بر حسب|براساس|بر اساس|مقایسه|بالاترین|بیشترین|کمترین/u;
const quantity =
  /تعداد|جمع|مجموع|مبلغ|مبالغ|چند|چقدر|درصد|میانگین|گزارش کن|گزارش بده|بشمار/u;
const otherDomain =
  /(?:b2[bc]|کال سنتر|مرخصی|مساعده|حقوق|منابع انسانی|حسابداری|حساب بانکی|تنخواه|خرید|تأمین کننده|تامین کننده|تیکت پشتیبانی|قیمت گذاری پرواز|تعرفه پرواز)/iu;

/** The owner endpoint accepts no filters. Recognize extra constraints without silently discarding them. */
export function ownContractCountIntent(
  question: string,
): 'all-time' | 'qualified' | null {
  const text = normalizeQuestion(question);
  if (
    !/(?:قرارداد(?:ها(?:ی)?| های)? (?:خودم|من)(?: |$)|قراردادهام(?:ون)?(?: |$)|قراردادهایم(?: |$))/u.test(
      text,
    ) ||
    !/تعداد|چند|چقدر|بشمار/u.test(text) ||
    /چطور|چجور|چگونه|از کجا|نحوه|مراحل|راهنما/u.test(text)
  )
    return null;
  const remaining = text
    .replace(
      /(?:^| )(?:با انتخاب همه شرکت ها|در همه شرکت ها|در کل شرکت های مجاز)(?= |$)/gu,
      ' ',
    )
    .split(' ')
    .filter(Boolean);
  return remaining.every((word) =>
    /^(?:لطفا|تعداد|شمار|کل|همه|قرارداد(?:هایم|هام|های|ها)?|های|خودم|من|چند|چندتا|چقدر|تا|تاست|دارم|است|هست|هستند|چنده|میشه|چقدره|را|رو|بگو|بشمار|بده)$/u.test(
      word,
    ),
  )
    ? 'all-time'
    : 'qualified';
}

/** An owner data query with dimensions/independent measures cannot be satisfied by a scalar panel card. */
export function analyticalSalesSources(question: string): SalesSource[] {
  const text = normalizeQuestion(question);
  if (
    otherDomain.test(text) ||
    /چطور|چجور|چگونه|از کجا|راهنما|نحوه|مراحل/u.test(text) ||
    !quantity.test(text)
  )
    return [];
  const sources: SalesSource[] = [];
  if (passenger.test(text)) sources.push('passengers');
  if (
    service.test(text) &&
    (contract.test(text) || /انتخاب|ثبت شده/u.test(text))
  )
    sources.push('services');
  if (payment.test(text)) sources.push('payments');
  if (
    amount.test(text) &&
    !payment.test(text) &&
    (contract.test(text) || sources.length)
  )
    sources.push('amounts');
  // A contract count comparing Tehran civil days already has its own validated
  // v3 response/evidence path. It requests two periods, not a grouping column.
  // Keep explicit dimensions and child measures on the analytical route.
  if (
    !sources.length &&
    contract.test(text) &&
    /امروز|دیروز/u.test(text) &&
    !/تفکیک|به ازای|برای هر|بر حسب|بر اساس|براساس|گروه بندی|دسته بندی/u.test(
      text,
    )
  )
    return [];
  if (grouping.test(text))
    return sources.length ? sources : contract.test(text) ? ['contracts'] : [];
  return sources.length > 1 && contract.test(text) ? sources : [];
}

/** In “amount in USD and passenger count for contract X”, X qualifies both measures. */
export function joinsSalesMeasures(
  left: string,
  separator: string,
  right: string,
) {
  if (separator.trim() !== 'و') return false;
  const phrase = normalizeQuestion(left);
  if (
    !/^(?:(?:جمع|مجموع|تعداد|مبلغ|مبالغ|قیمت|بها|تخفیف|مسافر(?:ان)?|خدمات|پرداخت(?:ها)?|ریالی|دلاری|ارزی|نهایی|کل|خالص|ناخالص|ریال|دلار|یورو|usd|irr|eur)(?: |$))+$/iu.test(
      phrase,
    )
  )
    return false;
  const next = right.split(
    /[؟?؛;،,]|\s+و\s+(?=(?:بهم )?(?:بگو )?(?:چطور|چگونه|چجور|مراحل|راهنما|از کجا))/u,
    1,
  )[0]!;
  return analyticalSalesSources(left + ' و ' + next).length > 1;
}
