import guideCatalogue from './purchase-guide.generated.json';
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
const topics = guideCatalogue.map(({ pattern, flags, ...topic }) => ({
  ...topic,
  match: new RegExp(pattern, flags),
}));

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
  const topic =
    topics.find((item) => item.match.test(text)) ??
    topics.find((item) => item.id === 'dashboard');
  if (topic) return { kind: 'guide' as const, topic };
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
