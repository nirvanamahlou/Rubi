'use client';

import { useState } from 'react';
import {
  calculateSalesCheque,
  salesChequeMinimum,
  salesMonthlyDate,
  salesPrincipal,
  validateSalesChequePayments,
  type SalesChequePlan,
  type SalesPaymentTerms,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { SalesDatePicker } from './sales-date-picker';
import {
  salesPayload,
  salesTravelDate,
  type SalesFormState,
} from '../model/sales-form';

export function SalesChequeCalculator({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: (patch: Partial<SalesFormState>) => void;
}) {
  const [error, setError] = useState('');
  let totals: ReturnType<typeof salesPrincipal> = [];
  try {
    totals = salesPrincipal(
      salesPayload({ ...state, paymentTerms: null }).priceComponents,
    );
  } catch {
    /* Incomplete service prices are entered below. */
  }
  const terms = state.paymentTerms;
  let scheduleError = '';
  if (terms?.mode === 'CHECK') {
    try {
      const payload = salesPayload(state);
      validateSalesChequePayments(
        payload.priceComponents,
        state.payments,
        terms,
      );
    } catch (e) {
      scheduleError = e instanceof Error ? e.message : '';
    }
  }
  const change = (next: SalesPaymentTerms) => {
    setError('');
    onChange({ paymentTerms: next });
  };
  const defaults = (): SalesChequePlan[] =>
    totals.map((total) => ({
      currencyCode: total.currencyCode,
      downPayment: salesChequeMinimum(total.amount, total.currencyCode),
      months: 3,
      firstDueDate: salesTravelDate(state)
        ? salesMonthlyDate(salesTravelDate(state), 1)
        : '',
    }));
  const apply = () => {
    try {
      if (!terms || terms.mode !== 'CHECK') return;
      const payments = terms.plans.flatMap((plan) => {
        const total = totals.find((t) => t.currencyCode === plan.currencyCode);
        if (!total) throw new Error('ابتدا مبلغ خدمات را وارد کنید.');
        const result = calculateSalesCheque(total.amount, plan);
        const old = state.payments.filter(
          (p) => p.currencyCode === plan.currencyCode,
        );
        const oldDown = old.find((p) => p.method !== 'CHECK');
        const oldChecks = old
          .filter((p) => p.method === 'CHECK')
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
        return [
          {
            ...oldDown,
            method: oldDown?.method ?? ('BANK_TRANSFER' as const),
            currencyCode: plan.currencyCode,
            amount: plan.downPayment,
            dueAt: oldDown?.dueAt || new Date().toISOString().slice(0, 10),
            check: null,
          },
          ...result.schedule.map((check, i) => ({
            ...oldChecks[i],
            method: 'CHECK' as const,
            currencyCode: plan.currencyCode,
            amount: check.amount,
            dueAt: check.dueDate,
            check: {
              bankId: '',
              secureIdentifier: '',
              ownerName: '',
              ...oldChecks[i]?.check,
              dueDate: check.dueDate,
            },
          })),
        ];
      });
      onChange({ payments });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'محاسبه اقساط انجام نشد.');
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-surface p-4"
      aria-label="نوع فروش و ماشین‌حساب اقساط"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold">نوع فروش</h3>
        {(['CASH', 'CHECK'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            variant={(terms?.mode ?? 'CASH') === mode ? 'primary' : 'secondary'}
            aria-pressed={(terms?.mode ?? 'CASH') === mode}
            onClick={() => {
              if (terms?.mode === mode) return;
              change({
                version: 1,
                mode,
                plans: mode === 'CHECK' ? defaults() : [],
              });
              if (mode === 'CASH')
                onChange({
                  paymentTerms: { version: 1, mode, plans: [] },
                  payments: state.payments.filter((p) => p.method !== 'CHECK'),
                });
            }}
          >
            {mode === 'CASH' ? 'نقدی' : 'چکی'}
          </Button>
        ))}
      </div>
      {terms?.mode === 'CHECK' ? (
        <>
          <p className="text-sm">
            سود ماهیانه ۵٪ روی مانده خرید؛ حداقل پیش‌پرداخت ۳۰٪
          </p>
          {!totals.length ? <p>ابتدا مبلغ خدمات را وارد کنید.</p> : null}
          {totals.map((total) => {
            const plan = terms.plans.find(
              (p) => p.currencyCode === total.currencyCode,
            );
            if (!plan)
              return (
                <Button
                  key={total.currencyCode}
                  type="button"
                  onClick={() => change({ ...terms, plans: defaults() })}
                >
                  به‌روزرسانی ارزهای اقساط
                </Button>
              );
            const patch = (value: Partial<SalesChequePlan>) =>
              change({
                ...terms,
                plans: terms.plans.map((p) =>
                  p.currencyCode === total.currencyCode
                    ? { ...p, ...value }
                    : p,
                ),
              });
            let result: ReturnType<typeof calculateSalesCheque> | undefined;
            let problem = '';
            try {
              result = calculateSalesCheque(total.amount, plan);
            } catch (e) {
              problem = e instanceof Error ? e.message : '';
            }
            return (
              <div
                key={total.currencyCode}
                className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2"
              >
                <div className="space-y-3">
                  <h4 className="font-bold">
                    ماشین‌حساب اقساط · {total.currencyCode}
                  </h4>
                  <p>
                    مبلغ خرید:{' '}
                    <strong dir="ltr">
                      {formatSalesMoney(total.amount)} {total.currencyCode}
                    </strong>
                  </p>
                  <label className="block space-y-1">
                    <span>پیش‌پرداخت (حداقل ۳۰٪)</span>
                    <MoneyInput
                      value={plan.downPayment}
                      onValueChange={(value) => patch({ downPayment: value })}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {([3, 6, 9, 12] as const).map((months) => (
                      <Button
                        key={months}
                        type="button"
                        variant={
                          plan.months === months ? 'primary' : 'secondary'
                        }
                        aria-pressed={plan.months === months}
                        onClick={() => patch({ months })}
                      >
                        {months} ماهه
                      </Button>
                    ))}
                  </div>
                  <label className="block space-y-1">
                    <span>تاریخ اولین چک</span>
                    <SalesDatePicker
                      value={plan.firstDueDate}
                      onChange={(value) => patch({ firstDueDate: value })}
                    />
                  </label>
                  <Input value="۵٪ ماهیانه" readOnly aria-label="سود ماهیانه" />
                </div>
                <div className="space-y-3">
                  {problem ? (
                    <p role="alert" className="text-destructive">
                      {problem}
                    </p>
                  ) : null}
                  {result ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-primary/5 p-3">
                        <p>
                          سود کل
                          <br />
                          <strong dir="ltr">
                            {formatSalesMoney(result.fee)}
                          </strong>
                        </p>
                        <p>
                          جمع قابل پرداخت
                          <br />
                          <strong dir="ltr">
                            {formatSalesMoney(result.total)}
                          </strong>
                        </p>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th>چک</th>
                              <th>سررسید</th>
                              <th>مبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.schedule.map((row, i) => (
                              <tr key={row.dueDate} className="border-b">
                                <td className="p-2">{i + 1}</td>
                                <td dir="ltr">{row.dueDate}</td>
                                <td dir="ltr">
                                  {formatSalesMoney(row.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          <Button type="button" onClick={apply}>
            محاسبه و اعمال برنامه چک‌ها
          </Button>
          {scheduleError ? (
            <p className="text-sm text-destructive">{scheduleError}</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
