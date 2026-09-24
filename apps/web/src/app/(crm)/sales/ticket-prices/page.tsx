import type { Metadata } from 'next';
import { TicketPricesWorkspace } from '@/modules/sales/components/ticket-prices-workspace';

export const metadata: Metadata = { title: 'قیمت بلیط' };

export default function Page() {
  return <TicketPricesWorkspace />;
}
