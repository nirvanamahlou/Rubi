import type { Metadata } from 'next';
import { AgencyPortal } from '@/modules/organizations/components/agency-portal';
export const metadata: Metadata = { title: 'پرتال پرونده آژانس' };
export default function Page() {
  return <AgencyPortal />;
}
