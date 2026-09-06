'use client';

import { useId, useState } from 'react';
import {
  Plus,
  Trash2,
  WalletCards,
  ShieldCheck,
  ReceiptText,
} from 'lucide-react';
import type {
  MasterDataRecord,
  SalesPaymentInput,
  SalesPaymentMethod,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { SalesDatePicker } from './sales-date-picker';
import { SearchableReference } from './searchable-reference';
import {
  SalesCurrencySelect,
  defaultSalesCurrency,
  type SalesCurrency,
} from './sales-currency-select';

const methods = [
  { id: 'BANK_TRANSFER', name: 'حواله بانکی', code: '' },
  { id: 'CASH', name: 'نقد', code: '' },
  { id: 'POS', name: 'کارت‌خوان', code: '' },
  { id: 'ONLINE_GATEWAY', name: 'درگاه', code: '' },
  { id: 'CHECK', name: 'چک', code: '' },
];
export function withPaymentMethod(
  payment: SalesPaymentInput,
  method: SalesPaymentMethod,
): SalesPaymentInput {
  return {
    ...payment,
    method,
    check: method === 'CHECK' ? payment.check : undefined,
  };
}

export function SalesPaymentPlan({
  payments,
  currencies,
  banks,
  disabled = false,
  onChange,
}: {
  payments: SalesPaymentInput[];
  currencies: readonly SalesCurrency[];
  banks: readonly MasterDataRecord[];
  disabled?: boolean;
  onChange: (payments: SalesPaymentInput[]) => void;
}) {
  const id = useId();
  const [removing, setRemoving] = useState<number | null>(null);
  const change = (index: number, payment: SalesPaymentInput) =>
    onChange(
      payments.map((item, position) => (position === index ? payment : item)),
    );
  const add = () => {
    setRemoving(null);
    onChange([
      ...payments,
      {
        amount: '',
        currencyCode: defaultSalesCurrency(currencies),
        dueAt: '',
        method: 'BANK_TRANSFER',
      },
    ]);
  };
  const checkCount = payments.filter(
    (payment) => payment.method === 'CHECK',
  ).length;
  return (
    <section
      aria-label="برنامه پرداخت قرارداد"
      className="rounded-2xl border border-border bg-surface shadow-xs"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold">برنامه پرداخت قرارداد</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {payments.length.toLocaleString('fa-IR')} پرداخت
              {checkCount ? ` · ${checkCount.toLocaleString('fa-IR')} چک` : ''}{' '}
              · مبلغ و سررسید هر پرداخت را مشخص کنید.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={add} disabled={disabled}>
          <Plus className="size-4" />
          افزودن پرداخت
        </Button>
      </header>
      <div className="space-y-3 p-3 sm:p-4">
        {!payments.length ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="text-sm font-semibold">
              هنوز پرداختی برنامه‌ریزی نشده
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {disabled
                ? 'خدمات انتخاب‌شده بدون هزینه هستند و پرداخت جدا ندارند.'
                : 'برای پرداخت یکجا یا قسطی، ردیف پرداخت اضافه کنید.'}
            </p>
          </div>
        ) : null}
        {payments.map((payment, index) => {
          const rowId = `${id}-${index}`;
          const updateCheck = (
            patch: Partial<NonNullable<SalesPaymentInput['check']>>,
          ) =>
            change(index, {
              ...payment,
              check: {
                bankId: '',
                secureIdentifier: '',
                ownerName: '',
                dueDate: '',
                ...payment.check,
                ...patch,
              },
            });
          return (
            <article
              key={index}
              aria-label={`پرداخت ${index + 1}`}
              className="rounded-xl border border-border bg-background/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {(index + 1).toLocaleString('fa-IR')}
                  </span>
                  <span className="text-sm font-semibold">
                    {methods.find((method) => method.id === payment.method)
                      ?.name ?? 'پرداخت'}
                  </span>
                  {payment.amount ? (
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {formatSalesMoney(payment.amount)} {payment.currencyCode}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`حذف پرداخت ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setRemoving(index)}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </div>
              {removing === index ? (
                <div
                  role="alert"
                  className="mx-3 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/5 p-3 text-sm"
                >
                  <span>این پرداخت از برنامه حذف شود؟</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRemoving(null)}
                    >
                      انصراف
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        onChange(
                          payments.filter((_, position) => position !== index),
                        );
                        setRemoving(null);
                      }}
                    >
                      تأیید حذف
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="grid items-start gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
                <FormField id={`${rowId}-amount`} label="مبلغ پرداخت" required>
                  <MoneyInput
                    id={`${rowId}-amount`}
                    className="h-10"
                    dir="ltr"
                    value={payment.amount}
                    placeholder="مثلاً 10,000,000"
                    onValueChange={(amount) =>
                      change(index, { ...payment, amount })
                    }
                  />
                </FormField>
                <SalesCurrencySelect
                  label="ارز"
                  currencies={currencies}
                  value={payment.currencyCode}
                  onChange={(currencyCode) =>
                    change(index, { ...payment, currencyCode })
                  }
                />
                <SearchableReference
                  label="روش پرداخت"
                  options={methods}
                  value={payment.method}
                  onChange={(method) =>
                    change(
                      index,
                      withPaymentMethod(payment, method as SalesPaymentMethod),
                    )
                  }
                />
                <FormField id={`${rowId}-due`} label="سررسید پرداخت" required>
                  <SalesDatePicker
                    id={`${rowId}-due`}
                    className="h-10"
                    includeTime
                    value={payment.dueAt}
                    onChange={(dueAt) => change(index, { ...payment, dueAt })}
                  />
                </FormField>
              </div>
              {payment.method === 'CHECK' ? (
                <section
                  aria-label={`اطلاعات چک پرداخت ${index + 1}`}
                  className="mx-3 mb-3 rounded-xl border border-primary/10 bg-primary/5 p-3"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                    <ReceiptText className="size-4" aria-hidden="true" />
                    اطلاعات چک
                  </div>
                  <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FormField
                      id={`${rowId}-identifier`}
                      label="شناسه امن چک"
                      required
                    >
                      <Input
                        id={`${rowId}-identifier`}
                        className="h-10"
                        value={payment.check?.secureIdentifier ?? ''}
                        onChange={(event) =>
                          updateCheck({ secureIdentifier: event.target.value })
                        }
                      />
                    </FormField>
                    <SearchableReference
                      label="بانک صادرکننده"
                      options={banks}
                      value={payment.check?.bankId ?? ''}
                      onChange={(bankId) => updateCheck({ bankId })}
                    />
                    <FormField
                      id={`${rowId}-owner`}
                      label="نام صاحب چک"
                      required
                    >
                      <Input
                        id={`${rowId}-owner`}
                        className="h-10"
                        value={payment.check?.ownerName ?? ''}
                        onChange={(event) =>
                          updateCheck({ ownerName: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField
                      id={`${rowId}-check-date`}
                      label="تاریخ سررسید چک"
                      required
                    >
                      <SalesDatePicker
                        id={`${rowId}-check-date`}
                        className="h-10"
                        value={payment.check?.dueDate ?? ''}
                        onChange={(dueDate) => updateCheck({ dueDate })}
                      />
                    </FormField>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    با تغییر روش پرداخت، اطلاعات چک از این ردیف حذف می‌شود.
                  </p>
                </section>
              ) : null}
            </article>
          );
        })}
        <p className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          این بخش فقط برنامهٔ پرداخت است؛ مانده قرارداد تنها پس از تأیید دریافت
          وجه توسط واحد مالی کاهش می‌یابد.
        </p>
      </div>
    </section>
  );
}
