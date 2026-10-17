'use client';
import { currencySymbol } from '@/lib/currency-symbol';
import { useEffect, useState } from 'react';
import type { SalesContractProfitV1 } from '@nora/contracts';
import { salesApi } from '@/modules/sales/api/client';
import { Button } from '@/components/ui/button';
import { formatSalesMoney } from '@/components/ui/money-input';
import styles from './contract-profit.module.css';

export function ContractProfitDetails({
  value,
}: {
  value: SalesContractProfitV1;
}) {
  return (
    <div className={styles.details} dir="rtl">
      <p className={styles.explanation}>
        فروش منهای هزینه خرید ثبت‌شده؛ سود هر ارز جداست و تبدیل ارز انجام
        نمی‌شود.
      </p>
      {!value.complete && (
        <div role="status" className={styles.warning}>
          <p>سود هنوز کامل نیست؛ هزینه این خدمات ثبت نشده:</p>
          <ul>
            {value.missingServiceTitles.map((title, index) => (
              <li key={index}>{title}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.tableFrame}>
        <table className={styles.totalsTable}>
          <caption className="sr-only">هزینه خرید و سود قرارداد</caption>
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '40%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">ارز</th>
              <th scope="col">فروش</th>
              <th scope="col">خرید ثبت‌شده</th>
              <th scope="col">سود</th>
            </tr>
          </thead>
          <tbody>
            {value.totals.map((row) => (
              <tr key={row.currencyCode}>
                <th scope="row">
                  <span>{currencySymbol(row.currencyCode)}</span>
                  <bdi dir="ltr" className={styles.currencyCode}>
                    {row.currencyCode}
                  </bdi>
                </th>
                <td>
                  <bdi dir="ltr" className={styles.amount}>
                    {formatSalesMoney(row.salesAmount)}
                  </bdi>
                </td>
                <td>
                  <bdi dir="ltr" className={styles.amount}>
                    {formatSalesMoney(row.purchaseAmount)}
                  </bdi>
                </td>
                <td>
                  {row.profitAmount === null ? (
                    <span className={styles.pending}>
                      در انتظار تکمیل هزینه‌ها
                    </span>
                  ) : (
                    <bdi dir="ltr" className={styles.amount}>
                      {formatSalesMoney(row.profitAmount)}
                    </bdi>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.costs.length > 0 && (
        <section className={styles.costs}>
          <h3>خرید ثبت‌شده</h3>
          <ul>
            {value.costs.map((cost, index) => (
              <li key={cost.referenceId + ':' + index}>
                <div className={styles.costDescription}>
                  <span>{cost.serviceTitles.join('، ')}</span>
                  <small>
                    {cost.source === 'FINANCE_TICKET'
                      ? 'خرید بلیت ثبت‌شده در مالی'
                      : 'خرید رزرواسیون'}
                  </small>
                </div>
                <span className={styles.costAmount}>
                  <bdi dir="ltr">{formatSalesMoney(cost.amount)}</bdi>
                  <span>{currencySymbol(cost.currencyCode)}</span>
                  <bdi dir="ltr" className={styles.currencyCode}>
                    {cost.currencyCode}
                  </bdi>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ContractProfit({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<SalesContractProfitV1 | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    salesApi
      .profit(id)
      .then(({ data }) => {
        if (live) setValue(data);
      })
      .catch((reason: unknown) => {
        if (live)
          setError(
            reason instanceof Error ? reason.message : 'دریافت سود ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [id, open, retry]);
  return (
    <section className={styles.panel} dir="rtl">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setValue(null);
          setError('');
          setOpen((v) => !v);
        }}
      >
        هزینه خرید و سود قرارداد
      </Button>
      {open && (
        <>
          {error ? (
            <p role="alert">
              {error}{' '}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setValue(null);
                  setError('');
                  setRetry((v) => v + 1);
                }}
              >
                تلاش دوباره
              </Button>
            </p>
          ) : !value ? (
            <p role="status">در حال دریافت هزینه‌ها…</p>
          ) : (
            <ContractProfitDetails value={value} />
          )}
        </>
      )}
    </section>
  );
}
