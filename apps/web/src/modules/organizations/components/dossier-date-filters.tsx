'use client';
import { DatePicker } from '@/components/ui/date-picker';
import type { DossierDateRange } from '../model/dossier-date-range';
export function DossierDateFilters({
  value,
  onChange,
  basis,
}: {
  value: DossierDateRange;
  onChange: (value: DossierDateRange) => void;
  basis: string;
}) {
  return (
    <>
      <div className="field">
        <span>از تاریخ — {basis}</span>
        <DatePicker
          withinDialog
          aria-label={`از تاریخ ${basis}`}
          value={value.from}
          onChange={(from) => onChange({ ...value, from })}
        />
      </div>
      <div className="field">
        <span>تا تاریخ — {basis}</span>
        <DatePicker
          withinDialog
          aria-label={`تا تاریخ ${basis}`}
          value={value.to}
          onChange={(to) => onChange({ ...value, to })}
        />
      </div>
      <button
        type="button"
        className="btn"
        disabled={!value.from && !value.to}
        onClick={() => onChange({ from: '', to: '' })}
      >
        پاک‌کردن تاریخ
      </button>
      {value.from && value.to && value.from > value.to ? (
        <p role="alert" className="form-error dossier-filter-error">
          تاریخ پایان نباید قبل از تاریخ شروع باشد.
        </p>
      ) : null}
    </>
  );
}
