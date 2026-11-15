'use client';
import { useFinanceFiscalContext } from '../finance-fiscal-context';

export function FinanceFiscalSelector() {
  const fiscal = useFinanceFiscalContext();
  if (!fiscal?.active) return null;
  return (
    <div
      className="flex min-w-40 items-center gap-2 text-xs"
      data-finance-fiscal-year
    >
      <label htmlFor="header-finance-fiscal-year" className="shrink-0">
        سال مالی:
      </label>
      <select
        id="header-finance-fiscal-year"
        aria-label="انتخاب سال مالی فعال"
        className="h-9 min-w-0 max-w-60 rounded-lg border border-input bg-surface px-2 text-foreground"
        disabled={
          fiscal.loading ||
          fiscal.writing ||
          !!fiscal.error ||
          fiscal.data?.isAggregate
        }
        value={fiscal.period?.id ?? ''}
        onChange={(event) =>
          fiscal.select(
            event.target.value === fiscal.data?.defaultPeriodId
              ? ''
              : event.target.value,
          )
        }
      >
        {!fiscal.period && (
          <option value="" disabled>
            {fiscal.error
              ? 'دریافت ناموفق'
              : fiscal.loading
                ? 'در حال دریافت…'
                : fiscal.data?.isAggregate
                  ? 'یک شرکت انتخاب کنید'
                  : 'تعریف نشده'}
          </option>
        )}
        {fiscal.data?.periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.title}
            {period.isDefault ? ' (پیش‌فرض)' : ''}
            {!period.yearActive
              ? ' (بایگانی)'
              : period.status !== 'OPEN'
                ? ' (بسته)'
                : ''}
          </option>
        ))}
      </select>
      {fiscal.temporary && (
        <button
          type="button"
          className="text-primary underline"
          disabled={fiscal.writing}
          onClick={() => fiscal.select('')}
        >
          بازگشت به پیش‌فرض
        </button>
      )}
      {fiscal.error && (
        <button type="button" onClick={fiscal.reload} className="underline">
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
