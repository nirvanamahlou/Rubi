'use client';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';

export function CreatedDateFilter({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const invalid = Boolean(start && end && start > end);
  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onApply(start, end);
      }}
    >
      <FormField label="از تاریخ">
        <DatePicker aria-label="از تاریخ" value={start} onChange={setStart} />
      </FormField>
      <FormField label="تا تاریخ">
        <DatePicker aria-label="تا تاریخ" value={end} onChange={setEnd} />
      </FormField>
      <Button type="submit" disabled={invalid}>
        اعمال بازه
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setStart('');
          setEnd('');
          onApply('', '');
        }}
      >
        پاک‌کردن بازه
      </Button>
      {invalid && (
        <p role="alert" className="w-full text-sm text-destructive">
          تاریخ پایان نباید قبل از تاریخ شروع باشد.
        </p>
      )}
    </form>
  );
}
