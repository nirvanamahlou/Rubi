/** Pure domain rules; no database, transport, owner repository or mutable globals. */
import type { ProcurementDraftV1 } from '@nora/contracts';

export class ProcurementRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}
export function requireRule(
  condition: unknown,
  code: string,
  message: string,
  field?: string,
): asserts condition {
  if (!condition) throw new ProcurementRuleError(code, message, field);
}

const scale = 10000n;
/** Fixed-point Decimal(24,4), rejects silent rounding, exponent and binary float inputs. */
export function decimal(value: unknown, field = 'amount'): bigint {
  requireRule(
    typeof value === 'string' && /^(0|[1-9]\d{0,19})(\.\d{1,4})?$/.test(value),
    'VALIDATION_ERROR',
    'مقدار باید عدد اعشاری نامنفی با حداکثر چهار رقم اعشار باشد.',
    field,
  );
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * scale + BigInt(fraction.padEnd(4, '0'));
}
export function decimalString(value: bigint): string {
  requireRule(
    value >= 0n && value < 10n ** 24n,
    'AMOUNT_OUT_OF_RANGE',
    'مبلغ خارج از محدوده است.',
  );
  const fraction = (value % scale)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return `${value / scale}${fraction ? `.${fraction}` : ''}`;
}
export function multiply(a: string, b: string): string {
  const product = decimal(a) * decimal(b);
  requireRule(
    product % scale === 0n,
    'ROUNDING_POLICY_REQUIRED',
    'محاسبه به سیاست گردکردن مصوب نیاز دارد.',
  );
  return decimalString(product / scale);
}
export type CommercialLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  extraCost: string;
};
export function lineTotal(line: CommercialLine): string {
  requireRule(
    decimal(line.quantity, 'quantity') > 0n,
    'VALIDATION_ERROR',
    'مقدار باید بیشتر از صفر باشد.',
    'quantity',
  );
  const gross = decimal(multiply(line.quantity, line.unitPrice));
  const discount = decimal(line.discount, 'discount');
  requireRule(
    discount <= gross,
    'INVALID_DISCOUNT',
    'تخفیف از مبلغ ردیف بیشتر است.',
  );
  return decimalString(
    gross -
      discount +
      decimal(line.tax, 'tax') +
      decimal(line.extraCost, 'extraCost'),
  );
}
export function documentTotal(lines: CommercialLine[]): string {
  requireRule(
    lines.length > 0 && lines.length <= 100,
    'VALIDATION_ERROR',
    'یک تا صد ردیف لازم است.',
  );
  requireRule(
    new Set(lines.map((line) => line.itemId)).size === lines.length,
    'DUPLICATE_ITEM',
    'ردیف تکراری مجاز نیست.',
  );
  return decimalString(
    lines.reduce((total, line) => total + decimal(lineTotal(line)), 0n),
  );
}
export function validateSubmission(draft: ProcurementDraftV1): void {
  for (const field of [
    'title',
    'unitId',
    'purchaseType',
    'category',
    'needReason',
    'requiredAt',
  ] as const)
    requireRule(
      draft[field]?.trim(),
      'VALIDATION_ERROR',
      'این فیلد برای ارسال لازم است.',
      field,
    );
  requireRule(
    draft.currencyCode,
    'VALIDATION_ERROR',
    'ارز را انتخاب کنید.',
    'currencyCode',
  );
  if (draft.estimatedAmount !== null)
    decimal(draft.estimatedAmount, 'estimatedAmount');
  requireRule(
    draft.items.length > 0,
    'VALIDATION_ERROR',
    'حداقل یک قلم لازم است.',
    'items',
  );
  for (const item of draft.items) {
    requireRule(
      item.description.trim() && item.unit.trim(),
      'VALIDATION_ERROR',
      'شرح و واحد هر قلم لازم است.',
      'items',
    );
    requireRule(
      decimal(item.quantity, 'quantity') > 0n,
      'VALIDATION_ERROR',
      'مقدار قلم باید مثبت باشد.',
      'items',
    );
  }
}
export type ApprovalPolicy = {
  id: string;
  version: number;
  source: string;
  approvedAt: string;
  branchId: string;
  unitId: string;
  category: string;
  currencyCode: string;
  maximumAmount: string;
  allowUnknownEstimate: boolean;
  emergencyAllowed: boolean;
  minimumQuotations: number;
  singleSourceAllowed: boolean;
  steps: {
    userId: string;
    maximumAmount: string;
    permission: 'procurement.approve';
  }[];
};
export function validatePolicy(
  policy: ApprovalPolicy | null,
  draft: ProcurementDraftV1,
  requester: string,
): asserts policy is ApprovalPolicy {
  requireRule(
    policy,
    'POLICY_NOT_CONFIGURED',
    'سیاست مصوب خرید پیکربندی نشده است؛ پیش‌نویس محفوظ است.',
  );
  requireRule(
    policy.version > 0 &&
      policy.source &&
      Number.isFinite(Date.parse(policy.approvedAt)),
    'POLICY_NOT_CONFIGURED',
    'منشأ سیاست معتبر نیست.',
  );
  requireRule(
    policy.branchId === draft.branchId &&
      policy.unitId === draft.unitId &&
      policy.category === draft.category &&
      policy.currencyCode === draft.currencyCode,
    'POLICY_NOT_CONFIGURED',
    'سیاست معتبر برای این شعبه، واحد، دسته و ارز موجود نیست.',
  );
  requireRule(
    !draft.urgent || policy.emergencyAllowed,
    'EMERGENCY_NOT_AUTHORIZED',
    'خرید اضطراری مجاز نشده است.',
  );
  requireRule(
    draft.estimatedAmount !== null || policy.allowUnknownEstimate,
    'ESTIMATE_REQUIRED',
    'سیاست به برآورد مبلغ نیاز دارد.',
  );
  if (draft.estimatedAmount !== null)
    requireRule(
      decimal(draft.estimatedAmount) <= decimal(policy.maximumAmount),
      'APPROVAL_LIMIT_EXCEEDED',
      'مبلغ خارج از سقف سیاست است.',
    );
  requireRule(
    policy.steps.length > 0 &&
      policy.steps.every((step) => step.userId !== requester),
    'NO_VALID_APPROVER',
    'تأییدکننده مستقل معتبر وجود ندارد.',
  );
  requireRule(
    new Set(policy.steps.map((step) => step.userId)).size ===
      policy.steps.length,
    'NO_VALID_APPROVER',
    'مراحل تأیید باید مسئول مستقل داشته باشند.',
  );
  for (const step of policy.steps) {
    requireRule(
      step.userId.trim() && step.permission === 'procurement.approve',
      'NO_VALID_APPROVER',
      'هویت یا مجوز تأییدکننده معتبر نیست.',
    );
    if (draft.estimatedAmount !== null)
      requireRule(
        decimal(draft.estimatedAmount) <= decimal(step.maximumAmount),
        'APPROVAL_LIMIT_EXCEEDED',
        'مبلغ از سقف تأییدکننده بیشتر است.',
      );
  }
  requireRule(
    Number.isInteger(policy.minimumQuotations) && policy.minimumQuotations >= 1,
    'POLICY_NOT_CONFIGURED',
    'سیاست استعلام معتبر نیست.',
  );
}
export function assertReceipt(
  ordered: string,
  receivedBefore: string,
  received: string,
  accepted: string,
  rejected: string,
) {
  const quantity = decimal(received);
  requireRule(
    quantity > 0n && decimal(receivedBefore) + quantity <= decimal(ordered),
    'RECEIPT_EXCEEDS_ORDER',
    'دریافت از مقدار مصوب بیشتر است.',
  );
  requireRule(
    decimal(accepted) + decimal(rejected) <= quantity,
    'INVALID_ACCEPTANCE',
    'جمع پذیرش و رد از دریافت بیشتر است.',
  );
}
export type MatchLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  extraCost: string;
};
export function matchInvoice(
  orderCurrency: string,
  invoiceCurrency: string,
  ordered: MatchLine[],
  accepted: Map<string, string>,
  previouslyInvoiced: Map<string, string>,
  invoice: MatchLine[],
) {
  const issues: { itemId: string | null; code: string }[] = [];
  if (orderCurrency !== invoiceCurrency)
    issues.push({ itemId: null, code: 'CURRENCY_MISMATCH' });
  documentTotal(invoice);
  for (const line of invoice) {
    const order = ordered.find((item) => item.itemId === line.itemId);
    if (!order) {
      issues.push({ itemId: line.itemId, code: 'ITEM_MISMATCH' });
      continue;
    }
    if (decimal(line.unitPrice) !== decimal(order.unitPrice))
      issues.push({ itemId: line.itemId, code: 'PRICE_MISMATCH' });
    const cumulative =
      decimal(previouslyInvoiced.get(line.itemId) ?? '0') +
      decimal(line.quantity);
    if (
      cumulative > decimal(accepted.get(line.itemId) ?? '0') ||
      cumulative > decimal(order.quantity)
    )
      issues.push({ itemId: line.itemId, code: 'QUANTITY_MISMATCH' });
    // Absolute discount/tax/cost must not exceed the explicitly approved allocation.
    for (const field of ['discount', 'tax', 'extraCost'] as const)
      if (
        decimal(line[field]) * decimal(order.quantity) !==
        decimal(order[field]) * decimal(line.quantity)
      )
        issues.push({
          itemId: line.itemId,
          code: `${field.toUpperCase()}_MISMATCH`,
        });
  }
  return {
    matched: issues.length === 0,
    issues,
    amount: documentTotal(invoice),
  };
}
export function normalizeInvoiceNumber(value: string): string {
  requireRule(
    !Array.from(value).some(
      (char) =>
        char.charCodeAt(0) < 32 ||
        (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159),
    ),
    'VALIDATION_ERROR',
    'شماره فاکتور دارای کاراکتر کنترلی است.',
  );
  const normalized = value
    .normalize('NFKC')
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x6f0 : 0x660)),
    )
    .trim()
    .replace(/[\s\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/g, '')
    .toUpperCase();
  requireRule(
    normalized.length > 0 && normalized.length <= 100,
    'VALIDATION_ERROR',
    'شماره فاکتور معتبر لازم است.',
  );
  return normalized;
}
