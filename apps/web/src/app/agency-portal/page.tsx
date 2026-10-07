import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { AgencyPortal } from '@/modules/organizations/components/agency-portal';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'پرتال پرونده آژانس' });
}
export default function Page() {
  return <AgencyPortal />;
}
