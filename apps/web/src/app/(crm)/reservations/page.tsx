import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { LiveReservationQueue } from '@/modules/reservations/foundation/live-workspace';
import { SettledVoucherReport } from '@/modules/reservations/reporting/settled-voucher-report';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'رزرواسیون و عملیات سفر' });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  if ((await searchParams).report === 'settled-vouchers')
    return <SettledVoucherReport />;
  return <LiveReservationQueue />;
}
