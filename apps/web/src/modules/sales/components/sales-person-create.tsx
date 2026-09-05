'use client';

import { useRef, useState } from 'react';
import type { CustomerMutationRequest, CustomerSummary } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import { customersApi } from '@/modules/customers/api/client';

export interface SalesPersonDraft {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  alsoPassenger: boolean;
}

export function salesPersonInput(
  draft: SalesPersonDraft,
  mode: 'customer' | 'passenger',
): CustomerMutationRequest {
  const passenger = mode === 'passenger' || draft.alsoPassenger;
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  if (!firstName || !lastName)
    throw new Error('نام و نام خانوادگی را وارد کنید.');
  if (passenger && !draft.birthDate)
    throw new Error('تاریخ تولد مسافر الزامی است.');
  return {
    kind: 'person',
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    roles:
      mode === 'passenger'
        ? ['passenger']
        : passenger
          ? ['customer', 'passenger']
          : ['customer'],
    ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
    ...(draft.nationalId.trim() ? { nationalId: draft.nationalId.trim() } : {}),
  };
}

export async function createSalesPerson(
  draft: SalesPersonDraft,
  mode: 'customer' | 'passenger',
  api: Pick<typeof customersApi, 'create'> = customersApi,
) {
  const response = await api.create(salesPersonInput(draft, mode));
  return { person: response.data, birthDate: draft.birthDate };
}

export function SalesPersonCreate({
  mode,
  onCreated,
  onCancel,
  onBusyChange,
}: {
  mode: 'customer' | 'passenger';
  onCreated: (person: CustomerSummary, birthDate: string) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<SalesPersonDraft>({
    firstName: '',
    lastName: '',
    birthDate: '',
    nationalId: '',
    alsoPassenger: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const passenger = mode === 'passenger' || draft.alsoPassenger;
  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      const result = await createSalesPerson(draft, mode);
      onCreated(result.person, result.birthDate);
    } catch (reason) {
      setError(
        (reason instanceof Error ? reason.message : 'ثبت شخص انجام نشد.') +
          ' در خطای اتصال، پیش از ثبت دوباره نام فرد را جست‌وجو کنید.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      aria-label={
        mode === 'customer' ? 'افزودن مشتری جدید' : 'افزودن مسافر جدید'
      }
    >
      <h3 className="text-sm font-bold">
        {mode === 'customer' ? 'مشتری جدید' : 'مسافر جدید'}
      </h3>
      <p className="text-xs text-muted-foreground">
        فرد در بخش مشتریان ثبت و به همین قرارداد اضافه می‌شود. ثبت قرارداد در
        مرحله نهایی است.
      </p>
      {error ? (
        <Alert tone="error" title="ثبت شخص کامل نشد" description={error} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="نام" required>
          <Input
            aria-label="نام"
            disabled={busy}
            maxLength={100}
            value={draft.firstName}
            onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
          />
        </FormField>
        <FormField label="نام خانوادگی" required>
          <Input
            aria-label="نام خانوادگی"
            disabled={busy}
            maxLength={99}
            value={draft.lastName}
            onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
          />
        </FormField>
        <FormField label="تاریخ تولد" required={passenger}>
          <DatePicker
            disabled={busy}
            value={draft.birthDate}
            onChange={(birthDate) => setDraft({ ...draft, birthDate })}
          />
        </FormField>
        <FormField label="کد ملی (اختیاری)">
          <Input
            aria-label="کد ملی (اختیاری)"
            disabled={busy}
            inputMode="numeric"
            maxLength={10}
            value={draft.nationalId}
            onChange={(e) => setDraft({ ...draft, nationalId: e.target.value })}
          />
        </FormField>
      </div>
      {mode === 'customer' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={busy}
            className="size-4 accent-primary"
            checked={draft.alsoPassenger}
            onChange={(e) =>
              setDraft({ ...draft, alsoPassenger: e.target.checked })
            }
          />
          خود مشتری هم مسافر این قرارداد است
        </label>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          loading={busy}
          onClick={() => void save()}
        >
          ثبت و افزودن به قرارداد
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          انصراف
        </Button>
      </div>
    </section>
  );
}
