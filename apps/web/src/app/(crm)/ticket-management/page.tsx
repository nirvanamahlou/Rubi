import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { TicketWorkspace } from '@/modules/ticket-catalog/components/ticket-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'تعریف و ظرفیت پرواز' });
}
export default function Page() {
  return <TicketWorkspace />;
}
