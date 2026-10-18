'use client';
import type { SalesFormState } from '../model/sales-form';
import { MoneyInput } from '@/components/ui/money-input';
export function AgencyCommission({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: (
    commission: NonNullable<SalesFormState['agencyCommission']>,
  ) => void;
}) {
  if (state.customerKind !== 'organization') return null;
  const value = state.agencyCommission ?? { adult: '', child: '' };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">کمیسیون آژانس</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span>کمیسیون هر بزرگسال (ریال)</span>
          <MoneyInput
            aria-label="کمیسیون هر بزرگسال (ریال)"
            value={value.adult}
            onValueChange={(adult) => onChange({ ...value, adult })}
          />
        </label>
        <label className="space-y-2">
          <span>کمیسیون هر کودک (ریال)</span>
          <MoneyInput
            aria-label="کمیسیون هر کودک (ریال)"
            value={value.child}
            onValueChange={(child) => onChange({ ...value, child })}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        کمیسیون در ستون هر مسافر نمایش داده می‌شود و از مبلغ کل قرارداد کسر
        نمی‌شود.
      </p>
    </section>
  );
}
