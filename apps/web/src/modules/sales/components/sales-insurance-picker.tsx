'use client';
import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { SalesThemedSelect } from './sales-themed-select';
import {
  loadSalesInsurancePlans,
  selectSalesInsurance,
  type SalesInsuranceSelection,
} from '../model/sales-insurance';

export function salesInsuranceDisplayName(
  plan: Pick<MasterDataRecord, 'name' | 'attributes'>,
) {
  const insurerName = String(plan.attributes.insurerName ?? '').trim();
  return `${plan.name.trim()}${insurerName ? ` — ${insurerName}` : ''}`;
}

export function SalesInsurancePicker({
  value,
  refreshRevision = 0,
  onChange,
  onReady,
  automaticIssue = false,
  onAutomaticIssueChange,
}: {
  refreshRevision?: number;
  value?: SalesInsuranceSelection | undefined;
  onChange: (selection: SalesInsuranceSelection) => void;
  onReady: (ready: boolean) => void;
  automaticIssue?: boolean;
  onAutomaticIssueChange?: (checked: boolean) => void;
}) {
  const [plans, setPlans] = useState<MasterDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadSalesInsurancePlans()
      .then((items) => {
        if (!cancelled) {
          setPlans(items);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت بیمه‌ها ناموفق بود.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, refreshRevision]);
  const selected = plans.find((plan) => plan.id === value?.id);
  useEffect(() => {
    onReady(!loading && !error && Boolean(selected));
  }, [loading, error, selected, onReady]);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="font-bold">انتخاب بیمه سفر</h3>
      <SalesThemedSelect
        label="طرح بیمه"
        required
        value={selected?.id ?? ''}
        disabled={loading || Boolean(error) || !plans.length}
        options={plans.map((plan) => ({
          value: plan.id,
          label: salesInsuranceDisplayName(plan),
        }))}
        onValueChange={(id) => {
          const plan = plans.find((item) => item.id === id);
          if (plan) onChange(selectSalesInsurance(plan));
        }}
      />
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          در حال دریافت طرح‌های بیمه…
        </p>
      ) : error || !plans.length ? (
        <div className="space-y-2">
          <p
            role={error ? 'alert' : 'status'}
            className="text-sm text-muted-foreground"
          >
            {error ||
              'طرح بیمه فعالی ثبت نشده است؛ ابتدا در اطلاعات پایه بیمه، طرح را ثبت کنید.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true);
              setError('');
              setAttempt((n) => n + 1);
            }}
          >
            دریافت دوباره فهرست
          </Button>
        </div>
      ) : value && !selected ? (
        <p role="alert" className="text-sm text-destructive">
          طرح قبلی در فهرست فعال نیست؛ دوباره انتخاب کنید.
        </p>
      ) : null}
      <label className="flex items-center gap-2 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={automaticIssue}
          onChange={(event) => onAutomaticIssueChange?.(event.target.checked)}
        />
        صدور خودکار بیمه
      </label>
      <p className="text-xs text-muted-foreground">
        با فعال‌کردن این گزینه، هنگام ورود قرارداد به رزرواسیون درخواست صدور
        بیمهٔ مسافران ارسال می‌شود؛ نتیجه و علت خطا در بیمه‌نامه قابل مشاهده
        است.
      </p>
    </section>
  );
}
