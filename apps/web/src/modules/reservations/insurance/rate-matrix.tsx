import type { InsuranceRateBandV1 } from '@nora/contracts';
import { currencySymbol } from '@/lib/currency-symbol';
import styles from './workspace.module.css';

export function InsuranceRateMatrix({
  rates,
}: {
  rates: InsuranceRateBandV1[];
}) {
  const ages = [
    ...new Map(
      rates.map((r) => [
        r.minAge + ':' + r.maxAge,
        [r.minAge, r.maxAge] as const,
      ]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const durations = [
    ...new Map(
      rates.map((r) => [
        r.minDays + ':' + r.maxDays,
        [r.minDays, r.maxDays] as const,
      ]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!rates.length) return null;
  return (
    <section className={styles.stack} aria-label="جدول نرخ بیمه">
      <h3>جدول نرخ بیمه</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>مدت سفر (روز)</th>
              {ages.map(([min, max]) => (
                <th key={min + ':' + max}>
                  {min}–{max} سال
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {durations.map(([minDays, maxDays]) => (
              <tr key={minDays + ':' + maxDays}>
                <th>
                  {minDays}–{maxDays}
                </th>
                {ages.map(([minAge, maxAge]) => {
                  const rate = rates.find(
                    (r) =>
                      r.minDays === minDays &&
                      r.maxDays === maxDays &&
                      r.minAge === minAge &&
                      r.maxAge === maxAge,
                  );
                  return (
                    <td dir="ltr" key={minAge + ':' + maxAge}>
                      {rate?.amount
                        ? rate.amount + ' ' + currencySymbol(rate.currencyCode)
                        : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
