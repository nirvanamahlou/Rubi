import {
  assistantGuideSection,
  isAssistantGuideModule,
} from './assistant-guide-registry';
import { retrieveSpecificPanelGuide } from './panel-guide-retrieval';
import { normalizeQuestion } from './question-text';

export function resolvePilotGuide(
  message: string,
  panel: string,
  previous?: string,
) {
  const q = normalizeQuestion(message);
  const procedure =
    /چطور|چجور|چگونه|نحوه|مراحل|از کجا|چیکار|کجا|راهنما|قبل ارسال/;
  const issuance =
    /بلیت|بلیط|واچر|مدرک/.test(q) && /صدور|صادر|تحویل|واچر/.test(q);
  const affairs =
    panel === '/customer-affairs' ||
    /امور مشتریان|تیکت|درخواست مشتری|رضایت مشتری|ارجاع به فروش/.test(q);
  const sales =
    panel === '/sales' || /قرارداد/.test(q) || previous?.startsWith('sales/');
  const followup = /^(?:بعدش چی|بعدش|مرحله بعد چیه)$/.test(q);
  if (/سقف.*تخفیف|واچر.*باطل|صدور مجدد/.test(q) && (sales || issuance))
    return { status: 'insufficient' } as const;
  if (
    affairs &&
    /درخواست/.test(q) &&
    /دست کی|مسئول.*کی/.test(q) &&
    !/\d{4,}/.test(q)
  )
    return { status: 'clarify-record' } as const;
  const specific = retrieveSpecificPanelGuide(message, panel);
  if (specific) return { status: 'answer', ids: [specific] } as const;
  if (!procedure.test(q) && !followup) return null;
  if (/\d{4,}|دست کی|وضعیت همین|وضعیت قرارداد/.test(q)) return null;
  if (followup && previous === 'sales/create')
    return { status: 'answer', ids: ['sales/review'] } as const;
  if (issuance) {
    const primary = /واچر|هتل/.test(q)
      ? 'travel-issuance/voucher'
      : 'travel-issuance/ticket';
    const ids = /تحویل.*(?:بسته|مسدود)/.test(q)
      ? ['travel-issuance/delivery']
      : [primary, 'travel-issuance/delivery'];
    return { status: 'answer', ids } as const;
  }
  if (affairs) {
    const id = /تیکت/.test(q)
      ? 'tickets'
      : /ارجاع/.test(q)
        ? 'handoffs'
        : /رضایت|گزارش/.test(q)
          ? 'reports'
          : /درخواست/.test(q)
            ? 'requests'
            : null;
    return id
      ? ({ status: 'answer', ids: ['customer-affairs/' + id] } as const)
      : ({ status: 'clarify' } as const);
  }
  if (sales) {
    if (
      /قبل ارسال|پیش از ارسال|قبل از ارسال/.test(q) &&
      /بلیت|بلیط|پرواز/.test(q) &&
      /هتل|اقامت/.test(q)
    )
      return {
        status: 'answer',
        ids: ['sales/flight', 'sales/hotel', 'sales/review'],
      } as const;
    if (/رسید/.test(q))
      return { status: 'answer', ids: ['sales/receipt'] } as const;
    if (/قرارداد.*(?:بزن|جدید|ثبت کنم)|(?:ثبت|ایجاد).*قرارداد/.test(q))
      return { status: 'answer', ids: ['sales/create'] } as const;
  }
  if (/پیگیری.*از کجا|از کجا.*پیگیری/.test(q))
    return { status: 'clarify' } as const;
  return null;
}

export function prefersTravelIssuanceGuide(
  message: string,
  guide: ReturnType<typeof resolvePilotGuide>,
) {
  if (!guide) return false;
  const question = normalizeQuestion(message);
  if (/\d{4,}|شماره قرارداد|وضعیت همین/.test(question)) return false;
  if (guide.status === 'insufficient')
    return /واچر.*باطل|صدور مجدد/.test(question);
  return (
    guide.status === 'answer' &&
    guide.ids[0]?.startsWith('travel-issuance/') &&
    /صدور|صادر|تحویل|واچر.*بگیر|واچر.*دریافت/.test(question)
  );
}

export function pilotGuideResponse(
  message: string,
  panel: string,
  previous: string | undefined,
  canOpen: (href: string) => boolean,
) {
  const decision = resolvePilotGuide(message, panel, previous);
  if (!decision || decision.status !== 'answer')
    return { status: decision?.status ?? 'unmatched', sections: [] };
  const sections = decision.ids.flatMap((ref) => {
    const [domain, id] = ref.split('/');
    if (!domain || !isAssistantGuideModule(domain)) return [];
    const section = assistantGuideSection(domain, id);
    return section && canOpen(section.href) ? [{ ...section, ref }] : [];
  });
  if (sections[0]?.ref !== decision.ids[0])
    return { status: 'insufficient', sections: [] };
  return { status: 'answer', sections };
}
