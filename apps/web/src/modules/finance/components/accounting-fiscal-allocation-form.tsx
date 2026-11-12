'use client';

import { Save, X } from 'lucide-react';
import { Input, FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { AccountingButton as Button } from './accounting-operations';

export type FiscalAllocationDraft = {
  id?: string;
  version?: number;
  fiscalYearId: string;
  fiscalYearCode: string;
  startDate: string;
  endDate: string;
};

export function normalizeFiscalYearCode(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function AccountingFiscalAllocationForm({
  draft,
  locked,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: FiscalAllocationDraft;
  locked: boolean;
  onChange: (draft: FiscalAllocationDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-3 border p-3"
      aria-label="تخصیص سال مالی"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked) onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <FormField label="سال *" id="ledger-year-code">
          <Input
            id="ledger-year-code"
            required
            inputMode="numeric"
            pattern="[1-9][0-9]{0,3}"
            maxLength={4}
            disabled={locked}
            value={draft.fiscalYearCode}
            onChange={(event) =>
              onChange({
                ...draft,
                fiscalYearId: '',
                fiscalYearCode: normalizeFiscalYearCode(event.target.value),
              })
            }
          />
        </FormField>
        <FormField label="تاریخ شروع *" id="ledger-start">
          <DatePicker
            id="ledger-start"
            required
            disabled={locked}
            value={draft.startDate}
            onChange={(value) => onChange({ ...draft, startDate: value })}
          />
        </FormField>
        <FormField label="تاریخ پایان *" id="ledger-end">
          <DatePicker
            id="ledger-end"
            required
            disabled={locked}
            value={draft.endDate}
            onChange={(value) => onChange({ ...draft, endDate: value })}
          />
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          aria-label="ذخیره تخصیص سال مالی"
          title="ذخیره تخصیص سال مالی"
          disabled={locked}
          permission="finance.account.manage"
        >
          <Save className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="بستن تخصیص"
          title="بستن تخصیص"
          disabled={locked}
          onClick={onCancel}
        >
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
