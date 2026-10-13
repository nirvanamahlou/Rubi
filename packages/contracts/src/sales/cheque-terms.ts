import type { SalesPaymentInput, SalesPriceComponentInput } from './index';
import { moneyDecimal, moneyUnits } from './pricing';

export interface SalesChequePlan {
  currencyCode: string;
  downPayment: string;
  months: 3 | 6 | 9 | 12;
  firstDueDate: string;
}
export interface SalesPaymentTerms {
  version: 1;
  mode: 'CASH' | 'CHECK';
  plans: SalesChequePlan[];
}
export const SALES_CHEQUE_FEE = 'کارمزد فروش چکی ۵٪ ماهیانه';
function paymentDay(value: string): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function salesChequeMinimum(
  principal: string,
  currencyCode: string,
): string {
  const amount = moneyUnits(principal);
  const usual = currencyCode === 'IRR' ? 10000n : 100n;
  const quantum = amount % usual === 0n ? usual : 1n;
  return moneyDecimal(
    ((amount * 30n + 100n * quantum - 1n) / (100n * quantum)) * quantum,
  );
}

/** Calendar months, anchored to the original day and clamped at month end. */
export function salesMonthlyDate(value: string, months: number): string {
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error('تاریخ سررسید چک معتبر نیست.');
  const last = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months + 1, 0),
  );
  return new Date(
    Date.UTC(
      last.getUTCFullYear(),
      last.getUTCMonth(),
      Math.min(parsed.getUTCDate(), last.getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export function salesPrincipal(
  components: readonly SalesPriceComponentInput[],
) {
  const totals = new Map<string, bigint>();
  for (const p of components) {
    if (p.title === SALES_CHEQUE_FEE) continue;
    totals.set(
      p.currencyCode,
      (totals.get(p.currencyCode) ?? 0n) +
        moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
    );
  }
  return [...totals]
    .filter(([, amount]) => amount > 0n)
    .map(([currencyCode, amount]) => ({
      currencyCode,
      amount: moneyDecimal(amount),
    }));
}

export function calculateSalesCheque(principal: string, plan: SalesChequePlan) {
  const amount = moneyUnits(principal);
  const down = moneyUnits(plan.downPayment);
  const minimum = moneyUnits(salesChequeMinimum(principal, plan.currencyCode));
  if (amount <= 0n || down < minimum || down >= amount)
    throw new Error(
      'پیش‌پرداخت فروش چکی باید حداقل ۳۰٪ و کمتر از مبلغ خرید باشد.',
    );
  if (![3, 6, 9, 12].includes(plan.months))
    throw new Error('طرح اقساط معتبر نیست.');
  salesMonthlyDate(plan.firstDueDate, 0);
  const balance = amount - down;
  const usual = plan.currencyCode === 'IRR' ? 10000n : 100n;
  const quantum = amount % usual === 0n && down % usual === 0n ? usual : 1n;
  const fee =
    ((balance * 5n * BigInt(plan.months) + 50n * quantum) / (100n * quantum)) *
    quantum;
  const financed = balance + fee;
  const each = (financed / (BigInt(plan.months) * quantum)) * quantum;
  if (each <= 0n)
    throw new Error('مبلغ مانده برای تعداد چک‌های انتخاب‌شده کافی نیست.');
  const schedule = Array.from({ length: plan.months }, (_, i) => ({
    amount: moneyDecimal(
      i === plan.months - 1 ? financed - each * BigInt(plan.months - 1) : each,
    ),
    dueDate: salesMonthlyDate(plan.firstDueDate, i),
  }));
  return {
    minimum: moneyDecimal(minimum),
    fee: moneyDecimal(fee),
    total: moneyDecimal(amount + fee),
    schedule,
  };
}

export function salesChequeComponents(
  base: readonly SalesPriceComponentInput[],
  terms?: SalesPaymentTerms | null,
): SalesPriceComponentInput[] {
  const principal = base.filter((p) => p.title !== SALES_CHEQUE_FEE);
  if (!terms) return [...base];
  if (
    terms.version !== 1 ||
    !['CASH', 'CHECK'].includes(terms.mode) ||
    !Array.isArray(terms.plans)
  )
    throw new Error('نوع فروش معتبر نیست.');
  if (terms.mode === 'CASH') {
    if (terms.plans.length) throw new Error('فروش نقدی برنامه چکی ندارد.');
    return principal;
  }
  const totals = salesPrincipal(principal);
  if (
    !totals.length ||
    terms.plans.length !== totals.length ||
    new Set(terms.plans.map((p) => p.currencyCode)).size !== totals.length
  )
    throw new Error('برنامه چکی همه ارزهای قرارداد را مشخص کنید.');
  return [
    ...principal,
    ...totals
      .map((total) => {
        const plan = terms.plans.find(
          (p) => p.currencyCode === total.currencyCode,
        );
        if (!plan)
          throw new Error('برنامه چکی همه ارزهای قرارداد را مشخص کنید.');
        return {
          type: 'SURCHARGE' as const,
          title: SALES_CHEQUE_FEE,
          currencyCode: total.currencyCode,
          amount: calculateSalesCheque(total.amount, plan).fee,
        };
      })
      .filter((p) => moneyUnits(p.amount) > 0n),
  ];
}

export function validateSalesChequePayments(
  components: readonly SalesPriceComponentInput[],
  payments: readonly SalesPaymentInput[],
  terms?: SalesPaymentTerms | null,
) {
  if (!terms) return;
  const expected = salesChequeComponents(components, terms);
  const fingerprint = (rows: readonly SalesPriceComponentInput[]) =>
    JSON.stringify(
      rows
        .map((p) => [
          p.type,
          p.title,
          p.currencyCode,
          moneyDecimal(moneyUnits(p.amount)),
        ])
        .sort(),
    );
  if (fingerprint(expected) !== fingerprint(components))
    throw new Error('کارمزد فروش چکی با برنامه اقساط مطابقت ندارد.');
  if (terms.mode === 'CASH') {
    if (payments.some((p) => p.method === 'CHECK'))
      throw new Error('برای پرداخت چکی، نوع فروش چکی را انتخاب کنید.');
    return;
  }
  for (const total of salesPrincipal(components)) {
    const plan = terms.plans.find(
      (p) => p.currencyCode === total.currencyCode,
    )!;
    const result = calculateSalesCheque(total.amount, plan);
    const rows = payments.filter((p) => p.currencyCode === total.currencyCode);
    const down = rows
      .filter((p) => p.method !== 'CHECK')
      .reduce((sum, p) => sum + moneyUnits(p.amount), 0n);
    const checks = rows
      .filter((p) => p.method === 'CHECK')
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    if (
      down !== moneyUnits(plan.downPayment) ||
      checks.length !== result.schedule.length ||
      checks.some(
        (p, i) =>
          moneyUnits(p.amount) !== moneyUnits(result.schedule[i]!.amount) ||
          paymentDay(p.dueAt) !== result.schedule[i]!.dueDate ||
          p.check?.dueDate?.slice(0, 10) !== result.schedule[i]!.dueDate,
      )
    )
      throw new Error(
        'مبلغ پیش‌پرداخت و سررسید چک‌ها باید با ماشین‌حساب اقساط برابر باشد.',
      );
    if (
      checks.some(
        (p) =>
          !p.check ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            p.check.bankId,
          ) ||
          typeof p.check.secureIdentifier !== 'string' ||
          !p.check.secureIdentifier.trim() ||
          p.check.secureIdentifier.length > 160 ||
          typeof p.check.ownerName !== 'string' ||
          !p.check.ownerName.trim() ||
          p.check.ownerName.length > 200,
      )
    )
      throw new Error(
        'بانک، شناسه امن و نام صاحب هر چک را در برنامه پرداخت کامل کنید.',
      );
  }
  if (
    payments.some(
      (p) => !terms.plans.some((plan) => plan.currencyCode === p.currencyCode),
    )
  )
    throw new Error('ارز پرداخت در برنامه اقساط وجود ندارد.');
}
