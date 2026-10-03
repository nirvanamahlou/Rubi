'use client';
import { useEffect, useState } from 'react';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { travelRequest } from './travel-workflow-form';
import { TravelDocument } from './travel-document';
export function ReservationFormViewer({ id }: { id: string }) {
  const [intake, setIntake] = useState<
    ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 }
  >();
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void travelRequest<{
      data: ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
    }>('reservations/requests/' + id + '/workflow')
      .then((r) => {
        if (live) setIntake(r.data);
      })
      .catch((e) => {
        if (live)
          setError(e instanceof Error ? e.message : 'فرم در دسترس نیست.');
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (!intake)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || 'در حال دریافت فرم رزواسیون…'}
      </p>
    );
  return <TravelDocument intake={intake} historical />;
}
