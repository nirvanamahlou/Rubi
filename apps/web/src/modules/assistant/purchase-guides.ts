import { loadPurchaseInbox } from '../reservation-purchases/api';
import {
  contractPurchaseServices,
  purchaseFilters,
  purchaseHubHref,
  purchaseServiceLabel,
  servicePurchase,
} from '../reservation-purchases/model';
import { normalizeQuestion } from './question-text';

const path = '/ticket-purchases';
const topics = [
  {
    id: 'access',
    match: /مجوز|دسترسی|دکمه|باز نمی|خطا/,
    title: 'دسترسی و رفع خطا',
    text: 'شرکت فعال و دسترسی مشاهده رزرواسیون را بررسی کنید. عملیات ثبت و اصلاح به مجوز مربوط وابسته است. خطای دریافت را با فهرست خالی یکی نگیرید. برای خطای موقت، به‌روزرسانی خریدها را بزنید.',
  },
  {
    id: 'finance',
    match: /تسویه|پرداخت|مالی|رد شد/,
    title: 'پیگیری مالی خرید',
    text: 'در ردیف خدمت، وضعیت ثبت و وضعیت مالی را جدا ببینید. در انتظار تسویه مالی یعنی خرید ثبت شده و پرداخت هنوز تأیید نشده است. پرداخت‌شده یعنی تسویه ثبت شده است. اگر نیازمند اصلاح خرید است، جزئیات را باز کنید، اطلاعات را طبق نظر مالی بررسی و با مجوز ثبت اصلاح کنید.',
  },
  {
    id: 'flight',
    match: /قیمت صندلی|کل خرید پرواز|خرید پرواز/,
    title: 'خرید پرواز و قیمت صندلی',
    text: 'همه خدمات یا خرید پرواز را انتخاب کنید و به خرید پرواز و قیمت صندلی بروید. پرواز و ردیف مربوط را پیدا کنید و مبلغ کل پرواز را از هزینه ردیف یا صندلی تفکیک کنید. وضعیت در دسترس نیست یعنی داده برای تشخیص ثبت کافی نیست. برای بلیط شناور از دستهٔ بلیط شناور و فرم خدمت همان قرارداد استفاده کنید.',
  },
  {
    id: 'filters',
    match: /فیلتر|جست|صفحه بندی|بازه|مرتب|تاریخ|پیدا/,
    title: 'جست‌وجو و فیلتر خریدها',
    text: 'دستهٔ خدمت را انتخاب کنید، شماره قرارداد را جست‌وجو کنید و وضعیت ثبت را تنظیم کنید. مبنای تاریخ می‌تواند ورود به خرید و تأمین، حرکت پرواز، ورود به هتل یا ثبت خرید باشد. تاریخ شروع و پایان و ترتیب را بررسی کنید و صفحات بعد را ببینید. اگر نتیجه خالی است، بازه و مبنای تاریخ را بررسی کنید و همه وضعیت‌های ثبت را انتخاب کنید.',
  },
  {
    id: 'save',
    match: /ثبت|اصلاح|ویرایش|هتل|بیمه|ترانسفر|شناور|کارگزار|مبلغ/,
    title: 'ثبت و اصلاح خرید خدمات قرارداد',
    text: 'دسته و ردیف خدمت را پیدا کنید. ثبت خرید یا مشاهده و اصلاح خرید را بزنید. در فرم همان خدمت، کارگزار، مبلغ، ارز و فیلدهای الزامی را بررسی کنید. برای هتل، خرید قدیمی را در همان ردیف بررسی کنید. در ترانسفر رفت‌وبرگشت خدمات پوشش‌داده‌شده را کنترل کنید و در بلیط شناور، مبلغ و ارز خرید هر مسافر را طبق فرم وارد کنید. برای بیمه، خدمت بیمه همان قرارداد را انتخاب کنید. پس از ذخیره، ردیف را تازه‌سازی کنید. اگر پاسخ ذخیره نامشخص بود، پیش از تکرار ثبت، وضعیت ردیف را بررسی کنید.',
  },
  {
    id: 'dashboard',
    match: /داشبورد|کارت|کل خرید|آمار|نامشخص/,
    title: 'داشبورد خرید خدمات',
    text: 'کارت‌های کل خریدهای خدمات، در انتظار ثبت، خریدهای ثبت‌شده و وضعیت نامشخص را در بالای صفحه ببینید. کارت‌ها خدمت را می‌شمارند و یک قرارداد می‌تواند چند خدمت داشته باشد. برای اختلاف با فهرست، وضعیت، دسته، بازه و صفحات فهرست را بررسی کنید. به‌روزرسانی خریدها داده را دوباره دریافت می‌کند.',
  },
] as const;

type Topic = (typeof topics)[number];
export function resolvePurchaseQuestion(
  message: string,
  onPanel: boolean,
  previous?: Topic['id'] | 'status',
) {
  const text = normalizeQuestion(message);
  if (/تنخواه|قیمت فروش/.test(text)) return;
  if (previous === 'status' && /^[a-z0-9][a-z0-9_/-]{0,99}$/i.test(text))
    return { kind: 'status' as const, code: text };
  const continuation = /^(?:بعدش چی|بعدش|مرحله بعد|بیشتر توضیح بده)$/.test(
    text,
  );
  const last = continuation && topics.find((topic) => topic.id === previous);
  if (last) return { kind: 'guide' as const, topic: last };
  const explicit =
    /خرید و تامین|خرید خدمات|خرید پرواز|خرید هتل|خرید بیمه|خرید ترانسفر|قیمت صندلی|خرید.*قرارداد|قرارداد.*خرید/.test(
      text,
    );
  if (
    !explicit &&
    !(
      onPanel &&
      !/اسناد|بارگذاری فایل|مرخصی|کال سنتر|قرارداد جدید/.test(text) &&
      /خرید|کارگزار|داشبورد|فیلتر|تسویه|این بخش/.test(text)
    )
  )
    return;
  const procedural = /چطور|چگونه|نحوه|از کجا|راهنما|کجا|چیکار|معنی/.test(text);
  if (
    !procedural &&
    /وضعیت|ثبت شده|ثبتشده|تسویه شده|پرداخت شده|دست کی/.test(text) &&
    /قرارداد|خرید.*من|خریدم/.test(text)
  ) {
    const code =
      /قرارداد\s+(?:شماره\s+)?([a-z0-9][a-z0-9_/-]{0,99})(?=\s|$)/i.exec(
        text,
      )?.[1];
    return { kind: 'status' as const, code };
  }
  return {
    kind: 'guide' as const,
    topic: topics.find((topic) => topic.match.test(text)) ?? topics[5],
  };
}

export const purchaseGuideLink = { href: path, label: 'خرید و تأمین' };
export function renderPurchaseGuide(topic: Topic) {
  return [topic.title, purchaseGuideLink.label, topic.text].join('\n\n');
}

export async function readPurchaseGuide(
  code: string | undefined,
  signal: AbortSignal,
) {
  const link = purchaseGuideLink;
  if (!code)
    return {
      link,
      text: 'شماره کامل قرارداد را وارد کنید تا وضعیت خرید خدمات آن بررسی شود.',
    };
  const result = await loadPurchaseInbox(
    'ALL',
    1,
    code.toUpperCase(),
    signal,
    purchaseFilters(new URLSearchParams({ status: 'ALL' })),
  );
  const matches = result.data.filter(
    (row) => row.snapshot.contractNumber.toLowerCase() === code.toLowerCase(),
  );
  const request = matches[0];
  if (
    matches.length !== 1 ||
    result.meta.hasMore ||
    !request ||
    !result.meta.services
  ) {
    return {
      link,
      text: 'وضعیت قطعی در دسترس نیست. شماره کامل و شرکت فعال را بررسی کنید و فهرست خریدها را باز کنید.',
    };
  }
  const services = contractPurchaseServices(request);
  const lines = result.meta.services
    .filter((row) => row.id === request.id)
    .map((row) => {
      const service = services.find((item) => item.clientKey === row.clientKey);
      const finance = servicePurchase(request, row.clientKey)?.finance?.status;
      const status =
        row.status === 'REGISTERED'
          ? 'خرید ثبت‌شده'
          : row.status === 'UNREGISTERED'
            ? 'خرید ثبت نشده'
            : 'وضعیت نامشخص';
      const settlement =
        finance === 'PAID'
          ? 'پرداخت‌شده'
          : finance === 'REJECTED'
            ? 'نیازمند اصلاح خرید'
            : finance
              ? 'در انتظار تسویه مالی'
              : 'وضعیت مالی در دسترس نیست';
      return [
        service?.titleSnapshot ||
          (service && purchaseServiceLabel(request, service)) ||
          'خدمت قرارداد',
        status,
        settlement,
      ].join(' · ');
    });
  return {
    link: {
      ...link,
      href: purchaseHubHref({
        id: request.id,
        contractNumber: request.snapshot.contractNumber,
      }),
    },
    text:
      lines.join('\n') ||
      'وضعیت قطعی در دسترس نیست. شماره کامل و شرکت فعال را بررسی کنید و فهرست خریدها را باز کنید.',
  };
}
