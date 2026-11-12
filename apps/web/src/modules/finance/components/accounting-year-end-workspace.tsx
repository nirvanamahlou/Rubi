'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingCommandV1,
} from '@nora/contracts';
import { AccountingButton } from './accounting-operations';
import { FormField, Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { AccountingObservedYearEnd } from './accounting-observed-year-end';

export function AccountingYearEndWorkspace({
  mode,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  mode: 'closing' | 'opening' | 'final' | 'nature-adjustment';
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
}) {
  if (mode === 'closing' || mode === 'nature-adjustment')
    return <AccountingObservedYearEnd key={mode} mode={mode} />;
  return <ObservedCarryForm key={mode} mode={mode} />;
}

/** Source blocks issue before the next stage; do not infer account/type selectors or execute a financial command. */
function ObservedCarryForm({ mode }: { mode: 'opening' | 'final' }) {
  const [date, setDate] = useState('');
  const [auxiliaryNumber, setAuxiliaryNumber] = useState('');
  const [reverseNature, setReverseNature] = useState(true);
  const title = mode === 'opening' ? 'صدور سند افتتاحیه' : 'صدور سند اختتامیه';
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <p role="status" className="text-sm text-muted-foreground">
        مراحل بعدی در راهکاران قابل مشاهده نیست
      </p>
      <fieldset className="grid gap-4 rounded border p-4 sm:grid-cols-2">
        <legend className="px-2 font-bold">ورود اطلاعات</legend>
        <FormField id="carry-date" label="تاریخ سند" required>
          <DatePicker
            id="carry-date"
            aria-label="تاریخ سند"
            required
            value={date}
            onChange={setDate}
          />
        </FormField>
        <FormField id="carry-auxiliary-number" label="شماره فرعی">
          <Input
            id="carry-auxiliary-number"
            value={auxiliaryNumber}
            onChange={(event) => setAuxiliaryNumber(event.target.value)}
          />
        </FormField>
        {mode === 'opening' ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reverseNature}
              onChange={(event) => setReverseNature(event.target.checked)}
            />
            صدور سند معکوس تعدیل ماهیت
          </label>
        ) : null}
      </fieldset>
      <AccountingButton
        type="button"
        disabled
        title="مراحل بعدی در راهکاران قابل مشاهده نیست"
      >
        {title}
      </AccountingButton>
    </section>
  );
}
