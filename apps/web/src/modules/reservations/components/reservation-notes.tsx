'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
import { travelRequest } from './travel-workflow-form';
type Intake = ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
export function ReservationNotes({ id }: { id: string }) {
  const [intake, setIntake] = useState<Intake>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void travelRequest<{ data: Intake }>(`reservations/requests/${id}/workflow`)
      .then((r) => {
        if (active) setIntake(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function save() {
    if (!intake || busy || !text.trim()) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const { data } = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${id}/workflow`,
        {
          action: 'NOTE',
          expectedVersion: intake.workflow.version,
          note: text.trim(),
        },
      );
      setIntake({ ...intake, workflow: data });
      setText('');
      setSaved(true);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت یادداشت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const salesNotes = [
    ...new Set(
      intake?.snapshot.serviceSelections.flatMap((service) =>
        [service.metadata?.reservationNote, service.metadata?.notes].filter(
          (value): value is string =>
            typeof value === 'string' && !!value.trim(),
        ),
      ) ?? [],
    ),
  ];
  return (
    <div className="grid gap-4" dir="rtl">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!intake ? (
        <p>در حال دریافت توضیحات…</p>
      ) : (
        <>
          <section className="grid gap-2">
            <h3 className="font-bold">یادداشت فروش</h3>
            {salesNotes.length ? (
              salesNotes.map((note, i) => (
                <p
                  key={i}
                  className="whitespace-pre-wrap rounded border border-border p-3"
                >
                  {note}
                </p>
              ))
            ) : (
              <p>یادداشتی از فروش ثبت نشده است.</p>
            )}
          </section>
          <section className="grid gap-2">
            <h3 className="font-bold">یادداشت‌های رزرواسیون</h3>
            {intake.workflow.reservationNotes?.map((note, i) => (
              <p
                key={i}
                className="whitespace-pre-wrap rounded border border-border p-3"
              >
                {note}
              </p>
            ))}
          </section>
          <label>
            یادداشت جدید
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              maxLength={500}
            />
          </label>
          <Button disabled={busy || !text.trim()} onClick={() => void save()}>
            {busy ? 'در حال ثبت…' : 'ثبت یادداشت'}
          </Button>
          {saved && <p role="status">یادداشت ثبت شد.</p>}
        </>
      )}
    </div>
  );
}
