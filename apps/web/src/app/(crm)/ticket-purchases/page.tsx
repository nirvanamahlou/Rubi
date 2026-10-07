import type { Metadata } from 'next';
import { TicketPurchaseWorkspace } from '@/modules/ticket-purchases/workspace';
export const metadata: Metadata = { title: 'خرید و تأمین' };
export default function Page() {
  return <TicketPurchaseWorkspace />;
}
