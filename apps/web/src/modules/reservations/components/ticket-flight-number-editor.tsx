'use client';
import { useEffect, useState } from 'react';
import type { TravelWorkflowStateV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { travelRequest } from './travel-workflow-form';

export type TicketNumberFlight = {
  id: string;
  serviceNumber: string;
  direction?: 'OUTBOUND' | 'RETURN';
};
export function ticketNumberDefaults(
  flights: readonly TicketNumberFlight[],
  saved: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    flights.map((f) => [f.id, saved[f.id] ?? f.serviceNumber]),
  );
}
export function TicketFlightNumberEditor({
  requestId,
  salesContractId,
  flights,
  onSaved,
  onDirty,
}: {
  requestId: string;
  salesContractId?: string;
  flights: readonly TicketNumberFlight[];
  onSaved: (numbers: Record<string, string>) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const permissions = useAccessPermissions();
  const canEdit =
    !salesContractId && permissions?.includes('reservations.documents.manage');
  const [workflow, setWorkflow] = useState<TravelWorkflowStateV1 | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  // Flights come from the immutable intake; only output numbers are overridden.
  useEffect(() => {
    let active = true;
    void travelRequest<{ data: { workflow: TravelWorkflowStateV1 } }>(
      salesContractId
        ? `sales/contracts/${salesContractId}/travel-documents`
        : `reservations/requests/${requestId}/workflow`,
    )
      .then(({ data }) => {
        if (!active) return;
        setWorkflow(data.workflow);
        const saved = data.workflow.ticketFlightNumbers ?? {};
        setValues(ticketNumberDefaults(flights, saved));
        onSaved(saved);
        setDirty(false);
        onDirty(false);
        setError('');
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت شماره پرواز ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [requestId, salesContractId, flights, onSaved, onDirty, revision]);
  async function save() {
    if (!workflow || busy) return;
    setBusy(true);
    setError('');
    try {
      const numbers = Object.fromEntries(
        flights
          .filter(
            (f) =>
              values[f.id]?.trim().toUpperCase() !==
              f.serviceNumber.trim().toUpperCase(),
          )
          .map((f) => [f.id, values[f.id]!.trim().toUpperCase()]),
      );
      const { data } = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${requestId}/workflow`,
        {
          action: 'TICKET_FLIGHT_NUMBERS',
          expectedVersion: workflow.version,
          note: 'اصلاح شماره پرواز در خروجی بلیط',
          ticketFlightNumbers: numbers,
        },
      );
      setWorkflow(data);
      onSaved(data.ticketFlightNumbers ?? {});
      setDirty(false);
      onDirty(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ثبت شماره پرواز ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!canEdit) return error ? <p role="alert">{error}</p> : null;
  return (
    <section className="grid gap-3 rounded-xl border p-3">
      <h3 className="font-bold">شماره پرواز در بلیط</h3>
      <p className="text-xs text-muted-foreground">
        شماره از پرواز انتخاب‌شده پر می‌شود؛ ویرایش دستی فقط روی خروجی بلیط این
        قرارداد اعمال می‌شود.
      </p>
      <fieldset disabled={!workflow || busy} className="flex flex-wrap gap-3">
        {flights.map((f) => (
          <label key={f.id} className="grid gap-1 text-sm">
            {f.direction === 'RETURN' ? 'پرواز برگشت' : 'پرواز رفت'}
            <Input
              dir="ltr"
              maxLength={32}
              value={values[f.id] ?? f.serviceNumber}
              onChange={(e) => {
                setValues((old) => ({ ...old, [f.id]: e.target.value }));
                setDirty(true);
                onDirty(true);
              }}
            />
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <p className="text-xs text-muted-foreground">
          پیش از چاپ یا دانلود، شماره‌های پرواز را ذخیره کنید.
        </p>
      ) : null}
      <Button
        type="button"
        disabled={!workflow || busy || !dirty}
        onClick={() => void save()}
      >
        {busy ? 'در حال ثبت…' : 'ذخیره شماره‌های پرواز'}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setWorkflow(null);
          onDirty(true);
          setRevision((old) => old + 1);
        }}
      >
        دریافت آخرین نسخه
      </Button>
    </section>
  );
}
