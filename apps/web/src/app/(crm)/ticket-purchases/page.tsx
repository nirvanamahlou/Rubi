import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { TicketPurchaseWorkspace } from '@/modules/ticket-purchases/workspace';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'خرید و تأمین' });
}
export default function Page() {
  return <TicketPurchaseWorkspace />;
}
