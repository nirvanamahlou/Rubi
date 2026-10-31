import { localizedMetadata } from '@/i18n/metadata';
import { InsuranceWorkspace } from '@/modules/reservations/insurance/workspace';
export async function generateMetadata() {
  return localizedMetadata({ title: 'بیمه مسافرتی' });
}
export default function Page() {
  return <InsuranceWorkspace />;
}
