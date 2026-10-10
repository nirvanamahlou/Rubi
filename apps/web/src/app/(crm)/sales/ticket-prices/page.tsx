import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { TicketPricesWorkspace } from '@/modules/sales/components/ticket-prices-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قیمت گذاری پرواز' });
}

export default function Page() {
  return <TicketPricesWorkspace />;
}
