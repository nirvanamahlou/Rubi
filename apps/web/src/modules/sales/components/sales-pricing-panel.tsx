'use client';
import {
  moneyDecimal,
  moneyUnits,
  resolveSalesPrice,
  type SalesServicePricingV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import {
  SalesCurrencySelect,
  defaultSalesCurrency,
  type SalesCurrency,
} from './sales-currency-select';
import {
  MoneyInput as SalesMoneyInput,
  formatSalesMoney,
} from '@/components/ui/money-input';
import { useState } from 'react';
export function SalesPricingPanel({
  services,
  nights,
  values,
  currencies,
  onChange,
}: {
  services: readonly { key: string; title: string; hotel: boolean }[];
  nights: number;
  values: Record<string, SalesServicePricingV1[]>;
  currencies: readonly SalesCurrency[];
  onChange: (key: string, prices: SalesServicePricingV1[]) => void;
}) {
  const [editingBasis, setEditingBasis] = useState<
    Record<string, 'NIGHT' | 'TOTAL'>
  >({});
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">قیمت روز فروش و توافق با مشتری</h2>
      <p className="text-sm text-muted-foreground">
        قیمت‌ها برای کل مسافران و تمام اتاق‌های انتخاب‌شده هستند؛ هر ارز جدا
        محاسبه می‌شود.
      </p>
      {services.map((service) => {
        const defaults: SalesServicePricingV1 = {
          version: 1,
          currencyCode: defaultSalesCurrency(currencies),
          daySale: { basis: service.hotel ? 'NIGHT' : 'TOTAL', amount: '' },
          agreed: { basis: service.hotel ? 'NIGHT' : 'TOTAL', amount: '' },
        };
        const prices = values[service.key] ?? [defaults];
        return (
          <div className="space-y-3 rounded-xl border p-4" key={service.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {service.title}
                {service.hotel ? ` · ${nights.toLocaleString('fa-IR')} شب` : ''}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={prices.length >= 10}
                onClick={() =>
                  onChange(service.key, [
                    ...prices,
                    { ...defaults, currencyCode: '' },
                  ])
                }
              >
                افزودن ارز
              </Button>
            </div>
            {service.hotel ? (
              <p className="text-xs text-muted-foreground">
                هر شب × تعداد شب = کل اقامت. با ورود کل، قیمت متوسط هر شب محاسبه
                می‌شود؛ جمع دقیق حفظ می‌شود.
              </p>
            ) : null}
            {prices.map((price, index) => {
              const change = (next: SalesServicePricingV1) =>
                onChange(
                  service.key,
                  prices.map((item, i) => (i === index ? next : item)),
                );
              let totals: ReturnType<typeof resolveSalesPrice> | null = null;
              try {
                totals = resolveSalesPrice(
                  price,
                  service.hotel ? nights : 1,
                  service.hotel,
                );
              } catch {
                /* Incomplete entries are validated before continuing. */
              }
              return (
                <div
                  key={index}
                  className="space-y-3 rounded-lg bg-muted/20 p-3"
                >
                  <div className="flex items-end gap-2">
                    <SalesCurrencySelect
                      label={`ارز ${service.title} ${index + 1}`}
                      currencies={currencies.filter(
                        (currency) =>
                          currency.code === price.currencyCode ||
                          !prices.some(
                            (other) => other.currencyCode === currency.code,
                          ),
                      )}
                      value={price.currencyCode}
                      onChange={(currencyCode) =>
                        change({ ...price, currencyCode })
                      }
                    />
                    {prices.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onChange(
                            service.key,
                            prices.filter((_, i) => i !== index),
                          )
                        }
                      >
                        حذف ارز
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(['daySale', 'agreed'] as const).map((field) => {
                      const part = price[field],
                        label =
                          field === 'daySale'
                            ? 'قیمت روز فروش'
                            : 'مبلغ توافق‌شده با مشتری';
                      const basisKey = service.key + '-' + index + '-' + field;
                      const entryBasis = editingBasis[basisKey] ?? part.basis;
                      let displayAmount = part.amount;
                      let partTotals: ReturnType<
                        typeof resolveSalesPrice
                      > | null = null;
                      try {
                        partTotals = resolveSalesPrice(
                          {
                            ...price,
                            currencyCode: price.currencyCode || 'IRR',
                            daySale: part,
                            agreed: part,
                          },
                          service.hotel ? nights : 1,
                          service.hotel,
                        );
                      } catch {
                        /* Incomplete field. */
                      }
                      if (entryBasis !== part.basis)
                        displayAmount = partTotals
                          ? entryBasis === 'NIGHT'
                            ? partTotals.dayNight
                            : partTotals.dayTotal
                          : '';
                      return (
                        <div
                          key={field}
                          className="space-y-2 rounded-lg border bg-background p-3"
                        >
                          <p className="font-semibold">{label}</p>
                          {service.hotel ? (
                            <div className="flex gap-1">
                              {(['NIGHT', 'TOTAL'] as const).map((basis) => (
                                <Button
                                  key={basis}
                                  type="button"
                                  size="sm"
                                  aria-pressed={entryBasis === basis}
                                  variant={
                                    entryBasis === basis ? 'secondary' : 'ghost'
                                  }
                                  onClick={() => {
                                    setEditingBasis((current) => ({
                                      ...current,
                                      [basisKey]: basis,
                                    }));
                                  }}
                                >
                                  {basis === 'NIGHT'
                                    ? 'ورود قیمت هر شب'
                                    : 'ورود قیمت کل'}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <SalesMoneyInput
                            aria-label={`${label} ${service.title} ${entryBasis === 'NIGHT' ? 'هر شب' : 'کل'}`}
                            placeholder={
                              entryBasis === 'NIGHT' ? 'مبلغ هر شب' : 'مبلغ کل'
                            }
                            value={displayAmount}
                            onValueChange={(amount) =>
                              change({
                                ...price,
                                [field]: { basis: entryBasis, amount },
                              })
                            }
                          />
                          {service.hotel && partTotals ? (
                            <p className="text-xs">
                              {entryBasis === 'NIGHT'
                                ? `کل اقامت: ${formatSalesMoney(partTotals.dayTotal)}`
                                : `متوسط هر شب (تقریبی): ${formatSalesMoney(partTotals.dayNight)}`}{' '}
                              {price.currencyCode}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {totals ? (
                    <p className="text-sm font-bold text-primary">
                      {totals.discount.startsWith('-')
                        ? 'افزایش توافقی: '
                        : 'تخفیف فروشنده: '}
                      {formatSalesMoney(totals.discount.replace('-', ''))}{' '}
                      {price.currencyCode} · قابل پرداخت:{' '}
                      {formatSalesMoney(totals.agreedTotal)}{' '}
                      {price.currencyCode}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      هر دو مبلغ و ارز را کامل کنید.
                    </p>
                  )}
                </div>
              );
            })}
            {service.hotel ? (
              <p className="text-xs text-muted-foreground">
                هزینه خرید هتل بعداً در رزرواسیون ثبت می‌شود؛ تا آن زمان سود هتل
                مشخص نیست.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                این مبلغ فروش است، نه هزینه خرید. هزینه خرید بلیط در مدیریت بلیط
                باقی می‌ماند.
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function SalesPricingSummary({
  services,
  nights,
  values,
}: {
  services: readonly { key: string; title: string; hotel: boolean }[];
  nights: number;
  values: Record<string, SalesServicePricingV1[]>;
}) {
  const totalsByCurrency = new Map<string, bigint>();
  const rows = services.flatMap((service) =>
    (values[service.key] ?? []).map((price) => {
      const totals = resolveSalesPrice(
        price,
        service.hotel ? nights : 1,
        service.hotel,
      );
      totalsByCurrency.set(
        price.currencyCode,
        (totalsByCurrency.get(price.currencyCode) ?? 0n) +
          moneyUnits(totals.agreedTotal),
      );
      return { service, price, totals };
    }),
  );
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">بازبینی مبلغ قرارداد</h3>
      {rows.map(({ service, price, totals }) => (
        <div
          key={service.key + price.currencyCode}
          className="grid gap-1 border-b pb-2 text-sm sm:grid-cols-3"
        >
          <span>
            {service.title}
            {service.hotel ? ` · ${nights} شب` : ''}
          </span>
          <span>
            قیمت روز کل: {formatSalesMoney(totals.dayTotal)}{' '}
            {price.currencyCode}
          </span>
          <span>
            توافق کل: {formatSalesMoney(totals.agreedTotal)}{' '}
            {price.currencyCode}
          </span>
        </div>
      ))}
      {[...totalsByCurrency].map(([code, amount]) => (
        <p key={code} className="font-bold text-primary">
          جمع توافق‌شده: {formatSalesMoney(moneyDecimal(amount))} {code}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        برنامه پرداخت، به معنی دریافت وجه یا تأیید مالی نیست.
      </p>
    </section>
  );
}
