import type { Metadata } from 'next';
import { TicketPricesWorkspace } from '@/modules/sales/components/ticket-prices-workspace';

export const metadata: Metadata = { title: 'قیمت گذاری پرواز' };

export default function Page() {
  return <TicketPricesWorkspace />;
}
