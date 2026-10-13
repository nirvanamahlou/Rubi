'use client';
import { useEffect, useState } from 'react';
import type { HotelPurchaseSavingsV1 } from '@nora/contracts';
import { HotelPurchaseSavings } from './hotel-purchase-savings';
import { travelRequest } from './travel-workflow-form';

export function ReservationHotelCosts({ id }: { id: string }) {
  const [data, setData] = useState<HotelPurchaseSavingsV1[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void travelRequest<{ data: HotelPurchaseSavingsV1[] }>(
      `reservations/hotel-savings/recorded/${encodeURIComponent(id)}`,
    )
      .then((result) => {
        if (live) setData(result.data);
      })
      .catch((error: unknown) => {
        if (live)
          setError(
            error instanceof Error
              ? error.message
              : 'دریافت نرخ مرجع ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">در حال دریافت نرخ مرجع هتل…</p>;
  return (
    <div className="space-y-3">
      {data.length ? (
        data.map((value, index) => (
          <HotelPurchaseSavings key={index} value={value} />
        ))
      ) : (
        <HotelPurchaseSavings />
      )}
    </div>
  );
}
