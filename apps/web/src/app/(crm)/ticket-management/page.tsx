import type { Metadata } from 'next';
import { TicketWorkspace } from '@/modules/ticket-catalog/components/ticket-workspace';

export const metadata: Metadata = { title: 'مدیریت و تعریف بلیت‌ها' };
export default function Page() {
  return <TicketWorkspace />;
}
