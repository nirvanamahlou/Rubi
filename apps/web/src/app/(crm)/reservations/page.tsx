import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveReservationQueue } from '@/modules/reservations/foundation/live-workspace';
export const metadata: Metadata = { title: 'رزرواسیون و عملیات سفر' };
export default function Page() {
  return (
    <>
      <div dir="rtl" className="mb-4 flex justify-end">
        <Link
          className="rounded-lg border px-4 py-2 text-sm"
          href="/reservations/processing"
        >
          عملیات صدور و جزئیات رزرو
        </Link>
      </div>
      <LiveReservationQueue />
    </>
  );
}
