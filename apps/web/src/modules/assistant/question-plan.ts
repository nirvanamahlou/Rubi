import { normalizeQuestion } from './question-text';
import { asksWorkbenchRequestStatus } from './workbench-request-guide';
import { resolveOperationalMetric } from './operational-metrics';
import { panelIntent } from './planned-operational-intent';
import {
  analyticalSalesSources,
  joinsSalesMeasures,
  ownContractCountIntent,
} from './planned-sales-intent';

export type PlannedRead = {
  kind:
    | 'rolling-sales'
    | 'metric'
    | 'report'
    | 'operational'
    | 'request'
    | 'settled-vouchers'
    | 'guide'
    | 'sales'
    | 'unknown';
  question: string;
  reuseSalesCutoff?: boolean;
};

const procedure =
  /(?:چطور|چجور|چگونه|چه جوری|از کجا|کجا باید|راهنما|مراحل|نحوه)/u;
const figure = /چقدر|چقد|چند|فروش|اطلاعات|فهرست|لیست|تعداد|وضعیت|کدام|کدوم/u;
const fortnight =
  /(?:دو|2) هفته(?: ی)? (?:اخیر|گذشته)|(?:14|چهارده) روز (?:اخیر|گذشته)/u;
const voucherRequest =
  /(?=.*(?:قرارداد|اقامت|هتل))(?=.*تسویه)(?=.*واچر)(?=.*(?:ندار|نداش|فاقد|بدون|صادر نشده)).+/u;

// Keep filters on the data clause. A qualified sales report is sent verbatim to its reader.
export function classify(question: string): PlannedRead {
  const text = normalizeQuestion(question);
  let kind: PlannedRead['kind'] = 'unknown';
  if (asksWorkbenchRequestStatus(question, false)) kind = 'request';
  else if (procedure.test(text)) kind = 'guide';
  else if (voucherRequest.test(text)) kind = 'settled-vouchers';
  else if (/^(?:لطفا )?(?:اجرای گزارش |گزارش .+ اجرا کن$)/u.test(text))
    kind = 'report';
  else if (ownContractCountIntent(text) || analyticalSalesSources(text).length)
    kind = 'sales';
  else if (fortnight.test(text) && /فروش|قرارداد/.test(text))
    kind = 'rolling-sales';
  else if (resolveOperationalMetric(question)) kind = 'metric';
  else if (
    /^(?:لطفا )?(?:اجرای گزارش |گزارش .+ (?:اجرا کن|بگیر|نمایش بده|نشون بده|نشان بده|بده)$)/u.test(
      text,
    )
  )
    kind = 'report';
  else if (panelIntent(question)) kind = 'operational';
  else if (/فروش|قرارداد|مسافر|وصول/.test(text) && figure.test(text))
    kind = 'sales';
  return { kind, question };
}

export function mightNeedModelPlan(
  message: string,
  documentedWorkflow = false,
) {
  const text = normalizeQuestion(message);
  // A conjunction inside one handbook task (e.g. comparing two statuses)
  // is not a request to read records. Keep an independently requested figure
  // or report eligible for planning, even alongside a known instruction.
  if (
    documentedWorkflow &&
    !/(?:چقدر|چندتا|چند تا|چند بود)|(?:^| )(?:بگو|بده|بفرست|استخراج کن|مشخص کن|حساب کن|بشمار|بشمر|بگیر|اجرا کن)(?: |$)/.test(
      text,
    )
  )
    return false;
  return (
    text.length >= 28 &&
    /(?: و | همچنین | ضمنا | بعلاوه | علاوه بر | بعدش )/u.test(text) &&
    (figure.test(text) || /گزارش|بده|بگیر/u.test(text)) &&
    procedure.test(text)
  );
}

export function planQuestion(message: string, previous = ''): PlannedRead[] {
  const original = message.trim();
  // A leading scope or time qualifier belongs to the first task. Keep its
  // original wording (including the comma) for the owner reader.
  const preamble = original.match(/^[^،,؟?؛;]+[،,]\s*/u)?.[0] ?? '';
  const lead = normalizeQuestion(preamble);
  const filterPrefix =
    /^(?:با (?:انتخاب|فیلتر|احتساب|در نظر گرفتن)|در (?:همه|کل|شرکت|شعبه|بازه|دوره)|برای (?:همه|کل|شرکت|شعبه|بازه|دوره)|از تاریخ|بین تاریخ) /.test(
      lead,
    ) &&
    !/چطور|چجور|چگونه|چقدر|چند|کجا|بگو|بده|نشان بده|ثبت کن|اجرا کن|محاسبه کن|چیه|چیست/.test(
      lead,
    )
      ? preamble
      : '';
  const body = original.slice(filterPrefix.length);
  const splits =
    /(?:\s+(?:و|بعدش|بعد)\s+(?=(?:(?:بهم |هم )?(?:بگو |بگین )?)?(?:چطور|چجور|چگونه|راهنما|مراحل|از کجا|کجا باید|درخواستم|تعداد|مجموع|مبلغ|چند|چقدر))|[؟?؛;]\s*(?=\S)|[،,]\s*(?=(?:(?:و |بهم |بگو )*)(?:چطور|چجور|راهنما|از کجا|تعداد|مجموع)))/gu;
  let start = 0;
  const grouped: string[] = [];
  for (const separator of body.matchAll(splits)) {
    const before = body.slice(start, separator.index);
    const after = separator.index + separator[0].length;
    if (joinsSalesMeasures(before, separator[0], body.slice(after))) continue;
    grouped.push(before);
    start = after;
  }
  grouped.push(body.slice(start));
  const clauses = grouped
    .map((part) => part.replace(/^(?:(?:و|هم|بهم|بگو)\s+)+/u, '').trim())
    .filter(Boolean);
  if (filterPrefix && clauses.length) clauses[0] = filterPrefix + clauses[0];
  // A trailing identifier qualifies the preceding request, it is not another task.
  if (
    clauses
      .slice(1)
      .some((s) =>
        /^(?:کد پیگیری|شماره درخواست|شماره قرارداد)\s+/u.test(
          normalizeQuestion(s),
        ),
      )
  )
    return [];
  const parts = clauses.map(classify);
  const normalized = normalizeQuestion(message);
  const sameList =
    /^(?:(?:اطلاعات|فهرست|لیست|جزئیات) )?(?:همون|همان|همین) قرارداد(?:ها|ا| های)(?: (?:رو|را))?(?: (?:هم )?(?:بده|بگو|نشون بده|نمایش بده))?$/u.test(
      normalized,
    );
  if (
    parts.length === 1 &&
    fortnight.test(normalizeQuestion(previous)) &&
    (sameList ||
      /^(?:(?:اطلاعات|فهرست|لیست|جزئیات) )?قرارداد(?:ها| های|هاش|اش).*?(?:همین|همون|همان) (?:دوره|بازه)/u.test(
        normalized,
      ))
  ) {
    return [
      {
        kind: 'rolling-sales',
        reuseSalesCutoff: true,
        question: sameList
          ? 'فهرست قراردادهای دو هفته اخیر رو بده'
          : message.replace(
              /(?:همین|همون|همان) (?:دوره|بازه)/u,
              'دو هفته اخیر',
            ),
      },
    ];
  }
  if (parts.length > 6) return [{ kind: 'unknown', question: message }];
  if (
    parts.length === 1 &&
    parts[0]?.kind === 'sales' &&
    (ownContractCountIntent(normalized) ||
      analyticalSalesSources(normalized).length)
  )
    return parts;
  if (
    parts.length === 1 &&
    parts[0]?.kind === 'request' &&
    /درخواستم|درخواست (?:من|خودم)|مرخصی من|م[اأ]موریت من/.test(normalized)
  )
    return parts;
  if (
    parts.length === 1 &&
    !['rolling-sales', 'settled-vouchers', 'report', 'operational'].includes(
      parts[0]!.kind,
    )
  )
    return [];
  if (
    parts.length > 1 &&
    parts.every((x) => x.kind === 'guide' || x.kind === 'unknown')
  )
    return [];
  return parts;
}
