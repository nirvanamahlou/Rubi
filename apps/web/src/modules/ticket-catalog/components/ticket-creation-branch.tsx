'use client';
import { useEffect, useState } from 'react';
import type { BranchReference } from '@nora/contracts';
import {
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function TicketCreationBranch({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const base = getPublicApiBaseUrl();
    void (base ? refreshAuthenticatedSession(base) : Promise.resolve(null))
      .then((session) => {
        if (cancelled) return;
        if (!session?.user.branches.length)
          throw new Error('دریافت شعبه‌های مجاز ناموفق بود.');
        setBranches(session.user.branches);
        if (session.user.branches.length === 1)
          onChange(session.user.branches[0]!.id);
      })
      .catch(() => {
        if (!cancelled) setError('دریافت شعبه‌های مجاز ناموفق بود.');
      });
    return () => {
      cancelled = true;
    };
  }, [onChange]);
  return (
    <FormField id="ticket-creation-branch" label="شعبه ثبت بلیت" required>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || !branches.length}
      >
        <SelectTrigger id="ticket-creation-branch">
          <SelectValue placeholder="شعبه ثبت بلیت را انتخاب کنید." />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p role="alert">{error}</p> : null}
    </FormField>
  );
}
