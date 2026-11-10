'use client';
import { useEffect, useState } from 'react';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { decodeIntake } from '@/modules/reservations/foundation/live-feed';
import type { RequestView } from '@/modules/reservations/foundation/model';
import { ReservationGeneralDetails } from '@/modules/reservations/components/reservation-general-details';
import { travelRequest } from '@/modules/reservations/components/travel-workflow-form';
export function FinanceReservationDetails({
  id,
  contractNumber,
}: {
  id: string;
  contractNumber: string;
}) {
  const [request, setRequest] = useState<RequestView | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const baseUrl = getPublicApiBaseUrl();
      if (!baseUrl) throw new Error('دریافت اطلاعات انجام نشد.');
      const session = await refreshAuthenticatedSession(baseUrl);
      if (!session) throw new Error('ورود انجام نشد.');
      const raw = await travelRequest<unknown>(
        `reservations/requests?contractNumber=${encodeURIComponent(contractNumber)}`,
      );
      const row = decodeIntake(raw, session, 'finance').find(
        (r) => r.id === id,
      );
      if (!row) throw new Error('درخواست یافت نشد.');
      if (active) setRequest(row);
    })().catch((e) => {
      if (active)
        setError(e instanceof Error ? e.message : 'دریافت مشخصات ناموفق بود.');
    });
    return () => {
      active = false;
    };
  }, [id, contractNumber]);
  if (error) return <p role="alert">{error}</p>;
  return request ? (
    <ReservationGeneralDetails request={request} finance />
  ) : (
    <p role="status">در حال دریافت مشخصات کامل قرارداد…</p>
  );
}
