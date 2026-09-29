'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/form-controls';

export function parsePassengerCount(value: string): number | null {
  if (!/^\d*$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function PassengerCountField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState({ text: String(value), count: value });
  return (
    <label className="grid gap-1 rounded-xl border border-border bg-surface p-3">
      <span className="font-bold">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="flex items-center overflow-hidden rounded-xl border border-input bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
        <Input
          aria-label={`تعداد ${label}`}
          className="h-11 min-w-0 flex-1 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={draft.count === value ? draft.text : String(value)}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const text = event.target.value;
            const count = parsePassengerCount(text);
            if (count === null) return;
            setDraft({ text, count });
            onChange(count);
          }}
          onBlur={() => setDraft({ text: String(value), count: value })}
        />
        <span className="border-r border-border px-3 text-sm font-bold text-muted-foreground">
          نفر
        </span>
      </span>
    </label>
  );
}
