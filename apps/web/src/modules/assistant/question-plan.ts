import { normalizeQuestion } from './question-text';
import { asksWorkbenchRequestStatus } from './workbench-request-guide';
import { resolveOperationalMetric } from './operational-metrics';
import { panelIntent } from './planned-operational-intent';

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

export function mightNeedModelPlan(message: string) {
  const text = normalizeQuestion(message);
  return (
    text.length >= 28 &&
    /(?: و | همچنین | ضمنا | بعلاوه | علاوه بر | بعدش )/u.test(text) &&
    (figure.test(text) || /گزارش|بده|بگیر/u.test(text)) &&
    procedure.test(text)
  );
}

export function planQuestion(message: string, previous = ''): PlannedRead[] {
  const clauses = message
    .trim()
    .split(
      /(?:\s+(?:و|بعدش|بعد)\s+(?=(?:(?:بهم |هم )?(?:بگو |بگین )?)?(?:چطور|چجور|چگونه|راهنما|مراحل|از کجا|کجا باید|درخواستم|تعداد|مجموع|مبلغ|چند|چقدر))|[؟?؛;]\s*(?=\S)|[،,]\s*(?=(?:(?:و |بهم |بگو )*)(?:چطور|چجور|راهنما|از کجا|تعداد|مجموع)))/u,
    )
    .map((part) => part.replace(/^(?:(?:و|هم|بهم|بگو)\s+)+/u, '').trim())
    .filter(Boolean);
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
